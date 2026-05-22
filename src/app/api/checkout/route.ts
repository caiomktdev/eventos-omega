/**
 * POST /api/checkout
 *
 * Recebe o ID de uma inscrição (Participant) e:
 *
 *  1. Busca o preço real do ingresso no banco (fonte da verdade)
 *  2. Recalcula ESTRITAMENTE no servidor:
 *       mooveFee         = grossValue * 0.02   (2% — imutável)
 *       organizerNetValue = grossValue - mooveFee
 *  3. Persiste esses três valores na Transaction com status PENDING
 *  4. Cria uma Preference no Mercado Pago com chave de idempotência
 *  5. Salva o preferenceId na Transaction para rastreamento
 *
 * O cliente NUNCA envia valores monetários — tudo é derivado do banco.
 *
 * Retorna: { preferenceId, checkoutUrl, participantId }
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "@/lib/prisma";
import {
  getPreferenceClientForToken,
  buildIdempotencyKey,
} from "@/lib/mercadopago";
import { ensureOrganizerAccessToken } from "@/lib/mercadopago-oauth";
import { getAppBaseUrl } from "@/lib/app-url";
import { calculateMooveFee } from "@/lib/fee";

// ---------------------------------------------------------------------------
// Validação do body
// ---------------------------------------------------------------------------
const checkoutBodySchema = z.object({
  participantId: z.string().cuid("participantId deve ser um CUID válido."),
});

// ---------------------------------------------------------------------------
// Converte o resultado de calculateMooveFee (numbers) para Decimal do Prisma.
// Mantém precisão centesimal — o cálculo em inteiros já ocorreu em fee.ts.
// ---------------------------------------------------------------------------
function toDecimalFees(grossValueDecimal: Decimal): {
  grossValue: Decimal;
  mooveFee: Decimal;
  organizerNetValue: Decimal;
  feeRateApplied: number;
} {
  const result = calculateMooveFee(Number(grossValueDecimal));
  return {
    grossValue: new Decimal(result.grossAmount),
    mooveFee: new Decimal(result.mooveFee),
    organizerNetValue: new Decimal(result.organizerAmount),
    feeRateApplied: result.feeRateApplied,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participantId } = checkoutBodySchema.parse(body);

    // -----------------------------------------------------------------------
    // 1. Busca o Participant com todos os dados necessários
    // -----------------------------------------------------------------------
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        ticketType: {
          select: { id: true, name: true, price: true },
        },
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            organizerId: true,
            organizer: {
              select: { mercadoPagoUserId: true },
            },
          },
        },
        transaction: {
          select: {
            id: true,
            status: true,
            mercadoPagoPreferenceId: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Inscrição não encontrada." },
        { status: 404 }
      );
    }

    if (!participant.transaction) {
      return NextResponse.json(
        { error: "Transação financeira não encontrada para esta inscrição." },
        { status: 422 }
      );
    }

    if (Number(participant.ticketType.price) === 0) {
      return NextResponse.json(
        { error: "Ingresso gratuito não requer checkout de pagamento." },
        { status: 422 }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Guarda de status — não gera nova preferência se já aprovado/estornado
    // -----------------------------------------------------------------------
    const tx = participant.transaction;
    const terminalStatuses = ["APPROVED", "REFUNDED", "CHARGED_BACK"] as const;

    if (terminalStatuses.includes(tx.status as (typeof terminalStatuses)[number])) {
      return NextResponse.json(
        {
          error: `Transação já está em estado final: ${tx.status}.`,
          status: tx.status,
        },
        { status: 409 }
      );
    }

    // Se já tiver uma preferência ativa (idempotência), retorna sem recriar
    if (tx.mercadoPagoPreferenceId && tx.status === "PENDING") {
      return NextResponse.json({
        preferenceId: tx.mercadoPagoPreferenceId,
        checkoutUrl: `/checkout/${participantId}`,
        participantId,
        reused: true,
      });
    }

    // -----------------------------------------------------------------------
    // 3. Recálculo ESTRITO dos valores financeiros a partir do preço do banco.
    //    O cliente nunca envia valores — o preço vem do TicketType.price.
    //    Taxa de 2% aplicada via calculateMooveFee (src/lib/fee.ts — fonte única).
    // -----------------------------------------------------------------------
    const { grossValue, mooveFee, organizerNetValue, feeRateApplied } =
      toDecimalFees(participant.ticketType.price);

    // -----------------------------------------------------------------------
    // 4. Organizador com conta MP conectada (OAuth) — split marketplace
    // -----------------------------------------------------------------------
    const organizerMp = await ensureOrganizerAccessToken(
      participant.event.organizerId
    );

    if (!organizerMp) {
      return NextResponse.json(
        {
          error:
            "Este evento ainda não pode receber pagamentos. O organizador precisa conectar a conta Mercado Pago.",
          code: "ORGANIZER_MP_NOT_CONNECTED",
        },
        { status: 422 }
      );
    }

    // -----------------------------------------------------------------------
    // 5. Persiste os valores calculados na Transaction (PENDING)
    //    Mesmo que já existissem valores, recalculamos e sobrescrevemos
    //    para garantir consistência com o preço atual do ingresso.
    // -----------------------------------------------------------------------
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        grossValue,
        mooveFee,
        organizerNetValue,
        status: "PENDING",
      },
    });

    // -----------------------------------------------------------------------
    // 6. Monta a Preference do Mercado Pago
    //    unit_price vem de grossValue — calculado aqui, nunca do cliente
    // -----------------------------------------------------------------------
    const baseUrl = getAppBaseUrl();
    const webhookUrl = `${baseUrl}/api/webhooks/mercadopago?source_news=webhooks`;

    const formData = participant.formData as Record<string, string> | null;
    const payerEmail = formData?.email?.trim().toLowerCase();

    const preferenceBody = {
      items: [
        {
          id: participant.ticketType.id,
          title: `${participant.ticketType.name} — ${participant.event.title}`,
          description: `Inscrição #${participant.ordemCompra} • ${participant.event.title}`,
          quantity: 1,
          unit_price: Number(grossValue),
          currency_id: "BRL",
        },
      ],
      payer: payerEmail ? { email: payerEmail } : {},
      back_urls: {
        success: `${baseUrl}/payment/success`,
        failure: `${baseUrl}/payment/failure`,
        pending: `${baseUrl}/payment/success`,
      },
      auto_return: "approved" as const,
      notification_url: webhookUrl,
      external_reference: participantId,
      statement_descriptor: "EVENTOSOMEGA",
      marketplace_fee: Number(mooveFee),
      metadata: {
        participant_id: participantId,
        ordem_compra: participant.ordemCompra,
        event_id: participant.event.id,
        event_slug: participant.event.slug,
        gross_value: Number(grossValue),
        moove_fee: Number(mooveFee),
        moove_fee_rate: feeRateApplied,
        organizer_net_value: Number(organizerNetValue),
        organizer_mp_user_id: organizerMp.mercadoPagoUserId,
      },
      // Expiração automática de 30 minutos para ingressos com estoque limitado
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    // -----------------------------------------------------------------------
    // 7. Cria a Preference com token OAuth do organizador (split marketplace)
    // -----------------------------------------------------------------------
    const idempotencyKey = buildIdempotencyKey("pref", participantId);
    const preferenceClient = getPreferenceClientForToken(organizerMp.accessToken);

    const preference = await preferenceClient.create({
      body: preferenceBody,
      requestOptions: { idempotencyKey },
    });

    if (!preference.id) {
      throw new Error("Mercado Pago retornou uma preferência inválida.");
    }

    // -----------------------------------------------------------------------
    // 7. Salva o ID da preferência na Transaction para auditoria e idempotência
    // -----------------------------------------------------------------------
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { mercadoPagoPreferenceId: preference.id },
    });

    return NextResponse.json(
      {
        preferenceId: preference.id,
        checkoutUrl: `/checkout/${participantId}`,
        participantId,
        financial: {
          grossValue: Number(grossValue),
          mooveFee: Number(mooveFee),
          mooveFeeRate: feeRateApplied,
          organizerNetValue: Number(organizerNetValue),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Erros do SDK do Mercado Pago expõem message estruturada
    if (err instanceof Error) {
      console.error("[POST /api/checkout]", err.message);
      return NextResponse.json(
        { error: "Erro ao gerar preferência de pagamento.", detail: err.message },
        { status: 502 }
      );
    }

    console.error("[POST /api/checkout] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

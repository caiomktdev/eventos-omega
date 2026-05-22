/**
 * POST /api/enroll — inscrição pública de um participante em um evento.
 *
 * Fluxo:
 *   1. Valida os campos obrigatórios (nome, email) + campos extras do formStructure
 *   2. Encontra ou cria o User pelo e-mail informado
 *   3. Verifica disponibilidade de estoque do TicketType
 *   4. Cria o Participant com os dados do formulário (formData JSON)
 *   5. Cria a Transaction com grossValue, mooveFee (2%) e organizerNetValue
 *      calculados EXCLUSIVAMENTE no servidor
 *   6. Reserva o estoque (soldQuantity++)
 *
 * Retorna: { participantId, ordemCompra, redirectTo }
 *   redirectTo → URL da preferência de pagamento (se ingresso pago)
 *             → null (se ingresso gratuito — participante já é CONFIRMED)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrollSchema } from "@/lib/validations";
import { calculateMooveFee } from "@/lib/fee";
import { sendTicketConfirmationEmailAsync } from "@/lib/email/ticket-confirmation";
import { ZodError } from "zod";
import type { EventFormStructure } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // --- Validação base (nome + email + ticketTypeId + eventId) ---
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { eventId, ticketTypeId, formData } = parsed.data;

    // --- Busca evento com formStructure e tipo de ingresso ---
    const event = await prisma.event.findUnique({
      where: { id: eventId, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        formStructure: true,
        ticketTypes: {
          where: { id: ticketTypeId },
          select: {
            id: true,
            name: true,
            price: true,
            totalQuantity: true,
            soldQuantity: true,
            maxPerOrder: true,
            salesStartDate: true,
            salesEndDate: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento não encontrado ou não está publicado." },
        { status: 404 }
      );
    }

    const ticketType = event.ticketTypes[0];
    if (!ticketType) {
      return NextResponse.json(
        { error: "Tipo de ingresso inválido para este evento." },
        { status: 404 }
      );
    }

    // --- Valida campos extras obrigatórios definidos no formStructure ---
    const structure = event.formStructure as unknown as EventFormStructure;
    const missingFields: string[] = [];

    for (const field of structure.fields ?? []) {
      if (!field.required) continue;
      const value = formData[field.name as keyof typeof formData];
      if (value === undefined || value === "" || value === false) {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Campos obrigatórios não preenchidos.",
          details: { missingFields },
        },
        { status: 422 }
      );
    }

    const now = new Date();
    if (ticketType.salesStartDate && now < ticketType.salesStartDate) {
      return NextResponse.json(
        { error: "As vendas deste ingresso ainda não começaram." },
        { status: 422 }
      );
    }
    if (ticketType.salesEndDate && now > ticketType.salesEndDate) {
      return NextResponse.json(
        { error: "As vendas deste ingresso já encerraram." },
        { status: 422 }
      );
    }

    const existingForEmail = await prisma.participant.count({
      where: {
        ticketTypeId,
        user: { email: formData.email },
        status: { in: ["REGISTERED", "CONFIRMED", "CHECKED_IN"] },
      },
    });

    if (existingForEmail >= ticketType.maxPerOrder) {
      return NextResponse.json(
        {
          error: `Limite de ${ticketType.maxPerOrder} ingresso(s) "${ticketType.name}" por comprador atingido para este e-mail.`,
        },
        { status: 422 }
      );
    }

    // --- Verifica disponibilidade de estoque ---
    const available = ticketType.totalQuantity - ticketType.soldQuantity;
    if (available < 1) {
      return NextResponse.json(
        { error: `Ingresso "${ticketType.name}" esgotado.` },
        { status: 409 }
      );
    }

    // --- Encontra ou cria o User pelo e-mail ---
    const user = await prisma.user.upsert({
      where: { email: formData.email },
      update: { name: formData.nome },
      create: {
        email: formData.email,
        name: formData.nome,
        role: "BUYER",
      },
    });

    // --- Cria Participant + Transaction em transação atômica ---
    const unitPriceCents = Math.round(Number(ticketType.price) * 100);

    // ===== CÁLCULO IMUTÁVEL DA TAXA MOOVE (2%) =====
    const feeCalc = calculateMooveFee(unitPriceCents / 100);
    // ================================================

    const isFree = unitPriceCents === 0;

    const { participant } = await prisma.$transaction(async (tx) => {
      // Re-verifica o estoque dentro da transação (evita race condition)
      const fresh = await tx.ticketType.findUniqueOrThrow({
        where: { id: ticketTypeId },
        select: { soldQuantity: true, totalQuantity: true },
      });

      if (fresh.soldQuantity >= fresh.totalQuantity) {
        throw new Error(`Ingresso "${ticketType.name}" esgotado.`);
      }

      const newParticipant = await tx.participant.create({
        data: {
          userId: user.id,
          eventId,
          ticketTypeId,
          // Participante gratuito já começa CONFIRMED, pago começa REGISTERED
          status: isFree ? "CONFIRMED" : "REGISTERED",
          // formData armazenado como JSON — preserva todos os campos do formulário
          formData: formData as Record<string, string | boolean | number>,
          transaction: {
            create: {
              grossValue: feeCalc.grossAmount,
              mooveFee: feeCalc.mooveFee,
              organizerNetValue: feeCalc.organizerAmount,
              // Ingresso gratuito já nasce APPROVED
              status: isFree ? "APPROVED" : "PENDING",
              ...(isFree ? { paidAt: new Date() } : {}),
            },
          },
        },
        select: {
          id: true,
          ordemCompra: true,
          status: true,
        },
      });

      // Reserva o estoque
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { soldQuantity: { increment: 1 } },
      });

      return { participant: newParticipant };
    });

    // --- Para ingressos pagos: cria preferência MP e retorna URL ---
    if (!isFree) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const checkoutRes = await fetch(`${baseUrl}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: participant.id }),
      });

      if (checkoutRes.ok) {
        const { checkoutUrl } = await checkoutRes.json();
        return NextResponse.json(
          {
            participantId: participant.id,
            ordemCompra: participant.ordemCompra,
            status: participant.status,
            requiresPayment: true,
            redirectTo: checkoutUrl ?? `/checkout/${participant.id}`,
            checkoutUrl: checkoutUrl ?? `/checkout/${participant.id}`,
          },
          { status: 201 }
        );
      }

      const checkoutError = await checkoutRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          participantId: participant.id,
          ordemCompra: participant.ordemCompra,
          status: participant.status,
          requiresPayment: true,
          redirectTo: null,
          checkoutUrl: `/checkout/${participant.id}`,
          paymentError:
            (checkoutError as { error?: string }).error ??
            "Não foi possível iniciar o pagamento. Tente novamente na página de checkout.",
        },
        { status: 201 }
      );
    }

    sendTicketConfirmationEmailAsync(participant.id);

    return NextResponse.json(
      {
        participantId: participant.id,
        ordemCompra: participant.ordemCompra,
        status: participant.status,
        requiresPayment: false,
        redirectTo: null,
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
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/enroll]", err);
    return NextResponse.json(
      { error: "Erro interno ao processar inscrição." },
      { status: 500 }
    );
  }
}

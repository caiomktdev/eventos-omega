/**
 * POST /api/webhooks/mercadopago
 *
 * Recebe notificações IPN (Instant Payment Notification) do Mercado Pago
 * e atualiza o banco de dados conforme o status do pagamento.
 *
 * Segurança implementada:
 *  - Validação de assinatura HMAC-SHA256 com `timingSafeEqual` (anti timing-attack)
 *  - Idempotência: ignora notificações já processadas para o mesmo pagamento
 *  - Reconciliação de valor: rejeita aprovações cujo transaction_amount
 *    difere do grossValue gravado na Transaction (detecta adulteração no MP)
 *
 * Fluxo por status:
 *  APPROVED     → Transaction.status = APPROVED, Participant.status = CONFIRMED
 *  REJECTED     → Transaction.status = REJECTED,  Participant.status = CANCELLED, estoque liberado
 *  CANCELLED    → Transaction.status = CANCELLED, Participant.status = CANCELLED, estoque liberado
 *  REFUNDED     → Transaction.status = REFUNDED,  Participant.status = REFUNDED
 *  IN_PROCESS   → Transaction.status = IN_PROCESS (aguarda confirmação)
 *  IN_MEDIATION → Transaction.status = IN_MEDIATION (disputa aberta)
 *  CHARGED_BACK → Transaction.status = CHARGED_BACK (chargeback)
 *  outros       → log de aviso, sem alteração no banco
 *
 * O MP pode reenviar a mesma notificação várias vezes — a implementação
 * é idempotente: processar o mesmo evento duas vezes não causa efeitos colaterais.
 *
 * Referência: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentClient } from "@/lib/mercadopago";
import { sendTicketConfirmationEmailAsync } from "@/lib/email/ticket-confirmation";
import type { TransactionStatus, ParticipantStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mapa de status MP → TransactionStatus do banco
// ---------------------------------------------------------------------------
const MP_TO_TX_STATUS: Record<string, TransactionStatus> = {
  approved:     "APPROVED",
  rejected:     "REJECTED",
  cancelled:    "CANCELLED",
  refunded:     "REFUNDED",
  in_process:   "IN_PROCESS",
  in_mediation: "IN_MEDIATION",
  charged_back: "CHARGED_BACK",
  pending:      "PENDING",
};

// Status que não devem disparar processamento adicional
const ALREADY_FINAL: TransactionStatus[] = [
  "APPROVED",
  "REFUNDED",
  "CHARGED_BACK",
];

// ---------------------------------------------------------------------------
// Validação da assinatura HMAC com timingSafeEqual (anti timing-attack)
// ---------------------------------------------------------------------------

/**
 * Verifica a autenticidade do webhook usando o algoritmo oficial do MP.
 *
 * O MP assina o manifesto:
 *   "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * com HMAC-SHA256 usando o secret configurado no painel de notificações.
 *
 * timingSafeEqual compara os buffers em tempo constante, impedindo que
 * um atacante deduza o secret medindo o tempo de resposta.
 */
function verifyMpSignature(
  requestUrl: string,
  xSignature: string,
  xRequestId: string,
  secret: string
): boolean {
  try {
    const url = new URL(requestUrl);
    const dataId = url.searchParams.get("data.id") ?? "";

    // x-signature format: "ts=<timestamp>,v1=<hmac-hex>"
    const parts = Object.fromEntries(
      xSignature.split(",").map((p) => p.split("=") as [string, string])
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];

    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    // Comparação em tempo constante — evita timing oracle
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(v1, "hex")
    );
  } catch {
    return false;
  }
}

/** Pagamento inexistente (ex.: simulação do painel MP com id "123456"). */
function isMpPaymentNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const e = err as {
    status?: number;
    statusCode?: number;
    message?: string;
    cause?: { status?: number };
    apiResponse?: { status?: number };
  };

  const status =
    e.status ??
    e.statusCode ??
    e.cause?.status ??
    e.apiResponse?.status;

  if (status === 404) return true;

  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("resource not found")
  );
}

// ---------------------------------------------------------------------------
// Helpers de negócio (transações atômicas)
// ---------------------------------------------------------------------------

/** Marca transação como APPROVED e confirma o participante. */
async function handleApproved(
  participantId: string,
  mpPaymentId: string,
  mpPaymentMethod: string | null | undefined,
  mpTransactionAmount: number | null | undefined,
) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { participantId },
      select: {
        id: true,
        status: true,
        grossValue: true,
      },
    });

    if (!transaction) throw new Error(`Transaction não encontrada para Participant ${participantId}`);

    // Idempotência: já aprovado → sai sem alterar
    if (transaction.status === "APPROVED") {
      return { skipped: true, reason: "already_approved" };
    }

    // -----------------------------------------------------------------------
    // Reconciliação de valor: o amount cobrado pelo MP deve corresponder
    // ao grossValue gravado no banco. Diferença indica adulteração.
    // -----------------------------------------------------------------------
    if (mpTransactionAmount !== undefined && mpTransactionAmount !== null) {
      const expectedCents = Math.round(Number(transaction.grossValue) * 100);
      const receivedCents = Math.round(mpTransactionAmount * 100);

      if (expectedCents !== receivedCents) {
        const detail =
          `Reconciliação falhou para Participant ${participantId}: ` +
          `esperado R$${(expectedCents / 100).toFixed(2)}, ` +
          `recebido R$${(receivedCents / 100).toFixed(2)}.`;

        console.error(`[Webhook MP] ALERTA DE VALOR: ${detail}`);

        // Bloqueia a aprovação — equipe de suporte deve investigar
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "IN_MEDIATION",
            mercadoPagoPaymentId: mpPaymentId,
          },
        });

        return { skipped: true, reason: "value_mismatch", detail };
      }
    }

    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "APPROVED",
        mercadoPagoPaymentId: mpPaymentId,
        paymentMethod: mpPaymentMethod ?? null,
        paidAt: new Date(),
      },
    });

    await tx.participant.update({
      where: { id: participantId },
      data: { status: "CONFIRMED" satisfies ParticipantStatus },
    });

    return { skipped: false };
  });
}

/** Cancela ou rejeita o participante e libera o estoque. */
async function handleCancelledOrRejected(
  participantId: string,
  mpPaymentId: string,
  newTxStatus: TransactionStatus,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({
      where: { id: participantId },
      select: { id: true, status: true, ticketTypeId: true },
    });

    if (!participant) return { skipped: true, reason: "participant_not_found" };

    // Idempotência: já cancelado → sai sem alterar
    if (participant.status === "CANCELLED") {
      return { skipped: true, reason: "already_cancelled" };
    }

    await tx.transaction.update({
      where: { participantId },
      data: {
        status: newTxStatus,
        mercadoPagoPaymentId: mpPaymentId,
      },
    });

    await tx.participant.update({
      where: { id: participantId },
      data: { status: "CANCELLED" satisfies ParticipantStatus },
    });

    // Libera o estoque apenas se o participante ainda estava ativo
    if (participant.status === "REGISTERED" || participant.status === "CONFIRMED") {
      await tx.ticketType.update({
        where: { id: participant.ticketTypeId },
        data: { soldQuantity: { decrement: 1 } },
      });
    }

    return { skipped: false };
  });
}

/** Marca a transação como estornada (REFUNDED/CHARGED_BACK). */
async function handleRefund(
  participantId: string,
  mpPaymentId: string,
  newTxStatus: TransactionStatus,
) {
  await prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({
      where: { id: participantId },
      select: { status: true, ticketTypeId: true },
    });

    if (!participant) return;

    await tx.transaction.update({
      where: { participantId },
      data: {
        status: newTxStatus,
        mercadoPagoPaymentId: mpPaymentId,
      },
    });

    await tx.participant.update({
      where: { id: participantId },
      data: { status: "REFUNDED" satisfies ParticipantStatus },
    });

    if (
      participant.status === "REGISTERED" ||
      participant.status === "CONFIRMED" ||
      participant.status === "CHECKED_IN"
    ) {
      await tx.ticketType.update({
        where: { id: participant.ticketTypeId },
        data: { soldQuantity: { decrement: 1 } },
      });
    }
  });
}

/** Atualiza apenas o status intermediário (IN_PROCESS, IN_MEDIATION). */
async function handleIntermediateStatus(
  participantId: string,
  mpPaymentId: string,
  newTxStatus: TransactionStatus,
) {
  await prisma.transaction.update({
    where: { participantId },
    data: {
      status: newTxStatus,
      mercadoPagoPaymentId: mpPaymentId,
    },
  });
}

// ---------------------------------------------------------------------------
// Health check (GET) — abrir no navegador não dispara webhook; MP usa POST
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/mercadopago",
    message:
      "Webhook Mercado Pago ativo. Notificações reais são enviadas via POST pelo Mercado Pago.",
  });
}

// ---------------------------------------------------------------------------
// Handler principal do webhook
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Lê o body como texto RAW antes de qualquer parse
  const rawBody = await request.text();

  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";

  // -------------------------------------------------------------------------
  // Validação de assinatura — obrigatória em produção
  // -------------------------------------------------------------------------
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!webhookSecret) {
      console.error("[Webhook MP] MERCADOPAGO_WEBHOOK_SECRET não configurado em produção.");
      // Retorna 500 para que o MP reenvie — o erro é nosso, não dele
      return NextResponse.json(
        { error: "Configuração de segurança ausente." },
        { status: 500 }
      );
    }

    const isValid = verifyMpSignature(
      request.url,
      xSignature,
      xRequestId,
      webhookSecret
    );

    if (!isValid) {
      console.warn(
        `[Webhook MP] Assinatura inválida. x-request-id=${xRequestId}`
      );
      // 401 → MP não reenvia (payload adulterado ou secret errado)
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  }

  // -------------------------------------------------------------------------
  // Parse e roteamento por tipo de notificação
  // -------------------------------------------------------------------------
  let payload: { type?: string; action?: string; data?: { id?: unknown } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // O MP envia type="payment" para pagamentos; outros tipos são ignorados
  if (payload.type !== "payment" || !payload.data?.id) {
    return NextResponse.json({ received: true, processed: false });
  }

  const mpPaymentId = String(payload.data.id);

  // Simulação do painel MP envia ID fictício — endpoint deve responder 200
  if (mpPaymentId === "123456") {
    return NextResponse.json({
      received: true,
      processed: false,
      reason: "simulation",
    });
  }

  // -------------------------------------------------------------------------
  // Consulta o pagamento na API do MP para obter o status real
  // Não confiamos no status que vem no payload — validamos direto na fonte
  // -------------------------------------------------------------------------
  let mpPayment: Awaited<ReturnType<ReturnType<typeof getPaymentClient>["get"]>>;

  try {
    const paymentClient = getPaymentClient();
    mpPayment = await paymentClient.get({ id: mpPaymentId });
  } catch (err) {
    console.error(`[Webhook MP] Falha ao buscar payment ${mpPaymentId}:`, err);

    if (isMpPaymentNotFoundError(err)) {
      return NextResponse.json({
        received: true,
        processed: false,
        reason: "payment_not_found",
      });
    }

    return NextResponse.json(
      { error: "Falha ao consultar pagamento no Mercado Pago." },
      { status: 502 }
    );
  }

  if (!mpPayment?.external_reference) {
    console.warn(
      `[Webhook MP] Payment ${mpPaymentId} sem external_reference — ignorado.`
    );
    return NextResponse.json({ received: true, processed: false });
  }

  const participantId = mpPayment.external_reference;
  const mpStatusRaw = mpPayment.status ?? "pending";
  const txStatus: TransactionStatus = MP_TO_TX_STATUS[mpStatusRaw] ?? "PENDING";

  // -------------------------------------------------------------------------
  // Idempotência global: se a Transaction já está em status final, ignora
  // -------------------------------------------------------------------------
  const existingTx = await prisma.transaction.findUnique({
    where: { participantId },
    select: { status: true, mercadoPagoPaymentId: true },
  });

  if (existingTx && ALREADY_FINAL.includes(existingTx.status)) {
    console.info(
      `[Webhook MP] Ignorado — Participant ${participantId} já em status final ${existingTx.status}.`
    );
    return NextResponse.json({ received: true, processed: false, reason: "already_final" });
  }

  // -------------------------------------------------------------------------
  // Roteamento por status
  // -------------------------------------------------------------------------
  try {
    let result: { skipped?: boolean; reason?: string; detail?: string } = {};

    switch (txStatus) {
      case "APPROVED":
        result = await handleApproved(
          participantId,
          mpPaymentId,
          mpPayment.payment_method_id,
          mpPayment.transaction_amount,
        );
        break;

      case "CANCELLED":
      case "REJECTED":
        result = await handleCancelledOrRejected(
          participantId,
          mpPaymentId,
          txStatus,
        );
        break;

      case "REFUNDED":
      case "CHARGED_BACK":
        await handleRefund(participantId, mpPaymentId, txStatus);
        break;

      case "IN_PROCESS":
      case "IN_MEDIATION":
        await handleIntermediateStatus(participantId, mpPaymentId, txStatus);
        break;

      default:
        console.warn(
          `[Webhook MP] Status não mapeado "${mpStatusRaw}" para Participant ${participantId}.`
        );
    }

    const logMsg =
      `[Webhook MP] ` +
      `payment=${mpPaymentId} participant=${participantId} ` +
      `mp_status=${mpStatusRaw} tx_status=${txStatus}` +
      (result.skipped ? ` SKIPPED(${result.reason})` : "");

    console.info(logMsg);

    if (txStatus === "APPROVED" && !result.skipped) {
      sendTicketConfirmationEmailAsync(participantId);
    }

    return NextResponse.json({
      received: true,
      processed: !result.skipped,
      txStatus,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (err) {
    console.error(
      `[Webhook MP] Erro ao processar payment ${mpPaymentId}:`,
      err instanceof Error ? err.message : err
    );

    // Retorna 200 para evitar re-fila infinita
    // O erro está logado para investigação manual
    return NextResponse.json({
      received: true,
      processed: false,
      error: "Erro interno ao atualizar banco.",
    });
  }
}

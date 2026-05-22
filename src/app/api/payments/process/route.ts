/**
 * POST /api/payments/process
 *
 * Processa pagamento do Payment Brick (Checkout embarcado).
 * Usa token OAuth do organizador + application_fee (split Moove 2%).
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  buildIdempotencyKey,
  getPaymentClientForToken,
} from "@/lib/mercadopago";
import { ensureOrganizerAccessToken } from "@/lib/mercadopago-oauth";
import { getAppBaseUrl } from "@/lib/app-url";

const processPaymentSchema = z.object({
  participantId: z.string().cuid(),
  formData: z.record(z.unknown()),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participantId, formData } = processPaymentSchema.parse(body);

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        event: {
          select: {
            title: true,
            organizerId: true,
            organizer: { select: { mercadoPagoUserId: true } },
          },
        },
        ticketType: { select: { name: true } },
        transaction: {
          select: {
            id: true,
            status: true,
            grossValue: true,
            mooveFee: true,
          },
        },
      },
    });

    if (!participant?.transaction) {
      return NextResponse.json(
        { error: "Inscrição não encontrada." },
        { status: 404 }
      );
    }

    if (participant.transaction.status === "APPROVED") {
      return NextResponse.json({
        status: "approved",
        alreadyPaid: true,
      });
    }

    const organizerMp = await ensureOrganizerAccessToken(
      participant.event.organizerId
    );

    if (!organizerMp) {
      return NextResponse.json(
        {
          error:
            "O organizador ainda não pode receber pagamentos. Conta Mercado Pago não conectada.",
          code: "ORGANIZER_MP_NOT_CONNECTED",
        },
        { status: 422 }
      );
    }

    const grossValue = Number(participant.transaction.grossValue);
    const mooveFee = Number(participant.transaction.mooveFee);
    const baseUrl = getAppBaseUrl();
    const webhookUrl = `${baseUrl}/api/webhooks/mercadopago?source_news=webhooks`;

    const payer = formData.payer as
      | {
          email?: string;
          identification?: { type?: string; number?: string };
          first_name?: string;
          last_name?: string;
        }
      | undefined;

    const paymentBody: Record<string, unknown> = {
      transaction_amount: grossValue,
      description: `${participant.ticketType.name} — ${participant.event.title}`,
      external_reference: participantId,
      application_fee: mooveFee,
      notification_url: webhookUrl,
      metadata: {
        participant_id: participantId,
        gross_value: grossValue,
        moove_fee: mooveFee,
      },
    };

    if (formData.token) {
      paymentBody.token = formData.token;
    }
    if (formData.payment_method_id) {
      paymentBody.payment_method_id = formData.payment_method_id;
    }
    if (formData.installments != null) {
      paymentBody.installments = Number(formData.installments);
    }
    if (formData.issuer_id != null) {
      paymentBody.issuer_id = formData.issuer_id;
    }
    if (payer) {
      paymentBody.payer = payer;
    }

    const paymentClient = getPaymentClientForToken(organizerMp.accessToken);
    const idempotencyKey = buildIdempotencyKey("pay", participantId);

    const payment = await paymentClient.create({
      body: paymentBody,
      requestOptions: { idempotencyKey },
    });

    if (!payment?.id) {
      throw new Error("Mercado Pago não retornou um pagamento válido.");
    }

    const mpStatus = payment.status ?? "pending";

    if (mpStatus === "approved") {
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: participant.transaction.id },
          data: {
            status: "APPROVED",
            mercadoPagoPaymentId: String(payment.id),
            paymentMethod: payment.payment_method_id ?? null,
            paidAt: new Date(),
          },
        }),
        prisma.participant.update({
          where: { id: participantId },
          data: { status: "CONFIRMED" },
        }),
      ]);
    } else if (mpStatus === "pending" || mpStatus === "in_process") {
      await prisma.transaction.update({
        where: { id: participant.transaction.id },
        data: {
          status: mpStatus === "in_process" ? "IN_PROCESS" : "PENDING",
          mercadoPagoPaymentId: String(payment.id),
          paymentMethod: payment.payment_method_id ?? null,
        },
      });
    }

    return NextResponse.json({
      id: payment.id,
      status: mpStatus,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }

    if (err instanceof Error) {
      console.error("[POST /api/payments/process]", err.message);
      return NextResponse.json(
        { error: "Erro ao processar pagamento.", detail: err.message },
        { status: 502 }
      );
    }

    console.error("[POST /api/payments/process] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

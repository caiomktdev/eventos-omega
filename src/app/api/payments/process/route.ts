/**
 * POST /api/payments/process
 *
 * Processa pagamento do Payment Brick (Checkout embarcado).
 * Usa token OAuth do organizador + application_fee (split Moove).
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  buildIdempotencyKey,
  getPaymentClientForToken,
} from "@/lib/mercadopago";
import { getMercadoPagoErrorMessage } from "@/lib/mercadopago-errors";
import { ensureOrganizerAccessToken } from "@/lib/mercadopago-oauth";
import { getAppBaseUrl } from "@/lib/app-url";

const processPaymentSchema = z.object({
  participantId: z.string().cuid(),
  formData: z.record(z.unknown()),
});

type BrickPayer = {
  email?: string;
  identification?: { type?: string; number?: string };
  first_name?: string;
  last_name?: string;
};

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
            mercadoPagoPaymentId: true,
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
        id: participant.transaction.mercadoPagoPaymentId,
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
    const description = `${participant.ticketType.name} — ${participant.event.title}`;

    const enrollmentForm = participant.formData as Record<string, string> | null;
    const enrollmentEmail = enrollmentForm?.email?.trim().toLowerCase();

    const brickPayer = (formData.payer as BrickPayer | undefined) ?? {};
    const payer: BrickPayer = {
      ...brickPayer,
      email: brickPayer.email?.trim() || enrollmentEmail || undefined,
    };

    if (!payer.email) {
      return NextResponse.json(
        { error: "Informe um e-mail válido para continuar com o pagamento." },
        { status: 422 }
      );
    }

    const paymentBody: Record<string, unknown> = {
      transaction_amount: grossValue,
      description,
      external_reference: participantId,
      application_fee: mooveFee,
      notification_url: webhookUrl,
      metadata: {
        participant_id: participantId,
        gross_value: grossValue,
        moove_fee: mooveFee,
      },
      payer,
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
    if (formData.additional_info) {
      paymentBody.additional_info = formData.additional_info;
    }
    if (formData.transaction_details) {
      paymentBody.transaction_details = formData.transaction_details;
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
      pix:
        payment.payment_method_id === "pix"
          ? {
              qr_code:
                payment.point_of_interaction?.transaction_data?.qr_code ?? null,
              qr_code_base64:
                payment.point_of_interaction?.transaction_data?.qr_code_base64 ??
                null,
              ticket_url:
                payment.point_of_interaction?.transaction_data?.ticket_url ?? null,
            }
          : null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const message = getMercadoPagoErrorMessage(err);
    console.error("[POST /api/payments/process]", message, err);

    return NextResponse.json(
      { error: message, detail: message },
      { status: 502 }
    );
  }
}

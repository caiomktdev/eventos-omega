/**
 * E-mail de confirmação de ingresso — disparado após pagamento aprovado
 * ou inscrição gratuita confirmada.
 *
 * Idempotente: usa confirmationEmailSentAt no Participant.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/fee";
import { getAppBaseUrl } from "@/lib/app-url";
import { getEmailFromAddress, getResendClient, isEmailConfigured } from "@/lib/email/client";

export interface SendTicketEmailResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTicketConfirmationHtml(data: {
  participantName: string;
  ordemCompra: number;
  eventTitle: string;
  eventDate: string;
  venue: string;
  ticketName: string;
  grossValue: number;
  isFree: boolean;
  myTicketsUrl: string;
  eventUrl: string;
}): string {
  const orderLabel = `#${String(data.ordemCompra).padStart(5, "0")}`;
  const priceLine = data.isFree
    ? "Gratuito"
    : formatCurrency(data.grossValue);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Seu ingresso — ${escapeHtml(data.eventTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:#0f172a;padding:28px 32px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">EventosOmega</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;">Ingresso confirmado</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                Olá, <strong>${escapeHtml(data.participantName)}</strong>!
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b;">
                Sua inscrição em <strong>${escapeHtml(data.eventTitle)}</strong> foi confirmada com sucesso.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Número da inscrição</p>
                    <p style="margin:0 0 16px;font-size:28px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.08em;">${orderLabel}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#52525b;"><strong>Ingresso:</strong> ${escapeHtml(data.ticketName)}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#52525b;"><strong>Data:</strong> ${escapeHtml(data.eventDate)}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#52525b;"><strong>Local:</strong> ${escapeHtml(data.venue)}</p>
                    <p style="margin:0;font-size:14px;color:#52525b;"><strong>Valor:</strong> ${escapeHtml(priceLine)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#52525b;">
                Apresente o número da inscrição na entrada do evento. Guarde este e-mail para consulta.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
                <tr>
                  <td style="border-radius:8px;background:#2563eb;">
                    <a href="${escapeHtml(data.myTicketsUrl)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Ver meus ingressos</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;">
                <a href="${escapeHtml(data.eventUrl)}" style="color:#2563eb;text-decoration:none;">Ver página do evento</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;background:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;text-align:center;">
                EventosOmega — plataforma de ingressos<br />
                Este é um e-mail automático, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envia e-mail de confirmação de ingresso se o participante está CONFIRMED
 * e ainda não recebeu o e-mail. Não lança erro — falhas são logadas.
 */
export async function sendTicketConfirmationEmail(
  participantId: string
): Promise<SendTicketEmailResult> {
  if (!isEmailConfigured()) {
    console.warn(
      "[TicketEmail] RESEND_API_KEY não configurado — e-mail não enviado.",
      { participantId }
    );
    return { sent: false, skipped: true, reason: "email_not_configured" };
  }

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      ordemCompra: true,
      status: true,
      confirmationEmailSentAt: true,
      formData: true,
      user: { select: { email: true, name: true } },
      event: {
        select: {
          title: true,
          slug: true,
          venue: true,
          city: true,
          state: true,
          startDate: true,
        },
      },
      ticketType: { select: { name: true, price: true } },
      transaction: { select: { grossValue: true, status: true } },
    },
  });

  if (!participant) {
    return { sent: false, skipped: true, reason: "participant_not_found" };
  }

  if (participant.confirmationEmailSentAt) {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  if (participant.status !== "CONFIRMED") {
    return { sent: false, skipped: true, reason: "not_confirmed" };
  }

  const formData = participant.formData as Record<string, string> | null;
  const participantName =
    formData?.nome ?? formData?.name ?? participant.user.name ?? "Participante";
  const recipientEmail = formData?.email ?? participant.user.email;

  if (!recipientEmail) {
    return { sent: false, skipped: true, reason: "no_email" };
  }

  const baseUrl = getAppBaseUrl();
  const eventDate = format(
    new Date(participant.event.startDate),
    "EEEE, dd 'de' MMMM 'às' HH:mm",
    { locale: ptBR }
  ).replace(/^./, (c) => c.toUpperCase());

  const grossValue = participant.transaction
    ? Number(participant.transaction.grossValue)
    : Number(participant.ticketType.price);

  const html = buildTicketConfirmationHtml({
    participantName,
    ordemCompra: participant.ordemCompra,
    eventTitle: participant.event.title,
    eventDate,
    venue: `${participant.event.venue} · ${participant.event.city}/${participant.event.state}`,
    ticketName: participant.ticketType.name,
    grossValue,
    isFree: grossValue === 0,
    myTicketsUrl: `${baseUrl}/meus-ingressos`,
    eventUrl: `${baseUrl}/event/${participant.event.slug}`,
  });

  const resend = getResendClient();
  if (!resend) {
    return { sent: false, skipped: true, reason: "email_not_configured" };
  }

  const orderLabel = `#${String(participant.ordemCompra).padStart(5, "0")}`;

  const { error } = await resend.emails.send({
    from: getEmailFromAddress(),
    to: recipientEmail,
    subject: `Ingresso confirmado ${orderLabel} — ${participant.event.title}`,
    html,
  });

  if (error) {
    console.error("[TicketEmail] Falha ao enviar:", error, { participantId });
    return { sent: false, reason: error.message };
  }

  const updated = await prisma.participant.updateMany({
    where: {
      id: participantId,
      confirmationEmailSentAt: null,
    },
    data: { confirmationEmailSentAt: new Date() },
  });

  if (updated.count === 0) {
    return { sent: false, skipped: true, reason: "race_already_sent" };
  }

  console.info("[TicketEmail] Enviado com sucesso", {
    participantId,
    to: recipientEmail,
    ordemCompra: participant.ordemCompra,
  });

  return { sent: true };
}

/** Dispara envio sem bloquear o fluxo principal (webhook/pagamento). */
export function sendTicketConfirmationEmailAsync(participantId: string): void {
  void sendTicketConfirmationEmail(participantId).catch((err) => {
    console.error("[TicketEmail] Erro inesperado:", err, { participantId });
  });
}

/**
 * POST /api/my-tickets — solicita link mágico de acesso por e-mail.
 * GET  /api/my-tickets?token=... — lista inscrições do comprador via token assinado.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  createMyTicketsAccessToken,
  getMyTicketsAccessTtlMinutes,
  parseMyTicketsAccessToken,
} from "@/lib/my-tickets-access";
import {
  getEmailFromAddress,
  getResendClient,
  isEmailConfigured,
} from "@/lib/email/client";
import { getClientIp } from "@/lib/request-ip";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const requestBodySchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});
const querySchema = z.object({
  token: z.string().min(20, "Token inválido."),
});

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Aguardando pagamento",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Check-in realizado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

const EMAIL_COOLDOWN_MS = 60_000;
const EMAIL_WINDOW_MS = 15 * 60_000;
const EMAIL_WINDOW_LIMIT = 5;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({
      scope: "api:my-tickets:request-link",
      key: ip,
      limit: 8,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSec);
    }

    const body = await req.json();
    const parsed = requestBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.flatten().fieldErrors.email?.[0] ?? "E-mail inválido.",
        },
        { status: 422 }
      );
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const emailCooldown = await checkRateLimit({
      scope: "api:my-tickets:request-link:cooldown",
      key: normalizedEmail,
      limit: 1,
      windowMs: EMAIL_COOLDOWN_MS,
    });
    if (!emailCooldown.allowed) {
      return rateLimitResponse(emailCooldown.retryAfterSec);
    }

    const emailWindowRateLimit = await checkRateLimit({
      scope: "api:my-tickets:request-link:window",
      key: normalizedEmail,
      limit: EMAIL_WINDOW_LIMIT,
      windowMs: EMAIL_WINDOW_MS,
    });
    if (!emailWindowRateLimit.allowed) {
      return rateLimitResponse(emailWindowRateLimit.retryAfterSec);
    }

    const participantExists = await prisma.participant.findFirst({
      where: {
        user: { email: normalizedEmail },
        status: { in: ["REGISTERED", "CONFIRMED", "CHECKED_IN"] },
      },
      select: { id: true },
    });

    if (participantExists && isEmailConfigured()) {
      try {
        const resend = getResendClient();
        const token = createMyTicketsAccessToken(normalizedEmail);
        const accessUrl = `${getAppBaseUrl()}/meus-ingressos?t=${encodeURIComponent(token)}`;
        const ttlMinutes = getMyTicketsAccessTtlMinutes();

        await resend?.emails.send({
          from: getEmailFromAddress(),
          to: normalizedEmail,
          subject: "Seu link para acessar ingressos — EventosOmega",
          html: `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Acesse seus ingressos</h1>
    <p style="margin:0 0 16px;color:#374151;line-height:1.6;">
      Clique no botão abaixo para ver seus ingressos e status de pagamento.
      Este link expira em ${ttlMinutes} minutos.
    </p>
    <p style="margin:0 0 20px;">
      <a href="${accessUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
        Abrir meus ingressos
      </a>
    </p>
    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
      Se você não solicitou este acesso, pode ignorar este e-mail.
    </p>
  </div>
</body>
</html>`,
        });
      } catch (err) {
        console.error("[POST /api/my-tickets] Falha ao enviar link mágico", err);
      }
    }

    // Resposta uniforme para evitar enumeração por e-mail.
    return NextResponse.json({
      ok: true,
      message:
        "Se houver ingressos para este e-mail, enviamos um link de acesso.",
    });
  } catch (err) {
    console.error("[POST /api/my-tickets]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({
      scope: "api:my-tickets:fetch",
      key: ip,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSec);
    }

    const token = new URL(req.url).searchParams.get("token");
    const parsed = querySchema.safeParse({ token });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Link de acesso inválido." },
        { status: 422 }
      );
    }

    const tokenResult = parseMyTicketsAccessToken(parsed.data.token);
    if (!tokenResult.valid) {
      return NextResponse.json(
        {
          error: tokenResult.expired
            ? "Este link expirou. Solicite um novo acesso."
            : "Link de acesso inválido.",
        },
        { status: 401 }
      );
    }
    const accessEmail = tokenResult.email;
    if (!accessEmail) {
      return NextResponse.json({ error: "Link de acesso inválido." }, { status: 401 });
    }

    const participants = await prisma.participant.findMany({
      where: {
        user: { email: accessEmail },
        status: { in: ["REGISTERED", "CONFIRMED", "CHECKED_IN", "REFUNDED"] },
      },
      select: {
        id: true,
        ordemCompra: true,
        status: true,
        createdAt: true,
        event: {
          select: {
            title: true,
            slug: true,
            startDate: true,
            venue: true,
            city: true,
            state: true,
          },
        },
        ticketType: { select: { name: true, price: true } },
        transaction: { select: { status: true, grossValue: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      tickets: participants.map((p) => ({
        id: p.id,
        ordemCompra: p.ordemCompra,
        status: p.status,
        statusLabel: STATUS_LABEL[p.status] ?? p.status,
        eventTitle: p.event.title,
        eventSlug: p.event.slug,
        eventDate: p.event.startDate.toISOString(),
        venue: `${p.event.venue} · ${p.event.city}/${p.event.state}`,
        ticketName: p.ticketType.name,
        price: Number(p.ticketType.price),
        paymentStatus: p.transaction?.status ?? null,
        grossValue: p.transaction ? Number(p.transaction.grossValue) : 0,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET /api/my-tickets]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

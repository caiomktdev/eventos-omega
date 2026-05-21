/**
 * GET /api/my-tickets?email= — lista inscrições do comprador pelo e-mail.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Aguardando pagamento",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Check-in realizado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

export async function GET(req: Request) {
  try {
    const email = new URL(req.url).searchParams.get("email");
    const parsed = querySchema.safeParse({ email });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors.email?.[0] ?? "E-mail inválido." },
        { status: 422 }
      );
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const participants = await prisma.participant.findMany({
      where: { user: { email: normalizedEmail } },
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
        checkoutUrl:
          p.status === "REGISTERED" ? `/checkout/${p.id}` : null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/my-tickets]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

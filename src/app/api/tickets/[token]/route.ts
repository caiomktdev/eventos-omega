import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const VIEWABLE_STATUSES = new Set(["CONFIRMED", "CHECKED_IN"]);

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Token de ingresso inválido." }, { status: 422 });
  }

  const participant = await prisma.participant.findUnique({
    where: { checkInToken: token },
    select: {
      id: true,
      ordemCompra: true,
      status: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          venue: true,
          city: true,
          state: true,
          startDate: true,
          endDate: true,
        },
      },
      ticketType: { select: { name: true } },
      user: { select: { name: true, email: true } },
      formData: true,
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Ingresso não encontrado." }, { status: 404 });
  }

  if (!VIEWABLE_STATUSES.has(participant.status)) {
    return NextResponse.json(
      { error: "Ingresso ainda não está disponível para acesso." },
      { status: 409 }
    );
  }

  const formData = participant.formData as Record<string, unknown>;
  const holderName =
    String(formData?.nome ?? formData?.name ?? participant.user.name ?? "Participante");
  const holderEmail = String(formData?.email ?? participant.user.email ?? "");

  return NextResponse.json({
    id: participant.id,
    token,
    ordemCompra: participant.ordemCompra,
    status: participant.status,
    holderName,
    holderEmail,
    ticketName: participant.ticketType.name,
    event: {
      id: participant.event.id,
      title: participant.event.title,
      slug: participant.event.slug,
      venue: participant.event.venue,
      city: participant.event.city,
      state: participant.event.state,
      startDate: participant.event.startDate.toISOString(),
      endDate: participant.event.endDate.toISOString(),
    },
    issuedAt: participant.createdAt.toISOString(),
  });
}

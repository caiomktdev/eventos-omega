import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  canManageEvent,
  forbiddenResponse,
  requireEventManager,
  unauthorizedResponse,
} from "@/lib/event-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const payloadSchema = z
  .object({
    token: z.string().min(10).optional(),
    participantId: z.string().cuid().optional(),
  })
  .refine((data) => Boolean(data.token || data.participantId), {
    message: "Informe token ou participantId.",
  });

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const session = await requireEventManager();
    if (!session) return unauthorizedResponse();

    const canManage = await canManageEvent(session, eventId);
    if (!canManage) return forbiddenResponse();

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().formErrors[0] ?? "Payload inválido." },
        { status: 422 }
      );
    }

    const participant = await prisma.participant.findFirst({
      where: {
        eventId,
        ...(parsed.data.participantId
          ? { id: parsed.data.participantId }
          : { checkInToken: parsed.data.token }),
      },
      select: {
        id: true,
        ordemCompra: true,
        status: true,
        ticketType: { select: { name: true } },
        user: { select: { name: true, email: true } },
        formData: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Ingresso não encontrado para este evento." },
        { status: 404 }
      );
    }

    if (participant.status === "CHECKED_IN") {
      return NextResponse.json({
        checkedIn: true,
        alreadyCheckedIn: true,
        participantId: participant.id,
        ordemCompra: participant.ordemCompra,
      });
    }

    if (participant.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Apenas ingressos confirmados podem fazer check-in." },
        { status: 409 }
      );
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: { status: "CHECKED_IN" },
    });

    const formData = participant.formData as Record<string, unknown>;
    const participantName =
      String(formData?.nome ?? formData?.name ?? participant.user.name ?? "Participante");

    return NextResponse.json({
      checkedIn: true,
      alreadyCheckedIn: false,
      participantId: participant.id,
      participantName,
      ordemCompra: participant.ordemCompra,
      ticketName: participant.ticketType.name,
    });
  } catch (err) {
    console.error("[POST /api/admin/events/[id]/check-in]", err);
    return NextResponse.json(
      { error: "Erro interno ao processar check-in." },
      { status: 500 }
    );
  }
}

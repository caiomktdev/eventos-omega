/**
 * GET /api/participants/[id]/transaction
 *
 * Retorna o resumo da transação vinculada a uma inscrição.
 * Acesso permitido apenas para:
 *   - Admin/organizador com permissão sobre o evento
 *   - Comprador que informa o e-mail usado na inscrição (?email=)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEventManager,
  canManageParticipant,
} from "@/lib/event-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { id: participantId } = await params;
    const emailParam = new URL(req.url).searchParams.get("email");

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: {
        eventId: true,
        formData: true,
        user: { select: { email: true } },
        transaction: {
          select: {
            id: true,
            status: true,
            grossValue: true,
            mooveFee: true,
            organizerNetValue: true,
            paidAt: true,
          },
        },
      },
    });

    if (!participant?.transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada para este participante." },
        { status: 404 }
      );
    }

    const session = await requireEventManager();
    const isManager =
      session && (await canManageParticipant(session, participantId));

    const formEmail = String(
      (participant.formData as Record<string, unknown>).email ?? ""
    );
    const ownerEmail = participant.user.email;
    const emailMatch =
      emailParam &&
      [formEmail, ownerEmail].some(
        (candidate) =>
          candidate && normalizeEmail(candidate) === normalizeEmail(emailParam)
      );

    if (!isManager && !emailMatch) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const transaction = participant.transaction;

    if (isManager) {
      return NextResponse.json({
        id: transaction.id,
        status: transaction.status,
        grossValue: Number(transaction.grossValue),
        mooveFee: Number(transaction.mooveFee),
        organizerNetValue: Number(transaction.organizerNetValue),
        paidAt: transaction.paidAt?.toISOString() ?? null,
      });
    }

    return NextResponse.json({
      id: transaction.id,
      status: transaction.status,
      grossValue: Number(transaction.grossValue),
      paidAt: transaction.paidAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[GET /api/participants/[id]/transaction]", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar transação." },
      { status: 500 }
    );
  }
}

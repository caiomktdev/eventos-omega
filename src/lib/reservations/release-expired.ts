import { prisma } from "@/lib/prisma";

export interface ReleaseExpiredResult {
  released: number;
  participantIds: string[];
}

/**
 * Libera estoque de inscrições pagas abandonadas (Transaction PENDING expirada).
 * Idempotente por participante — ignora se status já mudou.
 */
export async function releaseExpiredReservations(
  now = new Date()
): Promise<ReleaseExpiredResult> {
  const expired = await prisma.transaction.findMany({
    where: {
      status: "PENDING",
      reservationExpiresAt: { lt: now },
      participant: { status: "REGISTERED" },
    },
    select: {
      id: true,
      participantId: true,
      participant: { select: { ticketTypeId: true } },
    },
    take: 200,
  });

  const participantIds: string[] = [];

  for (const tx of expired) {
    const released = await prisma.$transaction(async (db) => {
      const current = await db.participant.findUnique({
        where: { id: tx.participantId },
        select: { status: true, ticketTypeId: true },
      });

      if (!current || current.status !== "REGISTERED") return false;

      await db.transaction.update({
        where: { id: tx.id },
        data: {
          status: "CANCELLED",
          mercadoPagoPreferenceId: null,
        },
      });

      await db.participant.update({
        where: { id: tx.participantId },
        data: { status: "CANCELLED" },
      });

      await db.ticketType.update({
        where: { id: current.ticketTypeId },
        data: { soldQuantity: { decrement: 1 } },
      });

      return true;
    });

    if (released) participantIds.push(tx.participantId);
  }

  return { released: participantIds.length, participantIds };
}

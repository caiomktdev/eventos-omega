/**
 * Helpers de autorização para rotas admin de eventos.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export async function requireAdmin(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;
  return session;
}

export async function requireEventManager(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER") {
    return null;
  }
  return session;
}

export async function canManageEvent(
  session: Session,
  eventId: string
): Promise<boolean> {
  if (session.user.role === "ADMIN") return true;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });

  return event?.organizerId === session.user.id;
}

export async function canManageParticipant(
  session: Session,
  participantId: string
): Promise<boolean> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { eventId: true },
  });

  if (!participant) return false;
  return canManageEvent(session, participant.eventId);
}

export function unauthorizedResponse(message = "Não autorizado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Sem permissão.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** TTL da reserva de estoque para inscrições aguardando pagamento (30 min). */
export const RESERVATION_TTL_MS = 30 * 60 * 1000;

export function reservationExpiresAtFromNow(now = Date.now()): Date {
  return new Date(now + RESERVATION_TTL_MS);
}

export function isReservationActive(
  reservationExpiresAt: Date | null | undefined,
  now = new Date()
): boolean {
  if (!reservationExpiresAt) return false;
  return reservationExpiresAt.getTime() > now.getTime();
}

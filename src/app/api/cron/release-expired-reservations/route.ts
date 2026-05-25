/**
 * GET /api/cron/release-expired-reservations
 *
 * Cron Vercel (a cada 5 min) — libera estoque de reservas PENDING expiradas.
 * Protegido por CRON_SECRET (Bearer token).
 */

import { NextResponse } from "next/server";

import { releaseExpiredReservations } from "@/lib/reservations/release-expired";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await releaseExpiredReservations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/release-expired-reservations]", err);
    return NextResponse.json(
      { error: "Falha ao liberar reservas expiradas." },
      { status: 500 }
    );
  }
}

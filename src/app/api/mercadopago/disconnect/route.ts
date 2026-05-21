/**
 * POST /api/mercadopago/disconnect
 *
 * Remove a vinculação OAuth do Mercado Pago do organizador logado.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { disconnectOrganizerMercadoPago } from "@/lib/mercadopago-oauth";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  await disconnectOrganizerMercadoPago(session.user.id);

  return NextResponse.json({ success: true });
}

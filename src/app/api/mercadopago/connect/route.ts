/**
 * GET /api/mercadopago/connect
 *
 * Inicia o fluxo OAuth do Mercado Pago para o organizador logado.
 * Redireciona para a tela de autorização do MP.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildMercadoPagoAuthorizationUrl,
  createOAuthState,
} from "@/lib/mercadopago-oauth";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const state = createOAuthState(session.user.id);
    const cookieStore = await cookies();

    cookieStore.set("mp_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const authorizationUrl = buildMercadoPagoAuthorizationUrl(state);
    return NextResponse.redirect(authorizationUrl);
  } catch (err) {
    console.error("[GET /api/mercadopago/connect]", err);
    const message =
      err instanceof Error ? err.message : "Erro ao iniciar conexão.";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/dashboard?mp_error=${encodeURIComponent(message)}`
    );
  }
}

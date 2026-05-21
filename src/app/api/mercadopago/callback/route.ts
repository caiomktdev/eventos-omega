/**
 * GET /api/mercadopago/callback
 *
 * Callback OAuth do Mercado Pago — troca o authorization code por tokens
 * e persiste mercadoPagoUserId + access/refresh tokens no User.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  exchangeAuthorizationCode,
  parseOAuthState,
} from "@/lib/mercadopago-oauth";

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/dashboard`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${dashboardUrl}?mp_error=${encodeURIComponent("Autorização cancelada ou negada.")}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${dashboardUrl}?mp_error=${encodeURIComponent("Resposta OAuth inválida.")}`
    );
  }

  const parsedState = parseOAuthState(state);
  if (!parsedState) {
    return NextResponse.redirect(
      `${dashboardUrl}?mp_error=${encodeURIComponent("State OAuth inválido.")}`
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("mp_oauth_state")?.value;
  cookieStore.delete("mp_oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${dashboardUrl}?mp_error=${encodeURIComponent("Sessão OAuth expirada. Tente novamente.")}`
    );
  }

  try {
    await exchangeAuthorizationCode(code, parsedState.userId);
    return NextResponse.redirect(`${dashboardUrl}?mp_connected=1`);
  } catch (err) {
    console.error("[GET /api/mercadopago/callback]", err);
    const message =
      err instanceof Error
        ? err.message
        : "Erro ao conectar conta Mercado Pago.";
    return NextResponse.redirect(
      `${dashboardUrl}?mp_error=${encodeURIComponent(message)}`
    );
  }
}

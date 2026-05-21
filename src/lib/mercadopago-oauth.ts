/**
 * OAuth Mercado Pago — conexão de contas de organizadores (marketplace split).
 *
 * Fluxo:
 *  1. GET /api/mercadopago/connect → redireciona para auth MP
 *  2. GET /api/mercadopago/callback → troca code por tokens e persiste no User
 *  3. Checkout usa o access token do organizador + marketplace_fee (Moove 2%)
 *
 * Servidor only — nunca importar em Client Components.
 */

import { OAuth } from "mercadopago";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { getMpClient } from "@/lib/mercadopago";

// ---------------------------------------------------------------------------
// Configuração OAuth
// ---------------------------------------------------------------------------

export function getMercadoPagoRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/api/mercadopago/callback`;
}

function getOAuthCredentials() {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "[MercadoPago OAuth] MERCADOPAGO_CLIENT_ID e MERCADOPAGO_CLIENT_SECRET são obrigatórios."
    );
  }

  return { clientId, clientSecret };
}

export function buildMercadoPagoAuthorizationUrl(state: string): string {
  const { clientId } = getOAuthCredentials();
  const oauth = new OAuth(getMpClient());

  return oauth.getAuthorizationURL({
    options: {
      client_id: clientId,
      redirect_uri: getMercadoPagoRedirectUri(),
      state,
    },
  });
}

export function createOAuthState(userId: string): string {
  return `${userId}:${randomUUID()}`;
}

export function parseOAuthState(state: string): { userId: string; nonce: string } | null {
  const [userId, nonce] = state.split(":");
  if (!userId || !nonce) return null;
  return { userId, nonce };
}

// ---------------------------------------------------------------------------
// Troca de code / refresh
// ---------------------------------------------------------------------------

type OAuthTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  user_id?: number;
  expires_in?: number;
};

async function persistOrganizerTokens(
  userId: string,
  payload: OAuthTokenPayload
): Promise<void> {
  if (!payload.access_token || payload.user_id == null) {
    throw new Error("Resposta OAuth incompleta do Mercado Pago.");
  }

  const expiresAt =
    payload.expires_in != null
      ? new Date(Date.now() + payload.expires_in * 1000)
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      mercadoPagoUserId: String(payload.user_id),
      mercadoPagoAccessToken: payload.access_token,
      ...(payload.refresh_token
        ? { mercadoPagoRefreshToken: payload.refresh_token }
        : {}),
      mercadoPagoTokenExpiresAt: expiresAt,
    },
  });
}

export async function exchangeAuthorizationCode(
  code: string,
  userId: string
): Promise<void> {
  const { clientId, clientSecret } = getOAuthCredentials();
  const oauth = new OAuth(getMpClient());

  const payload = await oauth.create({
    body: {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getMercadoPagoRedirectUri(),
    },
  });

  await persistOrganizerTokens(userId, payload);
}

async function refreshOrganizerTokens(userId: string): Promise<OAuthTokenPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mercadoPagoRefreshToken: true },
  });

  if (!user?.mercadoPagoRefreshToken) {
    throw new Error("Refresh token não encontrado para o organizador.");
  }

  const { clientId, clientSecret } = getOAuthCredentials();
  const oauth = new OAuth(getMpClient());

  const payload = await oauth.refresh({
    body: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: user.mercadoPagoRefreshToken,
    },
  });

  await persistOrganizerTokens(userId, payload);
  return payload;
}

const TOKEN_REFRESH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias antes de expirar

function tokenNeedsRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Retorna access token válido do organizador para criar Preferences com split.
 * Renova automaticamente se próximo da expiração.
 */
export async function ensureOrganizerAccessToken(
  organizerId: string
): Promise<{ accessToken: string; mercadoPagoUserId: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: organizerId },
    select: {
      mercadoPagoUserId: true,
      mercadoPagoAccessToken: true,
      mercadoPagoRefreshToken: true,
      mercadoPagoTokenExpiresAt: true,
    },
  });

  if (!user?.mercadoPagoAccessToken || !user.mercadoPagoUserId) {
    return null;
  }

  if (
    user.mercadoPagoRefreshToken &&
    tokenNeedsRefresh(user.mercadoPagoTokenExpiresAt)
  ) {
    try {
      const refreshed = await refreshOrganizerTokens(organizerId);
      if (refreshed.access_token && refreshed.user_id != null) {
        return {
          accessToken: refreshed.access_token,
          mercadoPagoUserId: String(refreshed.user_id),
        };
      }
    } catch (err) {
      console.error("[MercadoPago OAuth] Falha ao renovar token:", err);
    }
  }

  return {
    accessToken: user.mercadoPagoAccessToken,
    mercadoPagoUserId: user.mercadoPagoUserId,
  };
}

export async function disconnectOrganizerMercadoPago(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mercadoPagoUserId: null,
      mercadoPagoAccessToken: null,
      mercadoPagoRefreshToken: null,
      mercadoPagoTokenExpiresAt: null,
    },
  });
}

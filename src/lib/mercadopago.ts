/**
 * Instância e helpers do SDK Mercado Pago (servidor only).
 *
 * Inicialização lazy — evita throw em build time (Next.js pré-renderiza
 * módulos durante `next build` antes de variáveis de ambiente estarem
 * disponíveis no contexto de execução).
 *
 * Nunca importe este módulo em Client Components.
 */

import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Lazy singleton — instanciado apenas na primeira requisição
// ---------------------------------------------------------------------------

let _client: MercadoPagoConfig | null = null;

/** Cliente MP da plataforma (Moove) — OAuth, webhooks, credenciais marketplace. */
export function getMpClient(): MercadoPagoConfig {
  if (_client) return _client;

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "[MercadoPago] MERCADOPAGO_ACCESS_TOKEN não está definido. " +
        "Configure a variável de ambiente antes de usar pagamentos."
    );
  }

  _client = new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 8000 },
  });

  return _client;
}

// ---------------------------------------------------------------------------
// Clients de recursos — instanciados via getter para aproveitar o singleton
// ---------------------------------------------------------------------------

export function getPreferenceClient(): Preference {
  return new Preference(getMpClient());
}

/** Preference client com token OAuth do organizador (split marketplace). */
export function getPreferenceClientForToken(accessToken: string): Preference {
  const config = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  });
  return new Preference(config);
}

export function getPaymentClient(): Payment {
  return new Payment(getMpClient());
}

/** Payment client com token OAuth do organizador (Checkout Bricks / split). */
export function getPaymentClientForToken(accessToken: string): Payment {
  const config = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  });
  return new Payment(config);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gera uma chave de idempotência única por tentativa de criação de recurso MP.
 * Formato: "<prefixo>:<id-estável>:<uuid-de-tentativa>"
 *
 * O UUID de tentativa garante que uma nova chamada após falha não seja bloqueada
 * pelo MP como duplicata do retry anterior.
 *
 * @param prefix    Prefixo identificando o tipo de recurso (ex: "pref", "pay")
 * @param stableId  ID estável do domínio (ex: participantId) — permite deduplicação
 */
export function buildIdempotencyKey(prefix: string, stableId: string): string {
  return `${prefix}:${stableId}:${randomUUID()}`;
}

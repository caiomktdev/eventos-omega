/**
 * Cliente Resend — envio de e-mails transacionais (servidor only).
 */

import { Resend } from "resend";

let _client: Resend | null = null;

export function getEmailFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "EventosOmega <onboarding@resend.dev>"
  );
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  if (!_client) {
    _client = new Resend(apiKey);
  }

  return _client;
}

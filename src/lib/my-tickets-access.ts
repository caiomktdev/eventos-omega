import { createHmac, timingSafeEqual } from "crypto";

const ACCESS_TTL_MS = 15 * 60 * 1000;

function getAccessSecret(): string {
  const secret =
    process.env.MY_TICKETS_ACCESS_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      "MY_TICKETS_ACCESS_SECRET (ou AUTH_SECRET/NEXTAUTH_SECRET) não configurado."
    );
  }

  return secret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function signPayload(payloadBase64Url: string): string {
  return createHmac("sha256", getAccessSecret())
    .update(payloadBase64Url)
    .digest("hex");
}

export function createMyTicketsAccessToken(email: string): string {
  const payload = {
    email: normalizeEmail(email),
    exp: Date.now() + ACCESS_TTL_MS,
  };
  const payloadBase64Url = Buffer.from(JSON.stringify(payload), "utf-8").toString(
    "base64url"
  );
  const signature = signPayload(payloadBase64Url);
  return `${payloadBase64Url}.${signature}`;
}

export function parseMyTicketsAccessToken(token: string): {
  valid: boolean;
  expired: boolean;
  email: string | null;
} {
  const [payloadBase64Url, providedSignature] = token.split(".");
  if (!payloadBase64Url || !providedSignature) {
    return { valid: false, expired: false, email: null };
  }

  const expectedSignature = signPayload(payloadBase64Url);
  try {
    const signatureMatches = timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedSignature, "hex")
    );
    if (!signatureMatches) {
      return { valid: false, expired: false, email: null };
    }
  } catch {
    return { valid: false, expired: false, email: null };
  }

  try {
    const payloadJson = Buffer.from(payloadBase64Url, "base64url").toString(
      "utf-8"
    );
    const payload = JSON.parse(payloadJson) as { email?: string; exp?: number };
    if (!payload.email || !payload.exp) {
      return { valid: false, expired: false, email: null };
    }

    const expired = Date.now() > payload.exp;
    if (expired) {
      return { valid: false, expired: true, email: null };
    }

    return { valid: true, expired: false, email: normalizeEmail(payload.email) };
  } catch {
    return { valid: false, expired: false, email: null };
  }
}

export function getMyTicketsAccessTtlMinutes(): number {
  return Math.round(ACCESS_TTL_MS / 60_000);
}

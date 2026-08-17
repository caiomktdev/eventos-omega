import { createHmac, timingSafeEqual } from "crypto";

function getCheckoutSecret(): string {
  const secret =
    process.env.CHECKOUT_ACCESS_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      "CHECKOUT_ACCESS_SECRET (ou AUTH_SECRET/NEXTAUTH_SECRET) não configurado."
    );
  }

  return secret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenPayload(participantId: string, email: string): string {
  return `${participantId}:${normalizeEmail(email)}`;
}

export function createCheckoutAccessToken(
  participantId: string,
  email: string
): string {
  const payload = tokenPayload(participantId, email);
  return createHmac("sha256", getCheckoutSecret()).update(payload).digest("hex");
}

export function verifyCheckoutAccessToken(params: {
  participantId: string;
  email: string;
  token: string;
}): boolean {
  const expected = createCheckoutAccessToken(params.participantId, params.email);

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(params.token, "hex")
    );
  } catch {
    return false;
  }
}

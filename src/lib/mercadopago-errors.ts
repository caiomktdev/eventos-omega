/**
 * Extrai mensagem legível de erros retornados pelo SDK Mercado Pago.
 */

type MercadoPagoApiError = {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{ code?: string; description?: string }>;
};

export function getMercadoPagoErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const mpErr = err as MercadoPagoApiError;
    const causeMessage = mpErr.cause?.find((c) => c.description)?.description;
    if (causeMessage) return causeMessage;
    if (mpErr.message) return mpErr.message;
    if (mpErr.error) return mpErr.error;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Erro ao processar pagamento no Mercado Pago.";
}

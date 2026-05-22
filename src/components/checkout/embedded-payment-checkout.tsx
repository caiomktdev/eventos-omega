"use client";

/**
 * Checkout embarcado — Payment Brick do Mercado Pago.
 * Cartão, PIX e boleto na página do EventosOmega (sem redirect ao Checkout Pro).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment, StatusScreen } from "@mercadopago/sdk-react";
import { AlertCircle, Loader2 } from "lucide-react";

import { PixPaymentDisplay } from "@/components/checkout/pix-payment-display";

interface EmbeddedPaymentCheckoutProps {
  participantId: string;
  amount: number;
  payerEmail: string;
  initialPreferenceId?: string | null;
  /** Pagamento PIX pendente já criado — exibe QR ao reabrir checkout */
  initialPaymentId?: string | null;
}

interface PixData {
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
}

interface ProcessPaymentResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  error?: string;
  detail?: string;
  pix?: PixData | null;
}

let mpInitialized = false;

function ensureMercadoPagoInit() {
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY não configurada.");
  }
  if (!mpInitialized) {
    initMercadoPago(publicKey);
    mpInitialized = true;
  }
}

function isPixPending(data: ProcessPaymentResponse): boolean {
  return (
    data.status === "pending" ||
    data.status === "in_process" ||
    data.payment_method_id === "pix" ||
    data.status_detail === "pending_waiting_transfer"
  );
}

export function EmbeddedPaymentCheckout({
  participantId,
  amount,
  payerEmail,
  initialPreferenceId,
  initialPaymentId,
}: EmbeddedPaymentCheckoutProps) {
  const router = useRouter();
  const [preferenceId, setPreferenceId] = useState<string | null>(
    initialPreferenceId ?? null
  );
  const [statusPaymentId, setStatusPaymentId] = useState<string | null>(
    initialPaymentId ?? null
  );
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(!initialPreferenceId && !initialPaymentId);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      ensureMercadoPagoInit();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao inicializar Mercado Pago."
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (preferenceId || statusPaymentId) return;

    let cancelled = false;

    async function createPreference() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Erro ao preparar pagamento.");
        }

        if (!cancelled) {
          setPreferenceId(data.preferenceId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao preparar pagamento."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void createPreference();

    return () => {
      cancelled = true;
    };
  }, [participantId, preferenceId, statusPaymentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Preparando pagamento seguro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!preferenceId && !statusPaymentId) return null;

  if (statusPaymentId) {
    if (pixData?.qr_code || pixData?.qr_code_base64) {
      return (
        <PixPaymentDisplay
          qrCode={pixData.qr_code}
          qrCodeBase64={pixData.qr_code_base64}
          ticketUrl={pixData.ticket_url}
        />
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Escaneie o QR Code ou copie o código PIX abaixo para concluir o pagamento.
        </p>
        <StatusScreen
          initialization={{ paymentId: statusPaymentId }}
          customization={{
            visual: {
              hidePixQrCode: false,
            },
            backUrls: {
              return: `/payment/success?payment_id=${statusPaymentId}&external_reference=${participantId}`,
            },
          }}
          locale="pt-BR"
          onError={(err) => {
            console.error("[StatusScreen Brick]", err);
            setError(
              "Não foi possível exibir o QR Code PIX. Tente recarregar a página."
            );
            setStatusPaymentId(null);
          }}
        />
      </div>
    );
  }

  if (!preferenceId) return null;

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        No PIX: informe o e-mail e clique em pagar. Em seguida, o QR Code e o
        código copia e cola aparecerão nesta página.
      </p>

      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {!ready && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando formas de pagamento...
        </div>
      )}

      <Payment
        initialization={{
          amount,
          preferenceId,
          marketplace: true,
          payer: payerEmail ? { email: payerEmail } : undefined,
        }}
        customization={{
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            bankTransfer: "all",
            ticket: "all",
            mercadoPago: "all",
          },
        }}
        locale="pt-BR"
        onReady={() => setReady(true)}
        onError={(err) => {
          console.error("[Payment Brick]", err);
          setError(
            "Não foi possível carregar o checkout. Tente recarregar a página."
          );
        }}
        onSubmit={async ({ formData }) => {
          setSubmitError(null);
          let failureMessage: string | null = null;

          try {
            const res = await fetch("/api/payments/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ participantId, formData }),
            });

            const data = (await res.json()) as ProcessPaymentResponse;

            if (!res.ok) {
              failureMessage =
                data.error ??
                data.detail ??
                "Não foi possível processar o pagamento.";
              throw new Error(failureMessage);
            }

            if (!data.id) {
              failureMessage =
                "Pagamento criado sem identificador. Tente novamente.";
              throw new Error(failureMessage);
            }

            const paymentId = String(data.id);

            if (data.status === "approved") {
              router.push(
                `/payment/success?payment_id=${paymentId}&external_reference=${participantId}`
              );
              return;
            }

            if (isPixPending(data)) {
              setPixData(data.pix ?? null);
              setStatusPaymentId(paymentId);
              return;
            }

            failureMessage =
              data.status_detail === "cc_rejected_other_reason"
                ? "Pagamento recusado. Verifique os dados ou tente outro meio."
                : "Pagamento não aprovado. Tente outro meio de pagamento.";
            throw new Error(failureMessage);
          } catch (err) {
            if (!failureMessage && err instanceof Error) {
              failureMessage = err.message;
            }
            if (failureMessage) {
              setSubmitError(failureMessage);
            }
            throw err instanceof Error
              ? err
              : new Error(failureMessage ?? "Erro ao processar pagamento.");
          }
        }}
      />
    </div>
  );
}

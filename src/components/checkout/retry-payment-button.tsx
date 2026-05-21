"use client";

/**
 * RetryPaymentButton — Client Component para retentar o pagamento.
 *
 * Chama POST /api/checkout com o participantId existente.
 * O servidor recalcula os valores financeiros e retorna um novo initPoint MP.
 * O cliente NUNCA envia valores monetários — eles são recalculados no backend.
 */

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RetryPaymentButtonProps {
  participantId: string;
}

export function RetryPaymentButton({ participantId }: RetryPaymentButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRetry() {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId }),
        });

        const data = await res.json();

        if (!res.ok) {
          // 409 = transação já aprovada
          if (res.status === 409) {
            setError(
              "Este ingresso já foi pago. Verifique seus e-mails de confirmação."
            );
            return;
          }
          throw new Error(data.error ?? "Erro ao gerar link de pagamento.");
        }

        if (!data.initPoint) {
          throw new Error("Link de pagamento inválido retornado pelo servidor.");
        }

        // Redireciona para o Mercado Pago (URL externa)
        window.location.assign(data.initPoint);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro inesperado."
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleRetry}
        disabled={isPending}
        size="lg"
        className="w-full h-12 text-base font-semibold"
      >
        {isPending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Gerando link de pagamento...
          </>
        ) : (
          <>
            <RefreshCw className="h-5 w-5" />
            Tentar pagamento novamente
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

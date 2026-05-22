"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PixPaymentDisplayProps {
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl?: string | null;
}

export function PixPaymentDisplay({
  qrCode,
  qrCodeBase64,
  ticketUrl,
}: PixPaymentDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!qrCode) return;
    await navigator.clipboard.writeText(qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <p className="text-center text-sm text-muted-foreground">
        Escaneie o QR Code ou copie o código PIX abaixo para concluir o pagamento.
      </p>

      {qrCodeBase64 && (
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code PIX"
            className="h-52 w-52 rounded-lg border bg-white p-2"
          />
        </div>
      )}

      {qrCode && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Código copia e cola
          </p>
          <div className="rounded-lg border bg-background p-3">
            <p className="break-all font-mono text-xs leading-relaxed">{qrCode}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Código copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar código PIX
              </>
            )}
          </Button>
        </div>
      )}

      {ticketUrl && (
        <p className="text-center text-xs text-muted-foreground">
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Abrir pagamento no Mercado Pago
          </a>
        </p>
      )}
    </div>
  );
}

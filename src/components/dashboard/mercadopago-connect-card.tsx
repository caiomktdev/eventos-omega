/**
 * Card de conexão Mercado Pago no dashboard do organizador.
 * Split marketplace: organizador recebe 98%, Moove retém 2% via marketplace_fee.
 */

import Link from "next/link";
import { AlertCircle, CheckCircle2, CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MercadoPagoDisconnectButton } from "@/components/dashboard/mercadopago-disconnect-button";

interface MercadoPagoConnectCardProps {
  connected: boolean;
  mercadoPagoUserId: string | null;
  feedback?: { type: "success" | "error"; message: string } | null;
}

function maskMpUserId(userId: string): string {
  if (userId.length <= 4) return userId;
  return `••••${userId.slice(-4)}`;
}

export function MercadoPagoConnectCard({
  connected,
  mercadoPagoUserId,
  feedback,
}: MercadoPagoConnectCardProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="h-4 w-4 text-primary" />
              Recebimentos Mercado Pago
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-relaxed">
              Conecte sua conta para receber pagamentos de ingressos. A Moove
              retém automaticamente 2% por venda; o restante é repassado para
              você pelo Mercado Pago.
            </CardDescription>
          </div>
          {connected ? (
            <Badge
              variant="secondary"
              className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              Pendente
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {feedback && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {feedback.type === "error" && (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {feedback.type === "success" && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {connected && mercadoPagoUserId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Conta vinculada
              </p>
              <p className="text-xs text-muted-foreground">
                ID Mercado Pago: {maskMpUserId(mercadoPagoUserId)}
              </p>
            </div>
            <MercadoPagoDisconnectButton />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-amber-950">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Eventos com ingressos pagos só aceitam pagamento depois que você
                conectar sua conta Mercado Pago.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/api/mercadopago/connect">Conectar Mercado Pago</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

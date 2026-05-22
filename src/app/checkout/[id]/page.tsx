/**
 * /checkout/[id] — Página de retentativa de pagamento.
 *
 * Recebe o participantId (external_reference retornado pelo Mercado Pago
 * nas back_urls de failure). Exibe os dados da inscrição e permite ao
 * usuário retentar o pagamento sem perder os dados já preenchidos.
 *
 * Estados possíveis:
 *   APPROVED      → inscrição já confirmada, exibe sucesso
 *   PENDING       → aguardando pagamento (gera novo link MP)
 *   REJECTED /
 *   CANCELLED /
 *   IN_PROCESS    → permite retentar
 *
 * O recálculo financeiro (mooveFee 2%) ocorre SEMPRE no servidor
 * em /api/checkout — nunca no cliente.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Ticket,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { formatCurrency, getMooveFeePercentLabel } from "@/lib/fee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmbeddedPaymentCheckout } from "@/components/checkout/embedded-payment-checkout";
import { EventCoverImage } from "@/components/events/event-cover-image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getCheckoutData(participantId: string) {
  return prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      ordemCompra: true,
      status: true,
      formData: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          venue: true,
          city: true,
          state: true,
          startDate: true,
        },
      },
      ticketType: {
        select: { id: true, name: true, price: true },
      },
      transaction: {
        select: {
          id: true,
          status: true,
          grossValue: true,
          mooveFee: true,
          organizerNetValue: true,
          paidAt: true,
          mercadoPagoPreferenceId: true,
          mercadoPagoPaymentId: true,
          paymentMethod: true,
        },
      },
    },
  });
}

// ── Metadata dinâmica ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getCheckoutData(id);
  if (!data) return { title: "Inscrição não encontrada" };
  return { title: `Checkout — ${data.event.title}` };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Status label e cor para a transação */
function txStatusLabel(status: string): { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default" | "outline" } {
  switch (status) {
    case "APPROVED":      return { label: "Pago ✓",          variant: "success" };
    case "PENDING":       return { label: "Aguardando",       variant: "warning" };
    case "IN_PROCESS":    return { label: "Em processamento", variant: "warning" };
    case "REJECTED":      return { label: "Recusado",         variant: "destructive" };
    case "CANCELLED":     return { label: "Cancelado",        variant: "destructive" };
    case "REFUNDED":      return { label: "Estornado",        variant: "secondary" };
    case "CHARGED_BACK":  return { label: "Chargeback",       variant: "destructive" };
    default:              return { label: status,             variant: "secondary" };
  }
}

const RETRYABLE_STATUSES = new Set([
  "PENDING", "REJECTED", "CANCELLED", "IN_PROCESS", "IN_MEDIATION",
]);

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CheckoutRetryPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getCheckoutData(id);

  if (!data) notFound();

  const { event, ticketType, transaction } = data;
  const txStatus = transaction?.status ?? "PENDING";
  const isApproved = txStatus === "APPROVED";
  const canRetry   = RETRYABLE_STATUSES.has(txStatus);
  const eventDate  = new Date(event.startDate);

  // Nome do participante (campo nome no formData)
  const formData = data.formData as Record<string, string> | null;
  const participantName = formData?.nome ?? formData?.name ?? "Participante";
  const payerEmail = formData?.email ?? "";
  const mooveFeePercentLabel = getMooveFeePercentLabel();

  const { label: statusLabel, variant: statusVariant } = txStatusLabel(txStatus);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto max-w-2xl px-4 py-12">

        {/* Voltar */}
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5 text-muted-foreground">
          <Link href={`/event/${event.slug}`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para o evento
          </Link>
        </Button>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">

          {/* Capa do evento — miniatura */}
          {event.coverImage && (
            <div className="relative h-40 w-full overflow-hidden bg-muted">
              <EventCoverImage
                src={event.coverImage}
                alt={event.title}
                fill
                sizes="672px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
            </div>
          )}

          <div className="px-6 py-6 space-y-6">

            {/* Estado: APROVADO */}
            {isApproved && (
              <div className="flex flex-col items-center gap-4 text-center py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-green-700">
                    Pagamento Confirmado!
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sua inscrição em{" "}
                    <strong className="text-foreground">{event.title}</strong>{" "}
                    está confirmada.
                  </p>
                </div>
                <div className="rounded-xl bg-muted/60 px-8 py-4">
                  <p className="text-xs text-muted-foreground">
                    Número da inscrição
                  </p>
                  <p className="text-3xl font-bold font-mono tracking-widest mt-1">
                    #{String(data.ordemCompra).padStart(5, "0")}
                  </p>
                </div>
                {transaction?.paidAt && (
                  <p className="text-xs text-muted-foreground">
                    Pago em{" "}
                    {format(new Date(transaction.paidAt), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}
                <Button asChild variant="outline" className="mt-2">
                  <Link href="/">Ver outros eventos</Link>
                </Button>
              </div>
            )}

            {/* Estado: PENDENTE / REJEITADO / CANCELADO */}
            {!isApproved && (
              <>
                {/* Alerta de status */}
                {(txStatus === "REJECTED" || txStatus === "CANCELLED") && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3.5 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-400">
                        Pagamento não concluído
                      </p>
                      <p className="text-amber-700 dark:text-amber-500 mt-0.5">
                        Nenhum valor foi cobrado. Você pode tentar novamente abaixo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Info da inscrição */}
                <div>
                  <h1 className="text-xl font-bold">Finalizar pagamento</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Olá, <strong>{participantName}</strong>! Complete o pagamento
                    para confirmar sua inscrição.
                  </p>
                </div>

                <Separator />

                {/* Detalhes do evento */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Resumo da inscrição
                  </h2>

                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    {/* Evento */}
                    <div className="flex items-start gap-3">
                      <Ticket className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ticketType.name}
                        </p>
                      </div>
                      <Badge
                        variant={statusVariant}
                        className="ml-auto shrink-0 text-[10px]"
                      >
                        {statusLabel}
                      </Badge>
                    </div>

                    <Separator className="my-1" />

                    {/* Data */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {format(
                          eventDate,
                          "EEEE',' dd 'de' MMM 'às' HH:mm",
                          { locale: ptBR }
                        ).replace(/^./, (c) => c.toUpperCase())}
                      </span>
                    </div>

                    {/* Local */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {event.venue} · {event.city}/{event.state}
                      </span>
                    </div>

                    {/* Número da inscrição */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Inscrição #{String(data.ordemCompra).padStart(5, "0")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resumo financeiro */}
                {transaction && (
                  <div className="rounded-xl bg-muted/40 px-4 py-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ingresso</span>
                      <span>
                        {Number(transaction.grossValue) === 0
                          ? "Gratuito"
                          : formatCurrency(Number(transaction.grossValue))}
                      </span>
                    </div>
                    {Number(transaction.grossValue) > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Taxa de serviço ({mooveFeePercentLabel})</span>
                        <span>{formatCurrency(Number(transaction.mooveFee))}</span>
                      </div>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold">
                      <span>Total a pagar</span>
                      <span className="text-primary">
                        {Number(transaction.grossValue) === 0
                          ? "Gratuito"
                          : formatCurrency(Number(transaction.grossValue))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Checkout embarcado — Payment Brick */}
                {canRetry && transaction && Number(transaction.grossValue) > 0 && (
                  <EmbeddedPaymentCheckout
                    participantId={data.id}
                    amount={Number(transaction.grossValue)}
                    payerEmail={payerEmail}
                    initialPreferenceId={transaction.mercadoPagoPreferenceId}
                    initialPaymentId={
                      transaction.mercadoPagoPaymentId &&
                      (transaction.status === "PENDING" ||
                        transaction.status === "IN_PROCESS")
                        ? transaction.mercadoPagoPaymentId
                        : null
                    }
                  />
                )}

                {canRetry && (!transaction || Number(transaction.grossValue) === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Não há valor pendente para este ingresso.
                  </p>
                )}

                {!canRetry && (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Esta inscrição não pode ser reprocessada (status:{" "}
                      <strong>{txStatus}</strong>).
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/">Ver outros eventos</Link>
                    </Button>
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  O pagamento é processado com segurança pelo Mercado Pago.
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

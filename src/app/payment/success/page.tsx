/**
 * Página de sucesso após pagamento aprovado pelo Mercado Pago.
 * Lê o payment_id da query string para exibir confirmação.
 */

import Link from "next/link";
import { CheckCircle2, Ticket, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

interface PaymentSuccessPageProps {
  searchParams: Promise<{
    payment_id?: string;
    status?: string;
    external_reference?: string;
  }>;
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const { payment_id, external_reference } = await searchParams;
  const participant = external_reference
    ? await prisma.participant.findUnique({
        where: { id: external_reference },
        select: {
          status: true,
          checkInToken: true,
          transaction: {
            select: {
              status: true,
              mercadoPagoPaymentId: true,
            },
          },
        },
      })
    : null;

  const paymentMatches =
    !payment_id ||
    participant?.transaction?.mercadoPagoPaymentId === payment_id ||
    participant?.transaction?.status === "APPROVED";
  const isConfirmed =
    participant?.status === "CONFIRMED" || participant?.status === "CHECKED_IN";
  const verifiedSuccess = Boolean(participant && isConfirmed && paymentMatches);

  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <Card className="text-center shadow-lg">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-6">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-green-700">
              {verifiedSuccess ? "Pagamento Confirmado!" : "Pagamento em validação"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {verifiedSuccess
                ? "Seu ingresso foi confirmado com sucesso."
                : "Estamos aguardando a confirmação final do pagamento pelo provedor."}
            </p>
          </div>

          {payment_id && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
              <p className="text-muted-foreground">ID do Pagamento</p>
              <p className="font-mono font-medium">{payment_id}</p>
              {external_reference && (
                <>
                  <p className="text-muted-foreground mt-2">Pedido</p>
                  <p className="font-mono font-medium">{external_reference}</p>
                </>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Guarde o número do pedido exibido na confirmação. Você também pode
            consultar seus ingressos em{" "}
            <Link href="/meus-ingressos" className="text-primary hover:underline">
              Meus ingressos
            </Link>{" "}
            usando o e-mail da inscrição.
          </p>

          {verifiedSuccess && participant?.checkInToken && (
            <Button asChild variant="secondary">
              <Link href={`/ingresso/${participant.checkInToken}`}>Abrir ingresso digital</Link>
            </Button>
          )}

          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/">
                <Ticket className="h-4 w-4" />
                Ver mais eventos
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

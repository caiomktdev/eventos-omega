/**
 * Página de sucesso após pagamento aprovado pelo Mercado Pago.
 * Lê o payment_id da query string para exibir confirmação.
 */

import Link from "next/link";
import { CheckCircle2, Ticket, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
              Pagamento Confirmado!
            </h1>
            <p className="text-muted-foreground mt-2">
              Seus ingressos foram reservados com sucesso.
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

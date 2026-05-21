/**
 * Página exibida quando o Mercado Pago redireciona para a back_url de failure.
 *
 * O query param external_reference = participantId (setado em /api/checkout).
 * Com ele, redirecionamos o usuário para /checkout/[participantId] onde pode
 * retentar o pagamento sem perder os dados do formulário de inscrição.
 */

import Link from "next/link";
import { XCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PaymentFailurePageProps {
  searchParams: Promise<{
    external_reference?: string;
    payment_id?: string;
    status?: string;
  }>;
}

export default async function PaymentFailurePage({
  searchParams,
}: PaymentFailurePageProps) {
  const { external_reference } = await searchParams;

  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <Card className="text-center shadow-lg">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-6">
              <XCircle className="h-16 w-16 text-red-500" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-red-600">
              Pagamento não concluído
            </h1>
            <p className="text-muted-foreground mt-2">
              Não foi possível processar seu pagamento. Nenhum valor foi
              cobrado.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2 text-left">
            <p className="font-medium">Possíveis motivos:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Cartão sem limite suficiente</li>
              <li>Dados do cartão incorretos</li>
              <li>Pagamento cancelado pelo usuário</li>
              <li>Problema temporário no processador</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            {/* Retry: redireciona para /checkout/[participantId] */}
            {external_reference && (
              <Button asChild>
                <Link href={`/checkout/${external_reference}`}>
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Link>
              </Button>
            )}

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

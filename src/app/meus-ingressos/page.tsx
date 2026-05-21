import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { MyTicketsLookup } from "@/components/tickets/my-tickets-lookup";

export const metadata: Metadata = {
  title: "Meus ingressos",
};

export default function MyTicketsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-muted/40 via-background to-background">
      <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-12">
        <header className="mb-8 space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Ticket className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Meus ingressos
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Informe o e-mail usado na inscrição para consultar seus pedidos,
            status de pagamento e número de ordem de compra.
          </p>
        </header>
        <MyTicketsLookup />
      </div>
    </div>
  );
}

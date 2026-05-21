"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Mail, Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/fee";

interface TicketRow {
  id: string;
  ordemCompra: number;
  status: string;
  statusLabel: string;
  eventTitle: string;
  eventSlug: string;
  eventDate: string;
  venue: string;
  ticketName: string;
  price: number;
  grossValue: number;
  checkoutUrl: string | null;
}

export function MyTicketsLookup() {
  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(false);

    try {
      const res = await fetch(
        `/api/my-tickets?email=${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível buscar seus ingressos.");
      }
      setTickets(data.tickets ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setTickets([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSearch} className="mx-auto max-w-md space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail usado na inscrição
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Buscar ingressos
        </Button>
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </form>

      {searched && tickets.length === 0 && !error && (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
          Nenhuma inscrição encontrada para este e-mail.
        </div>
      )}

      {tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{ticket.eventTitle}</h2>
                    <Badge variant="secondary">{ticket.statusLabel}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ticket.venue}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(ticket.eventDate), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-mono text-muted-foreground">
                    #{String(ticket.ordemCompra).padStart(5, "0")}
                  </p>
                  <p className="font-medium">{ticket.ticketName}</p>
                  <p className="tabular-nums">
                    {ticket.price > 0
                      ? formatCurrency(ticket.grossValue)
                      : "Gratuito"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/event/${ticket.eventSlug}`}>Ver evento</Link>
                </Button>
                {ticket.checkoutUrl && (
                  <Button asChild size="sm">
                    <Link href={ticket.checkoutUrl}>Concluir pagamento</Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

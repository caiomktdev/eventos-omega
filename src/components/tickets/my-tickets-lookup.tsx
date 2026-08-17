"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Loader2, Mail, Search } from "lucide-react";
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
}

export function MyTicketsLookup() {
  const searchParams = useSearchParams();
  const accessToken = useMemo(() => searchParams.get("t"), [searchParams]);

  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [requestedLink, setRequestedLink] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setLoadingRequest(true);
    setError(null);
    setRequestedLink(false);
    setRequestMessage(null);

    try {
      const res = await fetch("/api/my-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível solicitar o link.");
      }

      setRequestedLink(true);
      setRequestMessage(
        data.message ??
          "Se houver ingressos para este e-mail, enviamos um link de acesso."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoadingRequest(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchTicketsByToken(token: string) {
      setLoadingTickets(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/my-tickets?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error ??
              "Não foi possível carregar seus ingressos com este link."
          );
        }
        if (!cancelled) {
          setTickets(data.tickets ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro desconhecido.");
          setTickets([]);
        }
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    }

    if (accessToken) {
      void fetchTicketsByToken(accessToken);
    } else {
      setTickets([]);
      setLoadingTickets(false);
    }

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="space-y-8">
      <form onSubmit={handleRequestLink} className="mx-auto max-w-md space-y-4">
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
              disabled={loadingRequest}
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loadingRequest}>
          {loadingRequest ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Enviar link de acesso
        </Button>
        {requestedLink && requestMessage && (
          <p className="text-sm text-center text-emerald-700 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {requestMessage}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </form>

      {loadingTickets && (
        <div className="flex items-center justify-center gap-2 rounded-xl border px-6 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando seus ingressos...
        </div>
      )}

      {accessToken && !loadingTickets && tickets.length === 0 && !error && (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
          Nenhuma inscrição ativa encontrada para este acesso.
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
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Por segurança, links de pagamento e ingresso digital são enviados apenas por e-mail.
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * /admin — Listagem de todos os eventos com métricas e ações rápidas.
 * Server Component: busca dados diretamente via Prisma.
 */

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  CalendarDays,
  Users,
  DollarSign,
  TrendingUp,
  Eye,
  Pencil,
  StopCircle,
  MoreHorizontal,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/fee";
import { EventStatusActions } from "@/components/admin/event-status-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Eventos" };

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT:      { label: "Rascunho",  variant: "secondary" },
  PUBLISHED:  { label: "Publicado", variant: "default" },
  CANCELLED:  { label: "Cancelado", variant: "destructive" },
  FINISHED:   { label: "Encerrado", variant: "outline" },
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getAdminData() {
  const events = await prisma.event.findMany({
    include: {
      organizer: { select: { name: true } },
      ticketTypes: { select: { price: true, totalQuantity: true, soldQuantity: true } },
      _count: { select: { participants: true } },
      participants: {
        where: { status: "CONFIRMED" },
        select: {
          transaction: { select: { grossValue: true, mooveFee: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = events.reduce(
    (acc, e) => {
      const rev = e.participants.reduce(
        (s, p) => s + Number(p.transaction?.grossValue ?? 0), 0
      );
      const fees = e.participants.reduce(
        (s, p) => s + Number(p.transaction?.mooveFee ?? 0), 0
      );
      acc.revenue += rev;
      acc.mooveFees += fees;
      acc.participants += e._count.participants;
      if (e.status === "PUBLISHED") acc.published++;
      return acc;
    },
    { revenue: 0, mooveFees: 0, participants: 0, published: 0 }
  );

  return { events, totals };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminPage() {
  const { events, totals } = await getAdminData();

  const summaryCards = [
    { label: "Receita Total", value: formatCurrency(totals.revenue), icon: DollarSign, sub: `Taxa Moove: ${formatCurrency(totals.mooveFees)}` },
    { label: "Participantes", value: String(totals.participants), icon: Users, sub: "em todos os eventos" },
    { label: "Eventos Ativos", value: String(totals.published), icon: TrendingUp, sub: "publicados" },
    { label: "Total de Eventos", value: String(events.length), icon: CalendarDays, sub: "incluindo rascunhos" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Painel de Eventos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie todos os eventos, formulários e participantes.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4" />
            Novo Evento
          </Link>
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Tabela de eventos */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Todos os Eventos</h2>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum evento cadastrado ainda.</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/admin/events/new">Criar primeiro evento</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">Evento</th>
                    <th className="px-4 py-3.5 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-3.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3.5 text-left font-medium text-muted-foreground">Participantes</th>
                    <th className="px-4 py-3.5 text-left font-medium text-muted-foreground">Receita</th>
                    <th className="px-4 py-3.5 text-left font-medium text-muted-foreground">Formulário</th>
                    <th className="px-4 py-3.5 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => {
                    const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.DRAFT;
                    const revenue = event.participants.reduce(
                      (s, p) => s + Number(p.transaction?.grossValue ?? 0), 0
                    );
                    const formStructure = event.formStructure as { fields?: unknown[] } | null;
                    const extraFieldsCount = formStructure?.fields?.length ?? 0;
                    const confirmedCount = event.participants.length;
                    const totalCapacity = event.ticketTypes.reduce(
                      (s, t) => s + t.totalQuantity, 0
                    );
                    const soldCount = event.ticketTypes.reduce(
                      (s, t) => s + t.soldQuantity, 0
                    );

                    return (
                      <tr key={event.id} className="hover:bg-muted/20 transition-colors group">
                        {/* Evento */}
                        <td className="px-5 py-4 max-w-[220px]">
                          <p className="font-semibold leading-tight truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {event.venue} · {event.city}/{event.state}
                          </p>
                        </td>

                        {/* Data */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="text-xs">
                            {format(new Date(event.startDate), "dd MMM yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.startDate), "HH:mm", { locale: ptBR })}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </td>

                        {/* Participantes */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="font-medium">{soldCount} / {totalCapacity}</p>
                          <p className="text-xs text-muted-foreground">
                            {confirmedCount} confirmado{confirmedCount !== 1 ? "s" : ""}
                          </p>
                        </td>

                        {/* Receita */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="font-medium">{formatCurrency(revenue)}</p>
                        </td>

                        {/* Formulário */}
                        <td className="px-4 py-4">
                          <Badge variant="secondary" className="text-xs">
                            {extraFieldsCount} campo{extraFieldsCount !== 1 ? "s" : ""} extra{extraFieldsCount !== 1 ? "s" : ""}
                          </Badge>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes">
                              <Link href={`/admin/events/${event.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Editar evento">
                              <Link href={`/admin/events/${event.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            {event.status === "PUBLISHED" && (
                              <EventStatusActions
                                eventId={event.id}
                                currentStatus={event.status}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

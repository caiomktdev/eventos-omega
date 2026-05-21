/**
 * /admin/dashboard — Dashboard Financeiro da Plataforma
 *
 * Exibe os 4 KPIs financeiros da Moove (baseados EXCLUSIVAMENTE em transações
 * com status APPROVED) e o ranking de eventos por receita gerada.
 *
 * Suporta filtro por evento via query param ?eventId=<id>:
 *   - Sem filtro → métricas consolidadas de toda a plataforma
 *   - Com filtro → métricas isoladas do evento selecionado
 *
 * O ranking de eventos é sempre global (todos os eventos), para manter
 * o contexto de comparação independentemente do filtro ativo.
 */

import Link from "next/link";
import { Suspense } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  BarChart3,
  Trophy,
  ExternalLink,
  Info,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/fee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EventFilter } from "@/components/admin/event-filter";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard Financeiro | Admin" };

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{ eventId?: string }>;
}

interface EventRankingRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  confirmedCount: number;
  grossRevenue: number;
  totalMooveFee: number;
  totalOrganizerNet: number;
  pctOfTotal: number;
}

// ---------------------------------------------------------------------------
// Data fetching — server side (single round-trip)
// ---------------------------------------------------------------------------

async function getDashboardData(filterEventId?: string) {
  const txWhere = {
    status: "APPROVED" as const,
    ...(filterEventId
      ? { participant: { eventId: filterEventId } }
      : {}),
  };

  // KPIs + ranking buscados em paralelo para reduzir latência
  const [txAggregate, approvedCount, allEventsWithMetrics, eventOptions] =
    await Promise.all([
      // Soma dos campos financeiros nas transações aprovadas (filtradas)
      prisma.transaction.aggregate({
        where: txWhere,
        _sum: { grossValue: true, mooveFee: true, organizerNetValue: true },
        _count: { id: true },
      }),

      // Contagem de participantes com transação aprovada (filtrada)
      prisma.participant.count({
        where: {
          transaction: { status: "APPROVED" },
          ...(filterEventId ? { eventId: filterEventId } : {}),
        },
      }),

      // Ranking: todos os eventos (sempre global) com participantes aprovados
      prisma.event.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startDate: true,
          participants: {
            where: { transaction: { status: "APPROVED" } },
            select: {
              transaction: {
                select: {
                  grossValue: true,
                  mooveFee: true,
                  organizerNetValue: true,
                },
              },
            },
          },
        },
        orderBy: { startDate: "desc" },
      }),

      // Opções do seletor de evento
      prisma.event.findMany({
        select: { id: true, title: true, status: true },
        orderBy: { startDate: "desc" },
      }),
    ]);

  // Receita total global (para calcular % de cada evento no ranking)
  const totalGrossGlobal = allEventsWithMetrics.reduce(
    (sum, e) =>
      sum +
      e.participants.reduce(
        (s, p) => s + Number(p.transaction?.grossValue ?? 0),
        0
      ),
    0
  );

  // Monta o ranking ordenado por receita bruta decrescente
  const ranking: EventRankingRow[] = allEventsWithMetrics
    .map((e) => {
      const gross = e.participants.reduce(
        (s, p) => s + Number(p.transaction?.grossValue ?? 0),
        0
      );
      const moove = e.participants.reduce(
        (s, p) => s + Number(p.transaction?.mooveFee ?? 0),
        0
      );
      const org = e.participants.reduce(
        (s, p) => s + Number(p.transaction?.organizerNetValue ?? 0),
        0
      );
      return {
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        confirmedCount: e.participants.length,
        grossRevenue: gross,
        totalMooveFee: moove,
        totalOrganizerNet: org,
        pctOfTotal: totalGrossGlobal > 0 ? (gross / totalGrossGlobal) * 100 : 0,
      };
    })
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  return {
    kpis: {
      approvedCount,
      grossRevenue: Number(txAggregate._sum.grossValue ?? 0),
      mooveFee: Number(txAggregate._sum.mooveFee ?? 0),
      organizerNet: Number(txAggregate._sum.organizerNetValue ?? 0),
    },
    eventOptions,
    ranking,
    totalGrossGlobal,
    isFiltered: !!filterEventId,
    filteredEventTitle: filterEventId
      ? eventOptions.find((e) => e.id === filterEventId)?.title
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Componente de KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accent: "primary" | "amber" | "green" | "blue";
  tooltip?: string;
}

const ACCENT_CLASSES = {
  primary: {
    icon: "text-primary",
    bg: "bg-primary/8",
    value: "text-foreground",
    border: "border-primary/20",
  },
  amber: {
    icon: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    value: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  green: {
    icon: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    value: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  blue: {
    icon: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    value: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
} as const;

function KpiCard({ title, value, subtitle, icon: Icon, accent, tooltip }: KpiCardProps) {
  const cls = ACCENT_CLASSES[accent];
  return (
    <Card className={`border ${cls.border}`}>
      <CardHeader className="flex flex-row items-start justify-between pb-3 space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            {title}
            {tooltip && (
              <span title={tooltip} className="cursor-help">
                <Info className="h-3 w-3 text-muted-foreground/60" />
              </span>
            )}
          </CardTitle>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cls.bg}`}>
          <Icon className={`h-4 w-4 ${cls.icon}`} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={`text-2xl font-bold tracking-tight ${cls.value}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers de status para o ranking
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
// Barra de progresso inline para % do total
// ---------------------------------------------------------------------------

function ProgressBar({ pct }: { pct: number }) {
  const width = Math.max(2, Math.round(pct));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function DashboardPage({ searchParams }: PageProps) {
  const { eventId } = await searchParams;
  const data = await getDashboardData(eventId);
  const { kpis, eventOptions, ranking, isFiltered, filteredEventTitle } = data;

  const kpiCards: KpiCardProps[] = [
    {
      title: "Total de Inscritos",
      value: kpis.approvedCount.toLocaleString("pt-BR"),
      subtitle: isFiltered
        ? "participantes confirmados neste evento"
        : "participantes com pagamento aprovado",
      icon: Users,
      accent: "blue",
      tooltip: "Contagem de participantes cujas transações têm status APPROVED",
    },
    {
      title: "Faturamento Bruto",
      value: formatCurrency(kpis.grossRevenue),
      subtitle: isFiltered
        ? "cobrado dos compradores neste evento"
        : "soma de grossValue — transações aprovadas",
      icon: DollarSign,
      accent: "primary",
      tooltip: "Soma de Transaction.grossValue onde status = APPROVED",
    },
    {
      title: "Lucro Líquido Moove",
      value: formatCurrency(kpis.mooveFee),
      subtitle: "2% retido como taxa de intermediação",
      icon: TrendingUp,
      accent: "amber",
      tooltip: "Soma de Transaction.mooveFee onde status = APPROVED (2% do bruto, calculado no servidor)",
    },
    {
      title: "Repasse ao Organizador",
      value: formatCurrency(kpis.organizerNet),
      subtitle: "faturamento bruto − taxa Moove",
      icon: ArrowUpRight,
      accent: "green",
      tooltip: "Soma de Transaction.organizerNetValue onde status = APPROVED",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {isFiltered && filteredEventTitle ? (
              <>
                Exibindo métricas de{" "}
                <span className="font-semibold text-foreground">
                  {filteredEventTitle}
                </span>
                {" "}·{" "}
                <Link
                  href="/admin/dashboard"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Ver todos
                </Link>
              </>
            ) : (
              "Métricas consolidadas da plataforma — apenas transações aprovadas."
            )}
          </p>
        </div>

        {/* Filtro de evento — Client Component */}
        <Suspense fallback={<div className="h-9 w-48 rounded-md bg-muted animate-pulse" />}>
          <EventFilter events={eventOptions} selectedEventId={eventId} />
        </Suspense>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 4 KPI Cards                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.title} {...card} />
        ))}
      </div>

      {/* Nota de rodapé sobre a base de cálculo */}
      {kpis.approvedCount === 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          {isFiltered
            ? "Nenhuma transação aprovada neste evento ainda."
            : "Nenhuma transação aprovada na plataforma ainda. Os valores aparecerão após os primeiros pagamentos."}
        </div>
      )}

      <Separator />

      {/* ---------------------------------------------------------------- */}
      {/* Ranking de Eventos                                                */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-lg font-semibold">Ranking de Receita por Evento</h2>
          <Badge variant="secondary" className="ml-1 text-xs">
            {ranking.length} evento{ranking.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {ranking.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            Nenhum evento cadastrado.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Evento</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Confirmados</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Faturamento Bruto</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Taxa Moove</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Repasse Org.</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap pl-6">% do Total</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ranking.map((event, index) => {
                    const statusCfg =
                      STATUS_CONFIG[event.status] ?? STATUS_CONFIG.DRAFT;
                    const isTop = index === 0 && event.grossRevenue > 0;
                    const isHighlighted = isFiltered && event.id === eventId;

                    return (
                      <tr
                        key={event.id}
                        className={`transition-colors ${
                          isHighlighted
                            ? "bg-primary/5 hover:bg-primary/8"
                            : "hover:bg-muted/20"
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-4 py-3.5">
                          {isTop ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                              <Trophy className="h-3 w-3 text-amber-600" />
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          )}
                        </td>

                        {/* Evento */}
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium leading-tight truncate max-w-[160px]">
                              {event.title}
                            </span>
                            <Badge
                              variant={statusCfg.variant}
                              className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                            >
                              {statusCfg.label}
                            </Badge>
                          </div>
                        </td>

                        {/* Confirmados */}
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="font-medium">{event.confirmedCount}</span>
                        </td>

                        {/* Faturamento Bruto */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap tabular-nums">
                          <span className={`font-semibold ${event.grossRevenue > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                            {formatCurrency(event.grossRevenue)}
                          </span>
                        </td>

                        {/* Taxa Moove */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap tabular-nums">
                          <span className={event.totalMooveFee > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                            {formatCurrency(event.totalMooveFee)}
                          </span>
                        </td>

                        {/* Repasse Org */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap tabular-nums">
                          <span className={event.totalOrganizerNet > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                            {formatCurrency(event.totalOrganizerNet)}
                          </span>
                        </td>

                        {/* % do Total */}
                        <td className="px-4 py-3.5 pl-6 min-w-[140px]">
                          <ProgressBar pct={event.pctOfTotal} />
                        </td>

                        {/* Link */}
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title="Ver detalhes do evento"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Rodapé com totais globais */}
                {ranking.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Total Global
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {ranking.reduce((s, e) => s + e.confirmedCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-bold">
                        {formatCurrency(ranking.reduce((s, e) => s + e.grossRevenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-semibold text-amber-600">
                        {formatCurrency(ranking.reduce((s, e) => s + e.totalMooveFee, 0))}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-semibold text-emerald-600">
                        {formatCurrency(ranking.reduce((s, e) => s + e.totalOrganizerNet, 0))}
                      </td>
                      <td className="px-4 py-3 pl-6">
                        <span className="text-xs text-muted-foreground">100%</span>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Legenda */}
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Todos os valores consideram apenas transações com status{" "}
          <code className="bg-muted px-1 rounded text-[11px]">APPROVED</code>.
          O ranking exibe todos os eventos independentemente do filtro ativo.
        </p>
      </div>
    </div>
  );
}

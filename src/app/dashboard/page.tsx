/**
 * Dashboard do organizador: lista eventos criados com métricas de vendas
 * usando os modelos Participant e Transaction.
 *
 * Isolamento de dados: apenas eventos do organizador logado são exibidos.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Calendar, Users, DollarSign, TrendingUp, LayoutDashboard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/fee";
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";
import { DashboardEventCard } from "@/components/dashboard/dashboard-event-card";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { MercadoPagoConnectCard } from "@/components/dashboard/mercadopago-connect-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface DashboardPageProps {
  searchParams: Promise<{ mp_connected?: string; mp_error?: string }>;
}

async function getOrganizerMpStatus(organizerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: organizerId },
    select: {
      mercadoPagoUserId: true,
      mercadoPagoAccessToken: true,
    },
  });

  return {
    connected: Boolean(user?.mercadoPagoUserId && user?.mercadoPagoAccessToken),
    mercadoPagoUserId: user?.mercadoPagoUserId ?? null,
  };
}

async function getDashboardData(organizerId: string) {
  const events = await prisma.event.findMany({
    where: { organizerId },
    include: {
      ticketTypes: true,
      participants: {
        where: { status: "CONFIRMED" },
        include: { transaction: true },
      },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalRevenue = events.reduce((sum, event) => {
    return (
      sum +
      event.participants.reduce(
        (s, p) => s + (p.transaction ? Number(p.transaction.grossValue) : 0),
        0
      )
    );
  }, 0);

  const totalParticipants = events.reduce(
    (sum, e) => sum + e._count.participants,
    0
  );
  const publishedEvents = events.filter((e) => e.status === "PUBLISHED").length;

  return { events, totalRevenue, totalParticipants, publishedEvents };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  const [{ events, totalRevenue, totalParticipants, publishedEvents }, mpStatus] =
    await Promise.all([
      getDashboardData(session.user.id),
      getOrganizerMpStatus(session.user.id),
    ]);

  const mpFeedback = params.mp_connected
    ? {
        type: "success" as const,
        message: "Conta Mercado Pago conectada com sucesso. Você já pode receber pagamentos.",
      }
    : params.mp_error
      ? { type: "error" as const, message: decodeURIComponent(params.mp_error) }
      : null;

  const firstName = session.user.name?.split(" ")[0];
  const greeting = getGreeting();

  const metrics = [
    {
      title: "Receita Total",
      value: formatCurrency(totalRevenue),
      description: "Valor bruto de inscrições confirmadas",
      icon: DollarSign,
      accent: "primary" as const,
    },
    {
      title: "Inscritos",
      value: totalParticipants.toLocaleString("pt-BR"),
      description: "Participantes em todos os eventos",
      icon: Users,
      accent: "blue" as const,
    },
    {
      title: "Publicados",
      value: publishedEvents.toLocaleString("pt-BR"),
      description: "Eventos ativos no ar",
      icon: TrendingUp,
      accent: "emerald" as const,
    },
    {
      title: "Total de Eventos",
      value: events.length.toLocaleString("pt-BR"),
      description: "Incluindo rascunhos e encerrados",
      icon: Calendar,
      accent: "violet" as const,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-muted/50 via-background to-background">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        {/* Header */}
        <header className="mb-8 space-y-3 sm:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
            Painel do organizador
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Acompanhe vendas, inscrições e gerencie seus eventos em um só
              lugar.
            </p>
          </div>
        </header>

        {/* Mercado Pago — recebimentos */}
        <section aria-label="Recebimentos" className="mb-10 sm:mb-12">
          <MercadoPagoConnectCard
            connected={mpStatus.connected}
            mercadoPagoUserId={mpStatus.mercadoPagoUserId}
            feedback={mpFeedback}
          />
        </section>

        {/* Métricas */}
        <section aria-label="Métricas" className="mb-10 sm:mb-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {metrics.map((metric) => (
              <DashboardMetricCard key={metric.title} {...metric} />
            ))}
          </div>
        </section>

        {/* Lista de Eventos */}
        <section aria-label="Meus eventos">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Meus eventos
              </h2>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {events.length}
              </Badge>
            </div>
            {events.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/events/new">
                  <Plus className="h-3.5 w-3.5" />
                  Novo evento
                </Link>
              </Button>
            )}
          </div>

          {events.length === 0 ? (
            <DashboardEmptyState />
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const confirmedParticipants = event.participants.length;
                const revenue = event.participants.reduce(
                  (sum, p) =>
                    sum +
                    (p.transaction ? Number(p.transaction.grossValue) : 0),
                  0
                );

                return (
                  <DashboardEventCard
                    key={event.id}
                    id={event.id}
                    slug={event.slug}
                    title={event.title}
                    status={event.status}
                    startDate={event.startDate}
                    participantCount={event._count.participants}
                    confirmedCount={confirmedParticipants}
                    revenue={revenue}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

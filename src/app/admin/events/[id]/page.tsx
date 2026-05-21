/**
 * /admin/events/[id] — Detalhes do evento com:
 *   - Métricas financeiras (receita bruta, taxa Moove, repasse ao organizador)
 *   - Tabela de participantes com busca e edição inline de formData
 *   - Ações de status (encerrar, cancelar, publicar)
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Pencil,
  CalendarDays,
  MapPin,
  Users,
  DollarSign,
  TrendingDown,
  Ticket,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/fee";
import { ParticipantTable } from "@/components/admin/participant-table";
import { EventStatusActions } from "@/components/admin/event-status-actions";
import type { EventFormStructure } from "@/types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return { title: event ? `Admin — ${event.title}` : "Admin — Evento" };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getEventWithParticipants(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      ticketTypes: {
        orderBy: { price: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          totalQuantity: true,
          soldQuantity: true,
        },
      },
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          ticketType: { select: { id: true, name: true, price: true } },
          transaction: {
            select: {
              id: true,
              status: true,
              grossValue: true,
              mooveFee: true,
              organizerNetValue: true,
              paymentMethod: true,
              paidAt: true,
              mercadoPagoPaymentId: true,
            },
          },
        },
        orderBy: { ordemCompra: "asc" },
      },
      _count: { select: { participants: true } },
    },
  });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT:     { label: "Rascunho",  variant: "secondary" },
  PUBLISHED: { label: "Publicado", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  FINISHED:  { label: "Encerrado", variant: "outline" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminEventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getEventWithParticipants(id);

  if (!event) notFound();

  // --- Métricas financeiras ---
  const confirmedParticipants = event.participants.filter(
    (p) => p.status === "CONFIRMED"
  );
  const grossRevenue = confirmedParticipants.reduce(
    (s, p) => s + Number(p.transaction?.grossValue ?? 0), 0
  );
  const totalMooveFees = confirmedParticipants.reduce(
    (s, p) => s + Number(p.transaction?.mooveFee ?? 0), 0
  );
  const organizerNet = confirmedParticipants.reduce(
    (s, p) => s + Number(p.transaction?.organizerNetValue ?? 0), 0
  );
  const totalSold = event.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
  const totalCapacity = event.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);

  const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.DRAFT;
  const formStructure = event.formStructure as unknown as EventFormStructure;

  // Serializa participantes (Decimal → string via JSON) para o Client Component
  const serializedParticipants = JSON.parse(
    JSON.stringify(
      event.participants.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    )
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ---- Breadcrumb + Header ---- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-2">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              Todos os eventos
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {event.venue} · {event.city}/{event.state}
          </p>
        </div>

        {/* Ações do cabeçalho */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href={`/event/${event.slug}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver página pública
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/events/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Editar evento
            </Link>
          </Button>
          {(event.status === "DRAFT" || event.status === "PUBLISHED") && (
            <EventStatusActions eventId={id} currentStatus={event.status} />
          )}
        </div>
      </div>

      {/* ---- Informações gerais ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-semibold">
              {format(new Date(event.startDate), "dd MMM yyyy", { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.startDate), "HH:mm", { locale: ptBR })} →{" "}
              {format(new Date(event.endDate), "HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Local</p>
            <p className="text-sm font-semibold">{event.venue}</p>
            <p className="text-xs text-muted-foreground">{event.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <Ticket className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Ingressos</p>
            <p className="text-sm font-semibold">
              {totalSold} / {totalCapacity}
            </p>
            <p className="text-xs text-muted-foreground">
              {confirmedParticipants.length} confirmado
              {confirmedParticipants.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <ClipboardList className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Formulário</p>
            <p className="text-sm font-semibold">
              {formStructure.fields.length} campo
              {formStructure.fields.length !== 1 ? "s" : ""} extra
              {formStructure.fields.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">+ nome e e-mail</p>
          </div>
        </div>
      </div>

      {/* ---- Cards financeiros ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Bruta
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(grossRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total cobrado dos participantes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa Moove (2%)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(totalMooveFees)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              2% retido como intermediação
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Repasse ao Organizador
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(organizerNet)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Receita bruta − taxa Moove
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ---- Tabela de participantes ---- */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Participantes</h2>
          <p className="text-xs text-muted-foreground">
            Clique em <Pencil className="h-3 w-3 inline" /> para corrigir dados preenchidos incorretamente.
          </p>
        </div>

        <ParticipantTable
          eventId={id}
          participants={serializedParticipants}
          formStructure={formStructure}
        />
      </div>
    </div>
  );
}

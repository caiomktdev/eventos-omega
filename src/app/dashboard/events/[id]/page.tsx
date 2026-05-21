/**
 * /dashboard/events/[id] — gestão do evento pelo organizador:
 * participantes, formulário de inscrição e métricas.
 */

import { notFound, redirect } from "next/navigation";
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
  Ticket,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/fee";
import { ParticipantTable } from "@/components/admin/participant-table";
import type { EventFormStructure } from "@/types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  PUBLISHED: { label: "Publicado", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  FINISHED: { label: "Encerrado", variant: "outline" },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return { title: event ? `Gerenciar: ${event.title}` : "Gerenciar Evento" };
}

async function getEventWithParticipants(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
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

export default async function DashboardEventDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;
  const event = await getEventWithParticipants(id);
  if (!event) notFound();

  const canManage =
    session.user.role === "ADMIN" || event.organizerId === session.user.id;
  if (!canManage) notFound();

  const confirmedParticipants = event.participants.filter(
    (p) => p.status === "CONFIRMED"
  );
  const grossRevenue = confirmedParticipants.reduce(
    (s, p) => s + Number(p.transaction?.grossValue ?? 0),
    0
  );
  const totalSold = event.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
  const totalCapacity = event.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);

  const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.DRAFT;
  const formStructure = event.formStructure as unknown as EventFormStructure;

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
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Meus eventos
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

        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href={`/event/${event.slug}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver página
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/events/${id}/edit#formulario`}>
              <ClipboardList className="h-3.5 w-3.5" />
              Formulário
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/dashboard/events/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Editar evento
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-semibold">
              {format(new Date(event.startDate), "dd MMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Local</p>
            <p className="text-sm font-semibold">{event.venue}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Participantes</p>
            <p className="text-sm font-semibold">
              {event._count.participants} inscri
              {event._count.participants !== 1 ? "ções" : "ção"}
            </p>
            <p className="text-xs text-muted-foreground">
              {confirmedParticipants.length} confirmado
              {confirmedParticipants.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <DollarSign className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Receita confirmada</p>
            <p className="text-sm font-semibold">{formatCurrency(grossRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              {totalSold}/{totalCapacity} ingressos
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Formulário de inscrição
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formStructure.fields.length === 0
                ? "Apenas nome e e-mail (padrão). Adicione campos extras como CPF, telefone ou tamanho de camiseta."
                : `${formStructure.fields.length} campo${formStructure.fields.length !== 1 ? "s" : ""} extra${formStructure.fields.length !== 1 ? "s" : ""} configurado${formStructure.fields.length !== 1 ? "s" : ""} além de nome e e-mail.`}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/events/${id}/edit#formulario`}>
              {formStructure.fields.length === 0 ? "Criar formulário" : "Alterar formulário"}
            </Link>
          </Button>
        </CardHeader>
        {formStructure.fields.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {formStructure.fields.map((field) => (
                <Badge key={field.name} variant="secondary" className="font-normal">
                  {field.label}
                  {field.required && " *"}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Participantes
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Todos os inscritos com dados do formulário. Use exportar para baixar a lista completa em CSV.
            </p>
          </div>
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

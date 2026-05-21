/**
 * /event/[slug] — Página pública do evento (layout Sympla, duas colunas).
 *
 * Coluna Esquerda (3fr):
 *   Imagem de capa (1600×838) → Título → Data/Hora/Local com ícones →
 *   Google Maps link → Descrição → Sobre o produtor
 *
 * Coluna Direita (2fr, sticky):
 *   Card flutuante com DynamicEventForm → seleção de ingressos + campos
 *   do formulário dinâmico + resumo financeiro + botão de ação.
 *
 * Integridade financeira:
 *   O form envia apenas { eventId, ticketTypeId, formData } para POST /api/enroll.
 *   Todo cálculo de preço, mooveFee (2%) e organizerNetValue ocorre
 *   exclusivamente no servidor em calculateMooveFee() → src/lib/fee.ts.
 */

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Ticket,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculateMooveFee, getMooveFeePercentLabel } from "@/lib/fee";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DynamicEventForm } from "@/components/events/dynamic-event-form";
import { EventCoverImage } from "@/components/events/event-cover-image";
import { PublishDraftButton } from "@/components/events/publish-draft-button";
import type { EventFormStructure } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: { select: { id: true, name: true, image: true } },
      ticketTypes: {
        orderBy: { price: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          totalQuantity: true,
          soldQuantity: true,
          maxPerOrder: true,
          salesStartDate: true,
          salesEndDate: true,
        },
      },
      _count: { select: { participants: true } },
    },
  });
}

// ── Metadata dinâmica ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Evento não encontrado" };
  if (event.status === "DRAFT") return { title: "Pré-visualização de rascunho" };

  return {
    title: event.title,
    description: event.description.slice(0, 160),
    openGraph: {
      title: event.title,
      description: event.description.slice(0, 160),
      images:
        event.coverImage && !event.coverImage.startsWith("data:")
          ? [{ url: event.coverImage }]
          : [],
      type: "website",
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "DRAFT")
    return <Badge variant="secondary">Rascunho</Badge>;
  if (status === "PUBLISHED")
    return <Badge variant="success">Inscrições abertas</Badge>;
  if (status === "CANCELLED")
    return <Badge variant="destructive">Evento cancelado</Badge>;
  if (status === "FINISHED")
    return <Badge variant="secondary">Encerrado</Badge>;
  return null;
}

/** Iniciais do nome para avatar fallback (até 2 letras) */
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Capitaliza a primeira letra de uma string */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── InfoRow — bloco de ícone + conteúdo ──────────────────────────────────────

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="pt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function InfoLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function InfoValue({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-foreground leading-snug">{children}</p>;
}

function InfoSub({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// ── Page Component ────────────────────────────────────────────────────────────

export default async function EventSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const [event, session] = await Promise.all([getEventBySlug(slug), auth()]);

  if (!event) notFound();

  const canPreviewDraft =
    session?.user?.role === "ADMIN" || session?.user?.id === event.organizerId;

  if (event.status === "DRAFT" && !canPreviewDraft) notFound();

  const isDraft = event.status === "DRAFT";
  const isCancelled = event.status === "CANCELLED";
  const isFinished  = event.status === "FINISHED";
  const isOpen      = !isCancelled && !isFinished && !isDraft;

  const editHref =
    session?.user?.role === "ADMIN"
      ? `/admin/events/${event.id}/edit`
      : `/dashboard/events/${event.id}/edit`;

  // Deserializa formStructure do JSON
  const formStructure = (
    typeof event.formStructure === "object" && event.formStructure !== null
      ? event.formStructure
      : { fields: [] }
  ) as unknown as EventFormStructure;

  // Filtra ingressos dentro da janela de vendas, serializa Decimal → number
  // e pré-calcula breakdown financeiro no servidor (fonte única: calculateMooveFee)
  const mooveFeePercentLabel = getMooveFeePercentLabel();
  const now = new Date();
  const availableTickets = event.ticketTypes
    .filter((t) => {
      if (t.salesStartDate && t.salesStartDate > now) return false;
      if (t.salesEndDate   && t.salesEndDate   < now) return false;
      return true;
    })
    .map((t) => {
      const price = Number(t.price);
      const feeCalc = calculateMooveFee(price);

      return {
        id: t.id,
        name: t.name,
        description: t.description ?? null,
        price,
        totalQuantity: t.totalQuantity,
        soldQuantity: t.soldQuantity,
        fees: {
          grossAmount: feeCalc.grossAmount,
          mooveFee: feeCalc.mooveFee,
          feeRatePercent: feeCalc.feeRateApplied * 100,
        },
      };
    });

  // Google Maps URL
  const mapsQuery = encodeURIComponent(
    [event.venue, event.address, event.city, event.state]
      .filter(Boolean)
      .join(", ")
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const startDate = new Date(event.startDate);
  const endDate   = new Date(event.endDate);

  const descParagraphs = event.description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-background">

      {isDraft && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          <span className="font-medium">Pré-visualização de rascunho</span>
          {" — "}
          este evento ainda não está publicado e só você pode vê-lo.
          {" "}
          <PublishDraftButton
            eventId={event.id}
            editHref={editHref}
            variant="banner"
          />
        </div>
      )}

      {/* ── Imagem de capa (proporção Sympla 1600×838) ──────────────────── */}
      <section
        aria-label="Imagem de capa do evento"
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: "1600 / 838" }}
      >
        {event.coverImage ? (
          <EventCoverImage
            src={event.coverImage}
            alt={`Capa do evento: ${event.title}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/8 to-primary/30">
            <Ticket className="h-28 w-28 text-primary/20" />
          </div>
        )}

        {/* Gradiente suave na base para transição com o fundo da página */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/50 pointer-events-none" />

        {/* Botão de volta */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="bg-background/80 backdrop-blur-sm shadow-md"
          >
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Explorar eventos
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Conteúdo principal ───────────────────────────────────────────── */}
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[3fr_2fr]">

          {/* ══════════════════════════════════════════════════════════════
              COLUNA ESQUERDA — Detalhes completos do evento
          ══════════════════════════════════════════════════════════════ */}
          <main className="space-y-10 min-w-0">

            {/* Título + status */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={event.status} />
                {isOpen && event._count.participants > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {event._count.participants} inscrito
                    {event._count.participants !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
                {event.title}
              </h1>
            </div>

            <Separator />

            {/* Blocos de data, hora e local */}
            <section aria-label="Informações de data, horário e local" className="space-y-5">

              {/* Data */}
              <InfoRow icon={Calendar}>
                <InfoLabel>Data</InfoLabel>
                <InfoValue>
                  {capitalize(
                    format(startDate, "EEEE',' dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })
                  )}
                </InfoValue>
              </InfoRow>

              {/* Horário */}
              <InfoRow icon={Clock}>
                <InfoLabel>Horário</InfoLabel>
                <InfoValue>
                  {format(startDate, "HH:mm", { locale: ptBR })}
                  {" até "}
                  {format(endDate, "HH:mm", { locale: ptBR })}
                </InfoValue>
              </InfoRow>

              {/* Local */}
              <InfoRow icon={MapPin}>
                <InfoLabel>Local</InfoLabel>
                <InfoValue>{event.venue}</InfoValue>
                <InfoSub>
                  {event.address} — {event.city}/{event.state}
                </InfoSub>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-2 transition-opacity hover:opacity-80"
                >
                  <ExternalLink className="h-3 w-3" />
                  Mostrar no Google Maps
                </a>
              </InfoRow>
            </section>

            <Separator />

            {/* Descrição do evento */}
            <section aria-labelledby="desc-heading">
              <h2 id="desc-heading" className="mb-5 text-xl font-bold">
                Sobre o evento
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed text-[15px]">
                {descParagraphs.length > 0 ? (
                  descParagraphs.map((para, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="italic text-muted-foreground/60">
                    Descrição não disponível.
                  </p>
                )}
              </div>
            </section>

            <Separator />

            {/* Sobre o produtor */}
            <section aria-labelledby="producer-heading">
              <h2 id="producer-heading" className="mb-5 text-xl font-bold">
                Sobre o produtor
              </h2>

              <div className="flex items-start gap-4">
                {/* Avatar com fallback de iniciais */}
                {event.organizer.image ? (
                  <Image
                    src={event.organizer.image}
                    alt={event.producerName ?? event.organizer.name}
                    width={52}
                    height={52}
                    className="rounded-full object-cover ring-2 ring-primary/20 shrink-0 mt-0.5"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold mt-0.5"
                  >
                    {getInitials(event.producerName ?? event.organizer.name)}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="font-semibold text-foreground leading-tight">
                    {event.producerName ?? event.organizer.name}
                  </p>
                  {event.producerBio ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {event.producerBio}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Organizador do evento
                    </p>
                  )}
                </div>
              </div>
            </section>

          </main>

          {/* ══════════════════════════════════════════════════════════════
              COLUNA DIREITA — Caixa flutuante de inscrição (sticky)
          ══════════════════════════════════════════════════════════════ */}
          <aside
            aria-label="Formulário de inscrição"
            className="lg:sticky lg:top-24 self-start"
          >
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">

              {/* Cabeçalho do card */}
              <div className="border-b bg-muted/30 px-6 py-5">
                <h2 className="text-lg font-bold leading-tight">
                  {isDraft
                    ? "Pré-visualização"
                    : isCancelled
                    ? "Evento Cancelado"
                    : isFinished
                    ? "Inscrições Encerradas"
                    : "Garanta sua vaga"}
                </h2>
                {isDraft && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Inscrições desativadas enquanto o evento for rascunho.
                  </p>
                )}
                {isOpen && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {availableTickets.length > 0
                      ? "Preencha os dados e confirme sua inscrição"
                      : "Todos os ingressos estão esgotados"}
                  </p>
                )}
              </div>

              {/* Corpo do card */}
              <div className="px-6 py-6">
                {isDraft ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground/25" />
                    <p className="text-sm text-muted-foreground">
                      Publique o evento para liberar inscrições e torná-lo visível na home.
                    </p>
                    <PublishDraftButton
                      eventId={event.id}
                      editHref={editHref}
                      variant="card"
                    />
                  </div>
                ) : isCancelled || isFinished ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground/25" />
                    <p className="text-sm text-muted-foreground">
                      {isCancelled
                        ? "Este evento foi cancelado pelo organizador."
                        : "As inscrições para este evento foram encerradas."}
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/">Ver outros eventos</Link>
                    </Button>
                  </div>
                ) : availableTickets.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground/25" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Todos os ingressos estão esgotados.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/">Ver outros eventos</Link>
                    </Button>
                  </div>
                ) : (
                  /**
                   * DynamicEventForm — Client Component.
                   *
                   * Recebe IDs, dados serializados e breakdown financeiro
                   * pré-calculado no servidor. O cliente apenas exibe valores;
                   * a mutação definitiva ocorre em POST /api/enroll.
                   */
                  <DynamicEventForm
                    eventId={event.id}
                    eventTitle={event.title}
                    formStructure={formStructure}
                    ticketTypes={availableTickets}
                    mooveFeePercentLabel={mooveFeePercentLabel}
                  />
                )}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

/**
 * EventCard — card de evento estilo Sympla.
 *
 * Estrutura visual:
 *   [Imagem 16:9 com badge de urgência/status]
 *   [Título em negrito]
 *   [Data longa: "Sábado, 23 de mai às 20:00"]
 *   [Local: Venue · Cidade/UF]
 *   [Preço mínimo ou "Gratuito"]
 */

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Calendar, Ticket } from "lucide-react";
import { formatCurrency } from "@/lib/fee";
import { EventCoverImage } from "@/components/events/event-cover-image";
import type { EventWithDetails } from "@/types";

interface EventCardProps {
  event: EventWithDetails;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMinPrice(event: EventWithDetails): number | null {
  if (!event.ticketTypes.length) return null;
  return Math.min(...event.ticketTypes.map((t) => Number(t.price)));
}

function getTotalCapacity(event: EventWithDetails) {
  return event.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
}

function getTotalSold(event: EventWithDetails) {
  return event.ticketTypes.reduce((s, t) => s + t.soldQuantity, 0);
}

type UrgencyLevel = "sold_out" | "ending_soon" | "available";

function getUrgency(event: EventWithDetails): UrgencyLevel {
  const total = getTotalCapacity(event);
  const sold = getTotalSold(event);
  if (total === 0) return "available";
  if (sold >= total) return "sold_out";
  if (sold / total >= 0.8) return "ending_soon";
  return "available";
}

function formatEventDate(date: Date): string {
  const raw = format(date, "EEEE', 'dd' de 'MMM' às 'HH:mm", { locale: ptBR });
  // Capitaliza a primeira letra
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ── Badge de urgência ─────────────────────────────────────────────────────────

function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  if (level === "available") return null;

  if (level === "sold_out") {
    return (
      <span className="absolute top-3 left-3 z-10 rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
        Esgotado
      </span>
    );
  }

  return (
    <span className="absolute top-3 left-3 z-10 rounded-md bg-orange-500/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
      🔥 Tá acabando
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EventCard({ event }: EventCardProps) {
  const minPrice = getMinPrice(event);
  const urgency = getUrgency(event);
  const isSoldOut = urgency === "sold_out";
  const eventDate = new Date(event.startDate);

  return (
    <Link
      href={`/event/${event.slug}`}
      className={`group flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl ${
        isSoldOut ? "pointer-events-none opacity-60" : ""
      }`}
      tabIndex={isSoldOut ? -1 : 0}
    >
      {/* ── Imagem de capa ──────────────────────────────────────── */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
        {event.coverImage ? (
          <EventCoverImage
            src={event.coverImage}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/35">
            <Ticket className="h-14 w-14 text-primary/30" />
          </div>
        )}

        {/* Badge de urgência / esgotado */}
        <UrgencyBadge level={urgency} />

        {/* Badge de preço sobreposto ao canto inferior direito */}
        {minPrice !== null && !isSoldOut && (
          <span className="absolute bottom-3 right-3 z-10 rounded-md bg-black/65 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {minPrice === 0 ? "Gratuito" : `A partir de ${formatCurrency(minPrice)}`}
          </span>
        )}
      </div>

      {/* ── Informações textuais ─────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 px-0.5">
        {/* Título */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
          {event.title}
        </h3>

        {/* Data */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          <span>{formatEventDate(eventDate)}</span>
        </div>

        {/* Local */}
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
          <span className="line-clamp-1">
            {event.city}/{event.state}
            {event.venue ? ` · ${event.venue}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}

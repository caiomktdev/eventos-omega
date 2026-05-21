"use client";

/**
 * Conteúdo do painel de busca (categorias + eventos em alta).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { EventCoverImage } from "@/components/events/event-cover-image";
import { FEATURED_CATEGORIES } from "@/lib/featured-categories";

interface FeaturedEvent {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  city: string;
  state: string;
  startDate: string;
  venue: string;
}

interface NavbarSearchOverlayProps {
  onClose: () => void;
}

function formatEventDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function NavbarSearchOverlay({ onClose }: NavbarSearchOverlayProps) {
  const [events, setEvents] = useState<FeaturedEvent[]>([]);

  useEffect(() => {
    fetch("/api/events/featured?limit=4")
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="w-full shrink-0 lg:w-[220px]">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Explore as coleções
          </p>
          <nav className="flex flex-col gap-1">
            {FEATURED_CATEGORIES.map((cat) => (
              <Link
                key={cat.query}
                href={`/?q=${encodeURIComponent(cat.query)}`}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-primary/8 hover:text-primary"
              >
                <span className="text-base" aria-hidden>
                  {cat.emoji}
                </span>
                {cat.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Eventos em alta</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.slug}`}
                onClick={onClose}
                className="group flex gap-3 rounded-xl border border-border/60 p-2 hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {event.coverImage ? (
                    <EventCoverImage
                      src={event.coverImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">
                      🎫
                    </div>
                  )}
                </div>
                <div className="min-w-0 py-0.5">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                    {event.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {event.venue} — {event.city}, {event.state}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {formatEventDate(event.startDate)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

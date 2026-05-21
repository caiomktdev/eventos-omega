/**
 * Home — página inicial da plataforma.
 *
 * Server Component: filtra eventos via Prisma com base no query param ?q=.
 *
 * Estrutura:
 *   1. CategoryNav — carrossel de categorias com highlight ativo
 *   2. Grid de eventos — título contextual + cards Sympla-style
 *
 * Busca:
 *   - Filtra por title e description (case-insensitive) quando ?q está presente
 *   - Sem ?q: exibe todos os publicados ordenados por popularidade (vendas DESC)
 */

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { EventCard } from "@/components/events/event-card";
import { CategoryNav } from "@/components/home/category-nav";
import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";
import { HomeFaq } from "@/components/home/home-faq";
import { HomeOrganizerBanner } from "@/components/home/home-organizer-banner";
import { HomeSponsorLogoCarousel } from "@/components/home/home-sponsor-logo-carousel";
import { Search, Frown } from "lucide-react";
import type { EventWithDetails } from "@/types";
import type { PlatformSponsorLogo } from "@/lib/sponsor-media";
import { getHomeSectionCopy } from "@/lib/home-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EventosOmega — Descubra experiências incríveis",
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getEvents(query?: string, city?: string): Promise<EventWithDetails[]> {
  const where = {
    status: "PUBLISHED" as const,
    ...(city?.trim()
      ? { city: { equals: city.trim(), mode: "insensitive" as const } }
      : {}),
    ...(query?.trim()
      ? {
          OR: [
            { title:       { contains: query.trim(), mode: "insensitive" as const } },
            { description: { contains: query.trim(), mode: "insensitive" as const } },
            { city:        { contains: query.trim(), mode: "insensitive" as const } },
            { venue:       { contains: query.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const events = await prisma.event.findMany({
    where,
    include: {
      organizer:   { select: { id: true, name: true, image: true } },
      ticketTypes: { orderBy: { price: "asc" } },
      _count:      { select: { participants: true } },
    },
    // Sem query: mais inscritos primeiro; com query: próximos primeiro
    orderBy: query?.trim()
      ? { startDate: "asc" }
      : { participants: { _count: "desc" } },
  });

  return events as EventWithDetails[];
}

/** Eventos publicados para o hero Cover Flow (prioriza com imagem de capa) */
async function getHeroSlides(): Promise<HeroSlide[]> {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
      city: true,
      state: true,
    },
    orderBy: { startDate: "asc" },
    take: 15,
  });

  return [...events]
    .sort((a, b) => {
      if (a.coverImage && !b.coverImage) return -1;
      if (!a.coverImage && b.coverImage) return 1;
      return 0;
    })
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      coverImage: e.coverImage,
      city: e.city,
      state: e.state,
    }));
}

/** Logos de patrocinadores globais para o carrossel acima das categorias */
async function getPlatformSponsorLogos(): Promise<PlatformSponsorLogo[]> {
  const delegate = prisma.platformSponsor;
  if (!delegate?.findMany) {
    return [];
  }

  const sponsors = await delegate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      logoUrl: true,
      linkUrl: true,
      sortOrder: true,
    },
  });

  return sponsors;
}

// ── Skeleton do grid ──────────────────────────────────────────────────────────

function EventGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="aspect-[16/9] w-full animate-pulse rounded-xl bg-muted" />
          <div className="space-y-2 px-0.5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Estado vazio ──────────────────────────────────────────────────────────────

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {query ? (
          <Frown className="h-8 w-8 text-muted-foreground/50" />
        ) : (
          <Search className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {query ? "Nenhum resultado encontrado" : "Nenhum evento disponível"}
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        {query
          ? `Não encontramos eventos para "${query}". Tente outros termos ou explore as categorias acima.`
          : "Em breve novos eventos serão publicados. Volte em breve!"}
      </p>
    </div>
  );
}

// ── Grid de eventos ───────────────────────────────────────────────────────────

async function EventGrid({ query, city }: { query?: string; city?: string }) {
  const events = await getEvents(query, city);

  if (events.length === 0) {
    return <EmptyState query={query} />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface HomePageProps {
  searchParams: Promise<{ q?: string; city?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { q, city } = await searchParams;
  const query = q?.trim() || undefined;
  const cityFilter = city?.trim() || undefined;
  const sectionCopy = getHomeSectionCopy(query, cityFilter);
  const [heroSlides, platformSponsors] = await Promise.all([
    getHeroSlides(),
    getPlatformSponsorLogos(),
  ]);

  return (
    <>
      {/* ── Hero Cover Flow (imagens dos eventos) ──────────────── */}
      <HeroCarousel slides={heroSlides} />

      <div className="container mx-auto px-4 py-8 space-y-8">

      {/* ── Logos de patrocinadores ───────────────────────────── */}
      <section aria-label="Patrocinadores">
        <HomeSponsorLogoCarousel sponsors={platformSponsors} />
      </section>

      {/* ── Categorias ────────────────────────────────────────── */}
      <section aria-label="Categorias de eventos">
        <Suspense
          fallback={
            <div className="flex gap-2.5 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 w-36 animate-pulse rounded-full bg-muted shrink-0" />
              ))}
            </div>
          }
        >
          <CategoryNav />
        </Suspense>
      </section>

      {/* ── Grid de eventos ───────────────────────────────────── */}
      <section>
        {/* Cabeçalho da seção */}
        <div className="mb-6">
          {query ? (
            <>
              <h2 className="text-xl font-bold">
                Resultados para{" "}
                <span className="text-primary">"{query}"</span>
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {sectionCopy.description}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">{sectionCopy.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {sectionCopy.description}
              </p>
            </>
          )}
        </div>

        <Suspense fallback={<EventGridSkeleton />}>
          <EventGrid query={query} city={cityFilter} />
        </Suspense>
      </section>

      {/* ── Banner promocional (patrocinadores) ─────────────────── */}
      <HomeOrganizerBanner />

      {/* ── Perguntas frequentes (estilo Sympla) ──────────────── */}
      <HomeFaq />
      </div>
    </>
  );
}

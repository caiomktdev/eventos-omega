"use client";

/**
 * HomeOrganizerBanner — slider promocional com mídias de patrocinadores.
 * Carrega via API para evitar serializar imagens base64 no RSC da home.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCoverImage } from "@/components/events/event-cover-image";
import {
  SPONSOR_BANNER_CANVAS_CLASS,
  SPONSOR_BANNER_SLIDE_MS,
  type PromoSponsorSlide,
} from "@/lib/sponsor-media";

function BannerSkeleton() {
  return (
    <section aria-label="Destaques promocionais" className="pt-4">
      <div
        className="w-full animate-pulse rounded-2xl bg-muted"
        style={{ aspectRatio: "1680 / 360" }}
      />
    </section>
  );
}

function SponsorMedia({
  slide,
  priority,
}: {
  slide: PromoSponsorSlide;
  priority?: boolean;
}) {
  if (slide.mediaType === "VIDEO") {
    return (
      <video
        src={slide.mediaUrl}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    <EventCoverImage
      src={slide.mediaUrl}
      alt={slide.sponsorName ?? "Patrocinador"}
      fill
      priority={priority}
      sizes="(max-width: 768px) 100vw, 1024px"
      className="object-cover"
    />
  );
}

export function HomeOrganizerBanner() {
  const [slides, setSlides] = useState<PromoSponsorSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSlides() {
      try {
        const res = await fetch("/api/promo/sponsors", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data)) {
          setSlides(data);
        }
      } catch {
        if (!cancelled) setSlides([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = slides.length;

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setActive((index + total) % total);
    },
    [total]
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const timer = setInterval(next, SPONSOR_BANNER_SLIDE_MS);
    return () => clearInterval(timer);
  }, [next, paused, total]);

  if (loading) return <BannerSkeleton />;
  if (total === 0) return null;

  return (
    <section
      aria-label="Destaques promocionais"
      className="pt-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-muted shadow-sm"
        style={{ aspectRatio: "1680 / 360" }}
      >
        <div className={SPONSOR_BANNER_CANVAS_CLASS}>
          {slides.map((slide, index) => {
            const isActive = index === active;
            const label = slide.sponsorName ?? "Patrocinador";
            const href = slide.linkUrl?.trim();

            const content = (
              <>
                <SponsorMedia slide={slide} priority={index === 0} />

                {slide.sponsorName && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-3 pt-10 sm:px-8 sm:pb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                      Patrocinador
                    </p>
                    <p className="text-lg font-bold text-white line-clamp-2 sm:text-xl md:text-2xl">
                      {slide.sponsorName}
                    </p>
                  </div>
                )}
              </>
            );

            const slideClassName = cn(
              "absolute inset-0 block transition-opacity duration-500 ease-out",
              isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
            );

            if (href) {
              return (
                <Link
                  key={slide.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  aria-hidden={!isActive}
                  tabIndex={isActive ? 0 : -1}
                  className={slideClassName}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={slide.id}
                aria-label={label}
                aria-hidden={!isActive}
                className={slideClassName}
              >
                {content}
              </div>
            );
          })}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Banner anterior"
              className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50 sm:left-4 sm:h-11 sm:w-11"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próximo banner"
              className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50 sm:right-4 sm:h-11 sm:w-11"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-4">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Ir para ${slide.sponsorName ?? "banner"}`}
                  aria-current={index === active ? "true" : undefined}
                  onClick={() => goTo(index)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === active
                      ? "w-6 bg-white"
                      : "w-2 bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

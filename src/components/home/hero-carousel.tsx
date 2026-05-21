/**
 * HeroCarousel — Cover Flow estilo Sympla.
 * Cards empilhados em perspectiva 3D; slide central em destaque.
 * Imagens vêm dos eventos publicados (coverImage).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCoverImage } from "@/components/events/event-cover-image";

export interface HeroSlide {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  city: string;
  state: string;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
}

const AUTOPLAY_MS = 5500;

/** Normaliza offset circular (ex: último → primeiro) */
function getOffset(index: number, active: number, total: number): number {
  let diff = index - active;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

function slideStyles(offset: number) {
  const abs = Math.abs(offset);

  if (abs > 4) {
    return {
      transform: "translateX(-50%) scale(0.5)",
      zIndex: 0,
      opacity: 0,
      pointerEvents: "none" as const,
    };
  }

  const translatePx = offset * 175;
  const scale = offset === 0 ? 1 : abs === 1 ? 0.84 : abs === 2 ? 0.7 : 0.56;
  const zIndex = 20 - abs;
  const opacity = offset === 0 ? 1 : abs === 1 ? 0.85 : abs === 2 ? 0.6 : 0.35;

  return {
    transform: `translateX(calc(-50% + ${translatePx}px)) scale(${scale})`,
    zIndex,
    opacity,
    pointerEvents: abs <= 1 ? ("auto" as const) : ("none" as const),
  };
}

export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

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
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [next, paused, total]);

  if (total === 0) return null;

  return (
    <section
      aria-label="Eventos em destaque"
      className="relative w-full overflow-hidden bg-background py-8 sm:py-12 md:py-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container relative mx-auto px-4">
        {/* Stage Cover Flow */}
        <div
          className="relative mx-auto h-[240px] sm:h-[320px] md:h-[380px] lg:h-[420px] xl:h-[460px]"
          style={{ perspective: "1400px" }}
        >
          <div className="relative h-full w-full">
            {slides.map((slide, index) => {
              const offset = getOffset(index, active, total);
              const style = slideStyles(offset);
              const isCenter = offset === 0;

              return (
                <Link
                  key={slide.id}
                  href={`/event/${slide.slug}`}
                  aria-label={slide.title}
                  aria-hidden={!isCenter && Math.abs(offset) > 1}
                  tabIndex={isCenter ? 0 : -1}
                  className={cn(
                    "absolute left-1/2 top-0 block overflow-hidden rounded-2xl shadow-2xl",
                    "border border-black/5 bg-muted transition-all duration-500 ease-out",
                    "will-change-transform",
                    isCenter ? "cursor-pointer ring-2 ring-primary/20" : "cursor-default"
                  )}
                  style={{
                    width: "min(92%, 920px)",
                    height: "100%",
                    ...style,
                  }}
                >
                  {slide.coverImage ? (
                    <EventCoverImage
                      src={slide.coverImage}
                      alt={slide.title}
                      fill
                      priority={isCenter}
                      sizes="(max-width: 768px) 92vw, 920px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-muted">
                      <Ticket className="h-12 w-12 text-primary/30" />
                      <p className="mt-2 px-4 text-center text-sm font-semibold text-foreground/80 line-clamp-2">
                        {slide.title}
                      </p>
                    </div>
                  )}

                  {/* Overlay gradiente + título no slide central */}
                  {isCenter && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-6 pb-5 pt-14">
                      <p className="text-lg font-bold text-white line-clamp-2 sm:text-xl md:text-2xl">
                        {slide.title}
                      </p>
                      <p className="mt-1 text-sm text-white/80 sm:text-base">
                        {slide.city}/{slide.state}
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Setas — estilo Sympla (azul primary) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Evento anterior"
              className="absolute left-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-primary shadow-md transition hover:bg-primary/5 sm:left-2 md:h-12 md:w-12"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próximo evento"
              className="absolute right-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-primary shadow-md transition hover:bg-primary/5 sm:right-2 md:h-12 md:w-12"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </>
        )}

        {/* Indicadores */}
        {total > 1 && (
          <div className="mt-5 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir para ${slide.title}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === active
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-primary/50"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

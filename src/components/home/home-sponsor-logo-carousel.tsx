"use client";

/**
 * Carrossel horizontal de logos de patrocinadores da plataforma.
 * Exibido acima das categorias na home.
 */

import { EventCoverImage } from "@/components/events/event-cover-image";
import type { PlatformSponsorLogo } from "@/lib/sponsor-media";

interface HomeSponsorLogoCarouselProps {
  sponsors: PlatformSponsorLogo[];
}

function SponsorLogoItem({ sponsor }: { sponsor: PlatformSponsorLogo }) {
  const logo = (
    <div className="relative h-10 w-32 shrink-0 px-1">
      <EventCoverImage
        src={sponsor.logoUrl}
        alt={sponsor.name}
        fill
        sizes="128px"
        className="object-contain opacity-75 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
      />
    </div>
  );

  if (sponsor.linkUrl) {
    return (
      <a
        href={sponsor.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={sponsor.name}
        className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {logo}
      </a>
    );
  }

  return logo;
}

export function HomeSponsorLogoCarousel({ sponsors }: HomeSponsorLogoCarouselProps) {
  if (sponsors.length === 0) return null;

  const loopItems =
    sponsors.length < 6
      ? [...sponsors, ...sponsors, ...sponsors, ...sponsors]
      : [...sponsors, ...sponsors];

  return (
    <div className="relative overflow-hidden py-1">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Patrocinadores
      </p>

      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />

        <div className="flex w-max animate-sponsor-marquee gap-6 group-hover:[animation-play-state:paused]">
          {loopItems.map((sponsor, index) => (
            <SponsorLogoItem key={`${sponsor.id}-${index}`} sponsor={sponsor} />
          ))}
        </div>
      </div>
    </div>
  );
}

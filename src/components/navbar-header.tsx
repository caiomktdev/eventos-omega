"use client";

/**
 * NavbarHeader — shell estático; busca isolada em NavbarSearchIsland.
 */

import Link from "next/link";
import { memo, startTransition, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  PlusCircle,
  CalendarDays,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteLogo } from "@/components/brand/site-logo";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { NavbarSearchIsland } from "@/components/navbar-search-island";

/** Ativa modo compacto ao rolar para baixo. */
const COMPACT_AT = 96;
/** Volta ao modo expandido ao subir (histerese evita flicker no limiar). */
const EXPAND_AT = 56;

const HEADER_HEIGHT = {
  expanded: "8.5625rem", // 137px
  compact: "4.75rem", // 76px
} as const;

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
        "text-foreground/70 transition-colors duration-150",
        "hover:bg-primary/8 hover:text-primary"
      )}
    >
      <Icon
        className="h-[18px] w-[18px] transition-transform duration-150 group-hover:scale-110"
        strokeWidth={1.8}
      />
      {label}
    </Link>
  );
}

const NavLinksRow = memo(function NavLinksRow({ compact }: { compact: boolean }) {
  return (
    <div
      aria-hidden={compact}
      className={cn(
        "hidden overflow-hidden transition-[opacity,max-width] duration-200 ease-out motion-reduce:transition-none lg:flex lg:items-center lg:gap-0",
        compact ? "pointer-events-none max-w-0 opacity-0" : "max-w-[520px] opacity-100"
      )}
    >
      <NavLink href="/dashboard/events/new" icon={PlusCircle} label="Criar evento" />
      <NavLink href="/dashboard" icon={CalendarDays} label="Meus eventos" />
      <NavLink href="/meus-ingressos" icon={Ticket} label="Meus ingressos" />
    </div>
  );
});

function Logo({ compact }: { compact?: boolean }) {
  return <SiteLogo variant={compact ? "mark" : "full"} />;
}

function SearchFallback({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "[grid-area:search] flex min-w-0 items-center gap-2 sm:gap-3",
        compact ? "" : "justify-center pt-3"
      )}
    >
      <div className="h-11 min-w-0 flex-1 animate-pulse rounded-full bg-muted/40" />
      <div className="h-11 w-10 shrink-0 animate-pulse rounded-full bg-primary/10 sm:w-32" />
    </div>
  );
}

export function NavbarHeader() {
  const [compact, setCompact] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const compactRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const applyCompact = useCallback((next: boolean) => {
    if (compactRef.current === next) return;
    compactRef.current = next;
    startTransition(() => setCompact(next));
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const y = window.scrollY;
      if (compactRef.current) {
        if (y < EXPAND_AT) applyCompact(false);
      } else if (y > COMPACT_AT) {
        applyCompact(true);
      }
    });
  }, [applyCompact]);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  return (
    <header
      style={{ height: compact ? HEADER_HEIGHT.compact : HEADER_HEIGHT.expanded }}
      className={cn(
        "sticky top-0 w-full border-b border-white/20",
        searchOpen ? "overflow-visible z-[60]" : "overflow-hidden z-50",
        "bg-white/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/60",
        "transition-[height,box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none",
        compact ? "bg-white/85 shadow-md shadow-black/[0.05]" : "shadow-sm shadow-black/[0.03]"
      )}
    >
      <div className="container relative mx-auto px-4 py-[10px]">
        <div
          className={cn(
            "grid w-full min-w-0 items-center gap-x-2 sm:gap-x-3",
            "transition-[padding-bottom] duration-200 ease-out motion-reduce:transition-none",
            compact
              ? "h-14 [grid-template-areas:'logo_search_actions'] grid-cols-[auto_minmax(0,1fr)_auto]"
              : "pb-4 [grid-template-areas:'logo_actions'_'search_search'] grid-cols-[1fr_auto] grid-rows-[auto_auto]"
          )}
        >
          <div className="[grid-area:logo] flex items-center">
            <Logo compact={compact} />
          </div>

          <div className="[grid-area:actions] flex shrink-0 items-center justify-self-end gap-1">
            <NavLinksRow compact={compact} />
            <NavbarProfileMenu />
          </div>

          <Suspense fallback={<SearchFallback compact={compact} />}>
            <NavbarSearchIsland compact={compact} onOpenChange={setSearchOpen} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

"use client";

/**
 * Ilha de busca — estado isolado; header não re-renderiza ao abrir/fechar.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SearchBar, type SearchBarHandle } from "@/components/search-bar";
import { NavbarLocationSelector } from "@/components/navbar-location-selector";
import { NavbarSearchOverlay } from "@/components/navbar-search-overlay";
import { cn } from "@/lib/utils";

interface NavbarSearchIslandProps {
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const NavbarSearchIsland = memo(function NavbarSearchIsland({
  compact = false,
  onOpenChange,
}: NavbarSearchIslandProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<SearchBarHandle>(null);
  const ignoreCloseUntilRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
      if (next) {
        ignoreCloseUntilRef.current = Date.now() + 250;
      }
    },
    [onOpenChange]
  );

  const handleClose = useCallback(() => {
    if (Date.now() < ignoreCloseUntilRef.current) return;
    searchRef.current?.commit();
    setOpenState(false);
  }, [setOpenState]);

  const backdrop =
    mounted &&
    createPortal(
      <div
        aria-hidden
        className={cn(
          "fixed inset-0 z-[55] bg-black/15",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{ transition: "opacity 150ms ease-out" }}
        onClick={handleClose}
      />,
      document.body
    );

  const overlayPanel =
    mounted &&
    open &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sugestões de busca"
        className={cn(
          "fixed inset-x-0 z-[100] border-t border-border/40 bg-white px-4 pb-6 pt-4",
          "shadow-[0_16px_40px_rgba(0,0,0,0.08)]",
          compact ? "top-[4.75rem]" : "top-[8.5625rem]"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <NavbarSearchOverlay onClose={handleClose} />
      </div>,
      document.body
    );

  return (
    <>
      {backdrop}
      {overlayPanel}

      <div
        className={cn(
          "[grid-area:search] relative z-[60] flex min-w-0 items-center gap-2 sm:gap-3",
          "transition-[padding-top] duration-200 ease-out motion-reduce:transition-none",
          compact ? "pt-0" : "justify-center pt-3"
        )}
        onPointerDownCapture={() => setOpenState(true)}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <SearchBar
          ref={searchRef}
          compact={compact}
          overlayOpen={open}
          onOverlayOpenChange={setOpenState}
        />
        <NavbarLocationSelector compact={compact} />
      </div>
    </>
  );
});

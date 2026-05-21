"use client";

/**
 * SearchBar — busca local; navega só ao confirmar (Enter / fechar).
 */

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchBarHandle {
  commit: () => void;
}

interface SearchBarProps {
  overlayOpen?: boolean;
  onOverlayOpenChange?: (open: boolean) => void;
  compact?: boolean;
}

export const SearchBar = memo(forwardRef<SearchBarHandle, SearchBarProps>(function SearchBar(
  { overlayOpen = false, onOverlayOpenChange, compact = false },
  ref
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const lastSyncedRef = useRef("");
  const pendingRef = useRef("");

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setValue(q);
    lastSyncedRef.current = q;
    pendingRef.current = q;
  }, [searchParams]);

  function commitSearch(trimmed: string) {
    if (trimmed === lastSyncedRef.current) return;

    lastSyncedRef.current = trimmed;
    pendingRef.current = trimmed;

    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");

    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  useImperativeHandle(ref, () => ({
    commit: () => commitSearch(pendingRef.current.trim()),
  }));

  function handleOpen() {
    onOverlayOpenChange?.(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    pendingRef.current = e.target.value;
  }

  function handleClear() {
    setValue("");
    pendingRef.current = "";
    commitSearch("");
  }

  function handleFocus() {
    handleOpen();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
      onOverlayOpenChange?.(false);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = pendingRef.current.trim();
      setValue(trimmed);
      commitSearch(trimmed);
      inputRef.current?.blur();
      onOverlayOpenChange?.(false);
    }
  }

  return (
    <div className={cn("relative min-w-0", compact ? "flex-1" : "w-full max-w-[640px]")}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70">
        <Search className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>

      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Buscar experiências"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseDown={handleOpen}
        className={cn(
          "h-11 w-full rounded-full border bg-white pl-11 pr-10 text-sm",
          "placeholder:text-muted-foreground/70 focus:outline-none",
          overlayOpen
            ? "border-primary shadow-[0_0_0_3px_rgba(5,134,249,0.14),0_4px_16px_rgba(0,0,0,0.06)]"
            : "border-border/80 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
        )}
        style={{
          transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
        }}
      />

      {value && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          type="button"
          aria-label="Limpar busca"
          className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/30"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}));

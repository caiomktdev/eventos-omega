"use client";

/**
 * Seletor de localização do cabeçalho — estilo Sympla.
 * Filtra eventos via query param ?city=
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

interface CityOption {
  city: string;
  state: string;
}

interface NavbarLocationSelectorProps {
  compact?: boolean;
}

export function NavbarLocationSelector({ compact = false }: NavbarLocationSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCity = searchParams.get("city") ?? "";

  const [cities, setCities] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/events/cities")
      .then((res) => res.json())
      .then((data: CityOption[]) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, []);

  function selectCity(city: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (city) params.set("city", city);
    else params.delete("city");
    router.push(`/?${params.toString()}`);
    setOpen(false);
  }

  const label = selectedCity || "Qualquer lugar";

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-state={open ? "open" : "closed"}
          className={cn(
            "inline-flex h-11 max-w-full shrink-0 items-center gap-1.5 rounded-full",
            compact ? "px-2.5 sm:gap-2 sm:px-3" : "gap-2 px-4",
            "bg-primary/10 text-sm font-medium text-primary",
            "transition-[background-color,transform] duration-200 ease-out",
            "hover:bg-primary/15 active:scale-[0.98]",
            open && "bg-primary/15 shadow-sm shadow-primary/10",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
          aria-label="Filtrar por localização"
          aria-expanded={open}
        >
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span
            className={cn(
              "truncate",
              compact ? "hidden max-w-[88px] sm:inline sm:max-w-[100px]" : "max-w-[120px] sm:max-w-none"
            )}
          >
            {label}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-80 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 max-h-72 min-w-[220px] overflow-y-auto rounded-xl border bg-popover p-1.5",
            "text-popover-foreground shadow-lg",
            "animate-in fade-in-0 slide-in-from-top-2 duration-200"
          )}
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none hover:bg-accent"
            onSelect={() => selectCity(null)}
          >
            Qualquer lugar
            {!selectedCity && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenu.Item>

          {cities.length > 0 && (
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
          )}

          {cities.map(({ city, state }) => (
            <DropdownMenu.Item
              key={`${city}-${state}`}
              className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none hover:bg-accent"
              onSelect={() => selectCity(city)}
            >
              <span>
                {city}
                <span className="text-muted-foreground">/{state}</span>
              </span>
              {selectedCity === city && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

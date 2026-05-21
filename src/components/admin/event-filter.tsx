"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter } from "lucide-react";

interface EventOption {
  id: string;
  title: string;
  status: string;
}

interface EventFilterProps {
  events: EventOption[];
  selectedEventId: string | undefined;
}

export function EventFilter({ events, selectedEventId }: EventFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("eventId");
    } else {
      params.set("eventId", value);
    }
    startTransition(() => {
      router.push(`/admin/dashboard?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="relative">
        <select
          value={selectedEventId ?? "all"}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className="h-9 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-w-[200px] max-w-[280px] truncate cursor-pointer"
        >
          <option value="all">Todos os eventos</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        {/* Chevron decorativo */}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {isPending && (
          <span className="absolute right-7 top-1/2 -translate-y-1/2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent block" />
          </span>
        )}
      </div>
    </div>
  );
}

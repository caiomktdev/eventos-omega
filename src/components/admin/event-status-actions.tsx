"use client";

/**
 * EventStatusActions — publicar, encerrar ou cancelar evento.
 */

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, Loader2, XCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EventStatusActionsProps {
  eventId: string;
  currentStatus: string;
}

export function EventStatusActions({ eventId, currentStatus }: EventStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"PUBLISHED" | "FINISHED" | "CANCELLED" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: "PUBLISHED" | "FINISHED" | "CANCELLED") {
    setAction(newStatus);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error ?? "Não foi possível atualizar o status.");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setAction(null);
      }
    });
  }

  if (currentStatus === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => updateStatus("PUBLISHED")}
        >
          {isPending && action === "PUBLISHED" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          Publicar evento
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (currentStatus !== "PUBLISHED") return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
        title="Encerrar evento"
        disabled={isPending}
        onClick={() => updateStatus("FINISHED")}
      >
        {isPending && action === "FINISHED" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <StopCircle className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        title="Cancelar evento"
        disabled={isPending}
        onClick={() => updateStatus("CANCELLED")}
      >
        {isPending && action === "CANCELLED" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}

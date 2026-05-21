"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Rocket, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublishDraftButtonProps {
  eventId: string;
  editHref: string;
  variant?: "banner" | "card";
}

export function PublishDraftButton({
  eventId,
  editHref,
  variant = "card",
}: PublishDraftButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Não foi possível publicar o evento.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsPending(false);
    }
  }

  if (variant === "banner") {
    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={isPending}
          className="font-semibold underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
        >
          {isPending ? "Publicando..." : "Publicar evento"}
        </button>
        <span aria-hidden>·</span>
        <Link
          href={editHref}
          className="font-semibold underline underline-offset-2 hover:text-amber-950"
        >
          Editar
        </Link>
        {error && <span className="block w-full text-xs text-red-700">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" disabled={isPending} onClick={publish}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          Publicar evento
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={editHref}>
            <Pencil className="h-4 w-4" />
            Editar evento
          </Link>
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

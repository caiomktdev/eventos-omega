"use client";

/**
 * EventSponsorMediaManager — upload de imagens e vídeos (até 5s) de patrocinadores.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SponsorMediaItem } from "@/lib/sponsor-media";
import {
  SPONSOR_BANNER_ASPECT_CLASS,
  SPONSOR_BANNER_SPEC_LABEL,
  SPONSOR_IMAGE_MAX_BYTES,
  SPONSOR_IMAGE_MAX_MB,
  SPONSOR_IMAGE_TYPES,
  SPONSOR_VIDEO_MAX_BYTES,
  SPONSOR_VIDEO_MAX_MB,
  SPONSOR_VIDEO_MAX_SECONDS,
  SPONSOR_VIDEO_TYPES,
  formatBytes,
  getVideoDuration,
  parseSponsorApiError,
  readFileAsDataUrl,
} from "@/lib/sponsor-media";

interface EventSponsorMediaManagerProps {
  eventId: string;
}

export function EventSponsorMediaManager({ eventId }: EventSponsorMediaManagerProps) {
  const [items, setItems] = useState<SponsorMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [sponsorName, setSponsorName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/sponsors`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar patrocinadores.");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar patrocinadores.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleUpload(file: File, mediaType: "IMAGE" | "VIDEO") {
    setUploadError(null);

    if (mediaType === "IMAGE") {
      if (!SPONSOR_IMAGE_TYPES.includes(file.type as (typeof SPONSOR_IMAGE_TYPES)[number])) {
        setUploadError("Use JPEG, PNG ou WebP para imagens.");
        return;
      }
      if (file.size > SPONSOR_IMAGE_MAX_BYTES) {
        setUploadError(
          `Imagem muito grande (${formatBytes(file.size)}). O limite é ${SPONSOR_IMAGE_MAX_MB} MB.`
        );
        return;
      }
    } else {
      if (!SPONSOR_VIDEO_TYPES.includes(file.type as (typeof SPONSOR_VIDEO_TYPES)[number])) {
        setUploadError("Use MP4 ou WebM para vídeos.");
        return;
      }
      if (file.size > SPONSOR_VIDEO_MAX_BYTES) {
        setUploadError(
          `Vídeo muito grande (${formatBytes(file.size)}). O limite é ${SPONSOR_VIDEO_MAX_MB} MB.`
        );
        return;
      }
      try {
        const duration = await getVideoDuration(file);
        if (duration > SPONSOR_VIDEO_MAX_SECONDS + 0.25) {
          setUploadError(`Vídeo deve ter no máximo ${SPONSOR_VIDEO_MAX_SECONDS} segundos.`);
          return;
        }
      } catch {
        setUploadError("Não foi possível validar a duração do vídeo.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const mediaUrl = await readFileAsDataUrl(file);
        const res = await fetch(`/api/admin/events/${eventId}/sponsors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sponsorName: sponsorName.trim() || null,
            mediaType,
            mediaUrl,
            linkUrl: linkUrl.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 413) {
            throw new Error(
              `Arquivo muito grande para enviar. Reduza a imagem para até ${SPONSOR_IMAGE_MAX_MB} MB.`
            );
          }
          throw new Error(parseSponsorApiError(data, "Erro ao salvar patrocinador."));
        }

        setSponsorName("");
        setLinkUrl("");
        await loadItems();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Erro ao salvar patrocinador.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remover esta mídia de patrocinador?")) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/sponsors/${id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao remover patrocinador.");
        await loadItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao remover patrocinador.");
      }
    });
  }

  function toggleActive(item: SponsorMediaItem) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/sponsors/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !item.isActive }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(parseSponsorApiError(data, "Erro ao atualizar patrocinador."));
        }
        await loadItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar patrocinador.");
      }
    });
  }

  return (
    <Card id="patrocinadores">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Patrocinadores (banner da home)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Envie imagens (até {SPONSOR_IMAGE_MAX_MB} MB) ou vídeos de até{" "}
          {SPONSOR_VIDEO_MAX_SECONDS}s (até {SPONSOR_VIDEO_MAX_MB} MB). As mídias ativas
          aparecem no slider promocional da página inicial.
        </p>
        <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">Tamanho do banner na home:</span>{" "}
          {SPONSOR_BANNER_SPEC_LABEL}. Use imagem ou vídeo nessa proporção para evitar
          cortes no slider.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sponsor-name">Nome do patrocinador (opcional)</Label>
            <Input
              id="sponsor-name"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              placeholder="Ex: Marca Parceira"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsor-link">Link do patrocinador (opcional)</Label>
            <Input
              id="sponsor-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => imageInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Adicionar imagem
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => videoInputRef.current?.click()}
            >
              <Video className="h-4 w-4" />
              Adicionar vídeo (5s)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{SPONSOR_BANNER_SPEC_LABEL}</p>
          <input
            ref={imageInputRef}
            type="file"
            accept={SPONSOR_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file, "IMAGE");
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept={SPONSOR_VIDEO_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file, "VIDEO");
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando patrocinadores...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma mídia de patrocinador cadastrada. Adicione imagens ou vídeos acima.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card",
                  !item.isActive && "opacity-60"
                )}
              >
                <div className={cn("relative bg-muted", SPONSOR_BANNER_ASPECT_CLASS)}>
                  {item.mediaType === "VIDEO" ? (
                    <video
                      src={item.mediaUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      loop
                      autoPlay
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.mediaUrl}
                      alt={item.sponsorName ?? "Patrocinador"}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <Badge
                    variant="secondary"
                    className="absolute left-2 top-2 bg-black/55 text-white"
                  >
                    {item.mediaType === "VIDEO" ? "Vídeo" : "Imagem"}
                  </Badge>
                </div>

                <div className="space-y-2 p-3">
                  <p className="text-sm font-medium line-clamp-1">
                    {item.sponsorName || "Patrocinador sem nome"}
                  </p>
                  {item.linkUrl && (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Link externo
                    </a>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => toggleActive(item)}
                    >
                      {item.isActive ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

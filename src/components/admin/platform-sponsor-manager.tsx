"use client";

/**
 * PlatformSponsorManager — cadastro de logos de patrocinadores globais (carrossel da home).
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ExternalLink,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlatformSponsorItem } from "@/lib/sponsor-media";
import {
  PLATFORM_SPONSOR_LOGO_MAX_BYTES,
  PLATFORM_SPONSOR_LOGO_MAX_MB,
  PLATFORM_SPONSOR_LOGO_SPEC_LABEL,
  SPONSOR_IMAGE_TYPES,
  formatBytes,
  parseSponsorApiError,
  readFileAsDataUrl,
} from "@/lib/sponsor-media";

export function PlatformSponsorManager() {
  const [items, setItems] = useState<PlatformSponsorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform-sponsors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar patrocinadores.");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar patrocinadores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleUpload(file: File) {
    setUploadError(null);

    if (!name.trim()) {
      setUploadError("Informe o nome do patrocinador antes de enviar a logo.");
      return;
    }

    if (!SPONSOR_IMAGE_TYPES.includes(file.type as (typeof SPONSOR_IMAGE_TYPES)[number])) {
      setUploadError("Use JPEG, PNG ou WebP para a logo.");
      return;
    }

    if (file.size > PLATFORM_SPONSOR_LOGO_MAX_BYTES) {
      setUploadError(
        `Logo muito grande (${formatBytes(file.size)}). O limite é ${PLATFORM_SPONSOR_LOGO_MAX_MB} MB.`
      );
      return;
    }

    startTransition(async () => {
      try {
        const logoUrl = await readFileAsDataUrl(file);
        const res = await fetch("/api/admin/platform-sponsors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            logoUrl,
            linkUrl: linkUrl.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 413) {
            throw new Error(
              `Arquivo muito grande para enviar. Reduza a logo para até ${PLATFORM_SPONSOR_LOGO_MAX_MB} MB.`
            );
          }
          throw new Error(parseSponsorApiError(data, "Erro ao salvar patrocinador."));
        }

        setName("");
        setLinkUrl("");
        await loadItems();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Erro ao salvar patrocinador.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remover este patrocinador?")) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/platform-sponsors/${id}`, {
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

  function toggleActive(item: PlatformSponsorItem) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/platform-sponsors/${item.id}`, {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" />
          Logos de patrocinadores
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cadastre logos exibidas no carrossel acima das categorias na página inicial.
          Imagens de até {PLATFORM_SPONSOR_LOGO_MAX_MB} MB.
        </p>
        <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">Tamanho recomendado:</span> {PLATFORM_SPONSOR_LOGO_SPEC_LABEL}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform-sponsor-name">Nome do patrocinador</Label>
            <Input
              id="platform-sponsor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marca Parceira"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-sponsor-link">Link (opcional)</Label>
            <Input
              id="platform-sponsor-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => logoInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Enviar logo
          </Button>
          <p className="text-xs text-muted-foreground">{PLATFORM_SPONSOR_LOGO_SPEC_LABEL}</p>
          <input
            ref={logoInputRef}
            type="file"
            accept={SPONSOR_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando patrocinadores...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum patrocinador cadastrado. Preencha os dados e envie uma logo acima.
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
                <div className="flex h-24 items-center justify-center bg-muted/40 px-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.logoUrl}
                    alt={item.name}
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>

                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

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

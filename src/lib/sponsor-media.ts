/** Limites e tipos para mídia de patrocinadores. */

import { z, type ZodError } from "zod";

export const SPONSOR_IMAGE_MAX_MB = 10;
export const SPONSOR_IMAGE_MAX_BYTES = SPONSOR_IMAGE_MAX_MB * 1024 * 1024;
/** Base64 aumenta ~37% — limite na API para o payload codificado. */
export const SPONSOR_IMAGE_MAX_ENCODED_BYTES = Math.ceil(SPONSOR_IMAGE_MAX_BYTES * 1.37);

export const SPONSOR_VIDEO_MAX_MB = 8;
export const SPONSOR_VIDEO_MAX_BYTES = SPONSOR_VIDEO_MAX_MB * 1024 * 1024;
export const SPONSOR_VIDEO_MAX_ENCODED_BYTES = Math.ceil(SPONSOR_VIDEO_MAX_BYTES * 1.37);
export const SPONSOR_VIDEO_MAX_SECONDS = 5;

export const SPONSOR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SPONSOR_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

/** Proporção do banner promocional na home (mesma de aspect-[42/9]). */
export const SPONSOR_BANNER_ASPECT_RATIO = "42:9";
export const SPONSOR_BANNER_RECOMMENDED_WIDTH = 1680;
export const SPONSOR_BANNER_RECOMMENDED_HEIGHT = 360;
export const SPONSOR_BANNER_ASPECT_CLASS = "aspect-[1680/360]";
/** Wrapper com padding-bottom para manter 1680×360 quando filhos são absolute. */
export const SPONSOR_BANNER_WRAPPER_CLASS = "relative w-full pb-[21.428571%]";
export const SPONSOR_BANNER_CANVAS_CLASS = "absolute inset-0";
export const SPONSOR_BANNER_SPEC_LABEL = `Proporção ${SPONSOR_BANNER_ASPECT_RATIO} · ideal ${SPONSOR_BANNER_RECOMMENDED_WIDTH}×${SPONSOR_BANNER_RECOMMENDED_HEIGHT} px`;
/** Tempo de exibição de cada patrocinador no slider da home. */
export const SPONSOR_BANNER_SLIDE_MS = 3000;

/** Logos de patrocinadores globais (carrossel acima das categorias). */
export const PLATFORM_SPONSOR_LOGO_MAX_MB = 2;
export const PLATFORM_SPONSOR_LOGO_MAX_BYTES = PLATFORM_SPONSOR_LOGO_MAX_MB * 1024 * 1024;
export const PLATFORM_SPONSOR_LOGO_MAX_ENCODED_BYTES = Math.ceil(
  PLATFORM_SPONSOR_LOGO_MAX_BYTES * 1.37
);
export const PLATFORM_SPONSOR_LOGO_RECOMMENDED_WIDTH = 240;
export const PLATFORM_SPONSOR_LOGO_RECOMMENDED_HEIGHT = 80;
export const PLATFORM_SPONSOR_LOGO_SPEC_LABEL = `Ideal ${PLATFORM_SPONSOR_LOGO_RECOMMENDED_WIDTH}×${PLATFORM_SPONSOR_LOGO_RECOMMENDED_HEIGHT} px · PNG/WebP com fundo transparente`;

export const SPONSOR_FIELD_LABELS: Record<string, string> = {
  sponsorName: "Nome do patrocinador",
  mediaType: "Tipo de mídia",
  mediaUrl: "Arquivo de mídia",
  linkUrl: "Link do patrocinador",
  sortOrder: "Ordem",
};

/** Aceita vazio, null ou URL com/sem https:// */
export const optionalSponsorLinkSchema = z.preprocess(
  (val) => {
    if (val == null || String(val).trim() === "") return null;
    const trimmed = String(val).trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  },
  z.union([
    z.null(),
    z.string().url({
      message: "Link inválido. Exemplo: https://marca.com.br ou deixe em branco.",
    }),
  ])
);

export interface SponsorMediaItem {
  id: string;
  eventId: string;
  sponsorName: string | null;
  mediaType: "IMAGE" | "VIDEO";
  mediaUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSponsorLogo {
  id: string;
  name: string;
  logoUrl: string;
  linkUrl: string | null;
  sortOrder: number;
}

export interface PlatformSponsorItem extends PlatformSponsorLogo {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformBannerItem {
  id: string;
  sponsorName: string | null;
  mediaType: "IMAGE" | "VIDEO";
  mediaUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromoSponsorSlide {
  id: string;
  sponsorName: string | null;
  mediaType: "IMAGE" | "VIDEO";
  mediaUrl: string;
  linkUrl: string | null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export function formatZodValidationError(
  error: ZodError,
  labels: Record<string, string> = SPONSOR_FIELD_LABELS
): string {
  const flat = error.flatten();
  const parts: string[] = [...flat.formErrors];

  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (messages?.length) {
      const label = labels[field] ?? field;
      parts.push(`${label}: ${messages.join(", ")}`);
    }
  }

  return parts.join(" ") || "Verifique os dados enviados.";
}

export function parseSponsorApiError(data: unknown, fallback = "Erro ao salvar patrocinador."): string {
  if (!data || typeof data !== "object") return fallback;

  const payload = data as {
    error?: string;
    details?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };
  };

  if (payload.error && payload.error !== "Dados inválidos.") {
    return payload.error;
  }

  const parts: string[] = [];
  if (payload.details?.formErrors?.length) {
    parts.push(...payload.details.formErrors);
  }
  if (payload.details?.fieldErrors) {
    for (const [field, messages] of Object.entries(payload.details.fieldErrors)) {
      if (messages?.length) {
        const label = SPONSOR_FIELD_LABELS[field] ?? field;
        parts.push(`${label}: ${messages.join(", ")}`);
      }
    }
  }

  return parts.join(" ") || payload.error || fallback;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a duração do vídeo."));
    };

    video.src = objectUrl;
  });
}

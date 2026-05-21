/**
 * GET  /api/admin/events/[id]/sponsors — lista mídias de patrocinadores
 * POST /api/admin/events/[id]/sponsors — adiciona mídia
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEventManager, canManageEvent } from "@/lib/event-auth";
import {
  SPONSOR_IMAGE_MAX_ENCODED_BYTES,
  SPONSOR_IMAGE_MAX_MB,
  SPONSOR_VIDEO_MAX_ENCODED_BYTES,
  SPONSOR_VIDEO_MAX_MB,
  formatBytes,
  formatZodValidationError,
  optionalSponsorLinkSchema,
} from "@/lib/sponsor-media";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSponsorSchema = z.object({
  sponsorName: z.string().max(120).optional().nullable(),
  mediaType: z.enum(["IMAGE", "VIDEO"], {
    errorMap: () => ({ message: "Tipo de mídia inválido. Use IMAGE ou VIDEO." }),
  }),
  mediaUrl: z
    .string({ required_error: "Arquivo de mídia é obrigatório." })
    .min(1, "Arquivo de mídia é obrigatório."),
  linkUrl: optionalSponsorLinkSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function validateMediaPayload(mediaType: "IMAGE" | "VIDEO", mediaUrl: string) {
  if (!mediaUrl.startsWith("data:") && !mediaUrl.startsWith("http")) {
    throw new Error(
      "Formato de mídia inválido. Envie uma imagem (JPEG, PNG ou WebP) ou vídeo (MP4/WebM)."
    );
  }

  if (mediaType === "IMAGE") {
    if (mediaUrl.startsWith("data:")) {
      const encodedSize = estimateDataUrlBytes(mediaUrl);
      if (encodedSize > SPONSOR_IMAGE_MAX_ENCODED_BYTES) {
        throw new Error(
          `Imagem muito grande (${formatBytes(encodedSize)}). O limite é ${SPONSOR_IMAGE_MAX_MB} MB por arquivo.`
        );
      }
    }
    return;
  }

  if (mediaUrl.startsWith("data:")) {
    const encodedSize = estimateDataUrlBytes(mediaUrl);
    if (encodedSize > SPONSOR_VIDEO_MAX_ENCODED_BYTES) {
      throw new Error(
        `Vídeo muito grande (${formatBytes(encodedSize)}). O limite é ${SPONSOR_VIDEO_MAX_MB} MB por arquivo.`
      );
    }
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireEventManager();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    if (!(await canManageEvent(session, id))) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const sponsors = await prisma.eventSponsorMedia.findMany({
      where: { eventId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(sponsors);
  } catch (error) {
    console.error("[GET /api/admin/events/[id]/sponsors]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await requireEventManager();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    if (!(await canManageEvent(session, id))) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o envio. Se a imagem for muito grande, reduza o tamanho ou use outro formato.",
        },
        { status: 400 }
      );
    }

    const body = createSponsorSchema.parse(json);
    validateMediaPayload(body.mediaType, body.mediaUrl);

    const count = await prisma.eventSponsorMedia.count({ where: { eventId: id } });
    const sortOrder = body.sortOrder ?? count;

    const sponsor = await prisma.eventSponsorMedia.create({
      data: {
        eventId: id,
        sponsorName: body.sponsorName?.trim() || null,
        mediaType: body.mediaType,
        mediaUrl: body.mediaUrl,
        linkUrl: body.linkUrl,
        sortOrder,
      },
    });

    return NextResponse.json(sponsor, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = formatZodValidationError(error);
      return NextResponse.json(
        { error: message, details: error.flatten() },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/admin/events/[id]/sponsors]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

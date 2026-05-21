/**
 * GET  /api/admin/platform-sponsors — lista patrocinadores da plataforma
 * POST /api/admin/platform-sponsors — adiciona patrocinador
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/event-auth";
import {
  PLATFORM_SPONSOR_LOGO_MAX_ENCODED_BYTES,
  PLATFORM_SPONSOR_LOGO_MAX_MB,
  formatBytes,
  formatZodValidationError,
  optionalSponsorLinkSchema,
} from "@/lib/sponsor-media";

const PLATFORM_SPONSOR_FIELD_LABELS: Record<string, string> = {
  name: "Nome do patrocinador",
  logoUrl: "Logo",
  linkUrl: "Link do patrocinador",
  sortOrder: "Ordem",
};

const createPlatformSponsorSchema = z.object({
  name: z
    .string({ required_error: "Nome do patrocinador é obrigatório." })
    .trim()
    .min(1, "Nome do patrocinador é obrigatório.")
    .max(120),
  logoUrl: z
    .string({ required_error: "Logo é obrigatória." })
    .min(1, "Logo é obrigatória."),
  linkUrl: optionalSponsorLinkSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function validateLogoPayload(logoUrl: string) {
  if (!logoUrl.startsWith("data:") && !logoUrl.startsWith("http")) {
    throw new Error(
      "Formato de logo inválido. Envie uma imagem JPEG, PNG ou WebP."
    );
  }

  if (logoUrl.startsWith("data:")) {
    const encodedSize = estimateDataUrlBytes(logoUrl);
    if (encodedSize > PLATFORM_SPONSOR_LOGO_MAX_ENCODED_BYTES) {
      throw new Error(
        `Logo muito grande (${formatBytes(encodedSize)}). O limite é ${PLATFORM_SPONSOR_LOGO_MAX_MB} MB por arquivo.`
      );
    }
  }
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const sponsors = await prisma.platformSponsor.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(sponsors);
  } catch (error) {
    console.error("[GET /api/admin/platform-sponsors]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o envio. Se a logo for muito grande, reduza o tamanho ou use outro formato.",
        },
        { status: 400 }
      );
    }

    const body = createPlatformSponsorSchema.parse(json);
    validateLogoPayload(body.logoUrl);

    const count = await prisma.platformSponsor.count();
    const sortOrder = body.sortOrder ?? count;

    const sponsor = await prisma.platformSponsor.create({
      data: {
        name: body.name,
        logoUrl: body.logoUrl,
        linkUrl: body.linkUrl,
        sortOrder,
      },
    });

    return NextResponse.json(sponsor, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = formatZodValidationError(error, PLATFORM_SPONSOR_FIELD_LABELS);
      return NextResponse.json(
        { error: message, details: error.flatten() },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/admin/platform-sponsors]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/**
 * PATCH  /api/admin/platform-banners/[id]
 * DELETE /api/admin/platform-banners/[id]
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/event-auth";
import { formatZodValidationError, optionalSponsorLinkSchema } from "@/lib/sponsor-media";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const patchBannerSchema = z.object({
  sponsorName: z.string().max(120).optional().nullable(),
  linkUrl: optionalSponsorLinkSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.platformBannerMedia.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler os dados enviados." },
        { status: 400 }
      );
    }

    const body = patchBannerSchema.parse(json);

    const banner = await prisma.platformBannerMedia.update({
      where: { id },
      data: {
        ...(body.sponsorName !== undefined && {
          sponsorName: body.sponsorName?.trim() || null,
        }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(banner);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = formatZodValidationError(error);
      return NextResponse.json(
        { error: message, details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/admin/platform-banners/[id]]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.platformBannerMedia.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
    }

    await prisma.platformBannerMedia.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/platform-banners/[id]]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

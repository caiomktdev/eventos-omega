/**
 * PATCH  /api/admin/platform-sponsors/[id]
 * DELETE /api/admin/platform-sponsors/[id]
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/event-auth";
import {
  formatZodValidationError,
  optionalSponsorLinkSchema,
} from "@/lib/sponsor-media";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PLATFORM_SPONSOR_FIELD_LABELS: Record<string, string> = {
  name: "Nome do patrocinador",
  linkUrl: "Link do patrocinador",
  sortOrder: "Ordem",
};

const patchPlatformSponsorSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
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

    const existing = await prisma.platformSponsor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Patrocinador não encontrado." }, { status: 404 });
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

    const body = patchPlatformSponsorSchema.parse(json);

    const sponsor = await prisma.platformSponsor.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(sponsor);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = formatZodValidationError(error, PLATFORM_SPONSOR_FIELD_LABELS);
      return NextResponse.json(
        { error: message, details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/admin/platform-sponsors/[id]]", error);
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

    const existing = await prisma.platformSponsor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Patrocinador não encontrado." }, { status: 404 });
    }

    await prisma.platformSponsor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/platform-sponsors/[id]]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

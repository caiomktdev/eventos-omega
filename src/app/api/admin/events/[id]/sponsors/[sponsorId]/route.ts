/**
 * PATCH  /api/admin/events/[id]/sponsors/[sponsorId]
 * DELETE /api/admin/events/[id]/sponsors/[sponsorId]
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEventManager, canManageEvent } from "@/lib/event-auth";
import { formatZodValidationError, optionalSponsorLinkSchema } from "@/lib/sponsor-media";

interface RouteContext {
  params: Promise<{ id: string; sponsorId: string }>;
}

const patchSponsorSchema = z.object({
  sponsorName: z.string().max(120).optional().nullable(),
  linkUrl: optionalSponsorLinkSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await requireEventManager();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id, sponsorId } = await params;
    if (!(await canManageEvent(session, id))) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const existing = await prisma.eventSponsorMedia.findFirst({
      where: { id: sponsorId, eventId: id },
    });
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

    const body = patchSponsorSchema.parse(json);

    const sponsor = await prisma.eventSponsorMedia.update({
      where: { id: sponsorId },
      data: {
        ...(body.sponsorName !== undefined && {
          sponsorName: body.sponsorName?.trim() || null,
        }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(sponsor);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = formatZodValidationError(error);
      return NextResponse.json(
        { error: message, details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/admin/events/[id]/sponsors/[sponsorId]]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireEventManager();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id, sponsorId } = await params;
    if (!(await canManageEvent(session, id))) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const existing = await prisma.eventSponsorMedia.findFirst({
      where: { id: sponsorId, eventId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Patrocinador não encontrado." }, { status: 404 });
    }

    await prisma.eventSponsorMedia.delete({ where: { id: sponsorId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/events/[id]/sponsors/[sponsorId]]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

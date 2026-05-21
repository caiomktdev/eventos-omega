/**
 * GET /api/events — lista eventos publicados (público)
 * POST /api/events — cria novo evento (requer sessão ADMIN ou ORGANIZER)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "@/lib/validations";
import { generateSlug, uniqueSlug } from "@/lib/utils";
import { auth } from "@/auth";
import { ZodError } from "zod";
import type { UserRole } from "@prisma/client";

const ALLOWED_CREATOR_ROLES: UserRole[] = ["ADMIN", "ORGANIZER"];

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      include: {
        organizer: { select: { id: true, name: true, image: true } },
        ticketTypes: true,
        _count: { select: { participants: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error("[GET /api/events]", err);
    return NextResponse.json(
      { error: "Erro ao buscar eventos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (
    !session?.user?.id ||
    !ALLOWED_CREATOR_ROLES.includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createEventSchema.parse(body);

    // Gera slug único a partir do título (ex: "festival-rock-2026")
    const baseSlug = generateSlug(data.title);
    const slug = await uniqueSlug(baseSlug, (s) =>
      prisma.event.findUnique({ where: { slug: s } }).then(Boolean)
    );

    const event = await prisma.event.create({
      data: {
        slug,
        title: data.title,
        description: data.description,
        coverImage: data.coverImage || null,
        venue: data.venue,
        address: data.address,
        city: data.city,
        state: data.state.toUpperCase(),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: "PUBLISHED",
        organizerId: session.user.id,
        // formStructure padrão (sem campos extras); pode ser customizado depois
        formStructure: { fields: [] },
        ticketTypes: {
          create: data.ticketTypes.map((t) => ({
            name: t.name,
            description: t.description,
            price: t.price,
            totalQuantity: t.totalQuantity,
            maxPerOrder: t.maxPerOrder ?? 10,
            salesStartDate: t.salesStartDate
              ? new Date(t.salesStartDate)
              : null,
            salesEndDate: t.salesEndDate ? new Date(t.salesEndDate) : null,
          })),
        },
      },
    });

    return NextResponse.json({ eventId: event.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }
    console.error("[POST /api/events]", err);
    return NextResponse.json(
      { error: "Erro ao criar evento." },
      { status: 500 }
    );
  }
}

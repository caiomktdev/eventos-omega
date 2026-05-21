/**
 * GET  /api/admin/events — lista todos os eventos (todos os status) com métricas
 * POST /api/admin/events — cria novo evento com formStructure personalizado
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { generateSlug, uniqueSlug } from "@/lib/utils";
import { requireEventManager } from "@/lib/event-auth";
import type { EventFormStructure } from "@/types";

// ---------------------------------------------------------------------------
// Schema de validação para criação de evento pelo admin/organizador
// ---------------------------------------------------------------------------
const formFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z_][a-z0-9_]*$/, "O nome do campo deve ser snake_case."),
  label: z.string().min(1, "Label obrigatório."),
  type: z.enum(["text", "email", "tel", "number", "url", "select", "checkbox", "textarea"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
});

const adminEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  // Aceita URL http(s) OU data URL (base64) OU string vazia
  coverImage: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  venue: z.string().min(2).max(100),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(80),
  state: z.string().length(2),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  producerName: z.string().max(100).optional(),
  producerBio: z.string().max(1500).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  formStructure: z
    .object({ fields: z.array(formFieldSchema) })
    .default({ fields: [] }),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        description: z.string().optional(),
        price: z.number().min(0),
        totalQuantity: z.number().int().positive(),
        maxPerOrder: z.number().int().min(1).max(100).default(10),
      })
    )
    .min(1),
});

export type AdminEventInput = z.infer<typeof adminEventSchema>;

// ---------------------------------------------------------------------------
// GET — lista todos os eventos com métricas de participantes
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await requireEventManager();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const events = await prisma.event.findMany({
      where:
        session.user.role === "ADMIN"
          ? undefined
          : { organizerId: session.user.id },
      include: {
        organizer: { select: { id: true, name: true } },
        ticketTypes: { select: { id: true, name: true, price: true, totalQuantity: true, soldQuantity: true } },
        _count: { select: { participants: true } },
        participants: {
          where: { status: "CONFIRMED" },
          select: { transaction: { select: { grossValue: true, mooveFee: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const eventsWithMetrics = events.map((e) => {
      const confirmedRevenue = e.participants.reduce(
        (sum, p) => sum + Number(p.transaction?.grossValue ?? 0),
        0
      );
      const totalMooveFees = e.participants.reduce(
        (sum, p) => sum + Number(p.transaction?.mooveFee ?? 0),
        0
      );

      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        venue: e.venue,
        city: e.city,
        state: e.state,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        coverImage: e.coverImage,
        organizer: e.organizer,
        ticketTypes: e.ticketTypes,
        formStructure: e.formStructure,
        totalParticipants: e._count.participants,
        confirmedParticipants: e.participants.length,
        confirmedRevenue,
        totalMooveFees,
        createdAt: e.createdAt,
      };
    });

    return NextResponse.json(eventsWithMetrics);
  } catch (err) {
    console.error("[GET /api/admin/events]", err);
    return NextResponse.json({ error: "Erro ao buscar eventos." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — cria evento com slug automático e formStructure personalizado
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const session = await requireEventManager();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = adminEventSchema.parse(body);

    for (const field of data.formStructure.fields) {
      if (field.type === "select" && (!field.options || field.options.length === 0)) {
        return NextResponse.json(
          { error: `Campo "${field.label}" do tipo 'select' precisa de ao menos uma opção.` },
          { status: 422 }
        );
      }
    }

    const baseSlug = generateSlug(data.title);
    const slug = await uniqueSlug(baseSlug, (s) =>
      prisma.event.findUnique({ where: { slug: s } }).then(Boolean)
    );

    const demoOrganizerId =
      process.env.NODE_ENV === "development"
        ? process.env.DEMO_ORGANIZER_ID
        : undefined;
    const organizerId =
      session.user.role === "ADMIN" && demoOrganizerId
        ? demoOrganizerId
        : session.user.id;

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
        status: data.status,
        organizerId,
        producerName: data.producerName || null,
        producerBio: data.producerBio || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formStructure: data.formStructure as any,
        ticketTypes: {
          create: data.ticketTypes.map((t) => ({
            name: t.name,
            description: t.description,
            price: t.price,
            totalQuantity: t.totalQuantity,
            maxPerOrder: t.maxPerOrder,
          })),
        },
      },
      select: { id: true, slug: true, title: true, status: true },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }
    console.error("[POST /api/admin/events]", err);
    return NextResponse.json({ error: "Erro ao criar evento." }, { status: 500 });
  }
}

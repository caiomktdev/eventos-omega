/**
 * GET   /api/admin/events/[id] — detalhes do evento com participantes paginados
 * PATCH /api/admin/events/[id] — atualiza campos do evento, incluindo TicketTypes
 *
 * Regra de negócio (TicketTypes na edição):
 *  - Tickets com `id` existente: atualiza; bloqueia se totalQuantity < soldQuantity.
 *  - Tickets sem `id`: cria novos.
 *  - Nenhum ticket é deletado via este endpoint (segurança: pode ter participantes).
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEventManager, canManageEvent } from "@/lib/event-auth";
import type { EventFormStructure } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ticketTypePatchSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  price: z.number().min(0),
  totalQuantity: z.number().int().positive(),
  maxPerOrder: z.number().int().min(1).max(100),
});

const formFieldPatchSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "email", "tel", "number", "url", "select", "checkbox", "textarea"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const patchEventSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(5000).optional(),
  coverImage: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v?.trim() === "" ? null : v)),
  venue: z.string().min(2).max(100).optional(),
  address: z.string().min(5).max(300).optional(),
  city: z.string().min(2).max(80).optional(),
  state: z.string().length(2).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "FINISHED"]).optional(),
  producerName: z.string().max(100).optional().nullable(),
  producerBio: z.string().max(1500).optional().nullable(),
  formStructure: z
    .object({
      fields: z.array(formFieldPatchSchema),
    })
    .optional()
    .transform((structure) => {
      if (!structure) return structure;
      return {
        fields: structure.fields.filter(
          (f) => f.name.trim().length > 0 && f.label.trim().length > 0
        ),
      };
    }),
  ticketTypes: z.array(ticketTypePatchSchema).optional(),
});

// ---------------------------------------------------------------------------
// GET — evento com participantes e transações
// ---------------------------------------------------------------------------
export async function GET(req: Request, { params }: RouteContext) {
  const session = await requireEventManager();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!(await canManageEvent(session, id))) {
      return NextResponse.json({ error: "Sem permissão para este evento." }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const perPage = Math.min(100, Number(url.searchParams.get("perPage") ?? "50"));
    const search = url.searchParams.get("search") ?? "";

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        ticketTypes: { orderBy: { price: "asc" } },
        _count: { select: { participants: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const [participants, total] = await Promise.all([
      prisma.participant.findMany({
        where: { eventId: id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          ticketType: { select: { id: true, name: true, price: true } },
          transaction: {
            select: {
              id: true,
              status: true,
              grossValue: true,
              mooveFee: true,
              organizerNetValue: true,
              paymentMethod: true,
              paidAt: true,
              mercadoPagoPaymentId: true,
            },
          },
        },
        orderBy: { ordemCompra: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.participant.count({ where: { eventId: id } }),
    ]);

    const filtered = search
      ? participants.filter((p) => {
          const fd = p.formData as Record<string, unknown>;
          const haystack = [
            String(fd.nome ?? ""),
            String(fd.email ?? ""),
            p.user.email,
            String(p.ordemCompra),
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(search.toLowerCase());
        })
      : participants;

    return NextResponse.json({
      event,
      participants: filtered,
      pagination: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    });
  } catch (err) {
    console.error("[GET /api/admin/events/[id]]", err);
    return NextResponse.json({ error: "Erro ao buscar evento." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — atualiza campos do evento + ticket types
// ---------------------------------------------------------------------------
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireEventManager();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!(await canManageEvent(session, id))) {
      return NextResponse.json({ error: "Sem permissão para este evento." }, { status: 403 });
    }

    const eventExists = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!eventExists) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const data = patchEventSchema.parse(body);

    if (data.formStructure) {
      for (const field of data.formStructure.fields) {
        if (
          field.type === "select" &&
          (!field.options || field.options.length === 0)
        ) {
          return NextResponse.json(
            {
              error: `Campo "${field.label}" do tipo seleção precisa de ao menos uma opção.`,
            },
            { status: 422 }
          );
        }
      }
    }

    // ── Processa ticket types ─────────────────────────────────────────────
    if (data.ticketTypes && data.ticketTypes.length > 0) {
      for (const ticket of data.ticketTypes) {
        if (ticket.id) {
          // Atualiza existente — valida totalQuantity >= soldQuantity
          const existing = await prisma.ticketType.findUnique({
            where: { id: ticket.id },
            select: { soldQuantity: true, eventId: true, name: true },
          });

          if (!existing || existing.eventId !== id) {
            return NextResponse.json(
              { error: `Ingresso ID "${ticket.id}" não pertence a este evento.` },
              { status: 400 }
            );
          }

          if (ticket.totalQuantity < existing.soldQuantity) {
            return NextResponse.json(
              {
                error: `Não é possível reduzir "${existing.name}" para ${ticket.totalQuantity} unidades: ${existing.soldQuantity} já foram vendidas.`,
              },
              { status: 422 }
            );
          }

          await prisma.ticketType.update({
            where: { id: ticket.id },
            data: {
              name: ticket.name,
              description: ticket.description,
              price: ticket.price,
              totalQuantity: ticket.totalQuantity,
              maxPerOrder: ticket.maxPerOrder,
            },
          });
        } else {
          // Cria novo ticket type
          await prisma.ticketType.create({
            data: {
              eventId: id,
              name: ticket.name,
              description: ticket.description,
              price: ticket.price,
              totalQuantity: ticket.totalQuantity,
              maxPerOrder: ticket.maxPerOrder,
            },
          });
        }
      }
    }

    // ── Atualiza campos do evento ─────────────────────────────────────────
    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
        ...(data.venue && { venue: data.venue }),
        ...(data.address && { address: data.address }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state.toUpperCase() }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.status && { status: data.status }),
        ...(data.producerName !== undefined && { producerName: data.producerName }),
        ...(data.producerBio !== undefined && { producerBio: data.producerBio }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.formStructure && { formStructure: data.formStructure as any }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        formStructure: true,
        ticketTypes: { orderBy: { price: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }
    console.error("[PATCH /api/admin/events/[id]]", err);
    return NextResponse.json({ error: "Erro ao atualizar evento." }, { status: 500 });
  }
}

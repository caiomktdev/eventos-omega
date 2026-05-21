/**
 * PATCH /api/admin/participants/[id]
 *
 * Permite ao admin corrigir qualquer campo do formData de um participante
 * (ex: CPF digitado errado, tamanho de camiseta incorreto).
 *
 * Apenas os campos do formData são atualizáveis por este endpoint.
 * Status e dados financeiros exigem fluxos próprios.
 *
 * O patch é MERGEABLE: apenas os campos enviados são atualizados,
 * o restante do formData original é preservado.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEventManager, canManageParticipant } from "@/lib/event-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const patchParticipantSchema = z.object({
  formData: z
    .record(z.union([z.string(), z.boolean(), z.number()]))
    .refine((d) => Object.keys(d).length > 0, {
      message: "Envie ao menos um campo para atualizar.",
    }),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireEventManager();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!(await canManageParticipant(session, id))) {
      return NextResponse.json({ error: "Sem permissão para este participante." }, { status: 403 });
    }

    const body = await request.json();
    const { formData: patchFields } = patchParticipantSchema.parse(body);

    const participant = await prisma.participant.findUnique({
      where: { id },
      select: {
        id: true,
        ordemCompra: true,
        formData: true,
        event: {
          select: {
            formStructure: true,
            title: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Participante não encontrado." },
        { status: 404 }
      );
    }

    // Merge: preserva campos existentes, sobrescreve apenas os enviados
    const existingFormData = participant.formData as Record<string, unknown>;
    const updatedFormData = { ...existingFormData, ...patchFields };

    const updated = await prisma.participant.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { formData: updatedFormData as any },
      select: {
        id: true,
        ordemCompra: true,
        formData: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      participantId: updated.id,
      ordemCompra: updated.ordemCompra,
      formData: updated.formData,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: err.flatten().fieldErrors },
        { status: 422 }
      );
    }
    console.error("[PATCH /api/admin/participants/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao atualizar participante." },
      { status: 500 }
    );
  }
}

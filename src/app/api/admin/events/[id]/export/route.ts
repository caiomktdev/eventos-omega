/**
 * GET /api/admin/events/[id]/export
 *
 * Exporta a lista completa de participantes de um evento em formato CSV.
 *
 * Query params:
 *   ?orderBy=ordemCompra  — ordena pelo número sequencial de compra (padrão)
 *   ?orderBy=nome         — ordena alfabeticamente (A-Z) pelo campo 'nome' do formData
 *
 * O CSV inclui:
 *   - Colunas fixas: #Ordem, Nome, E-mail, Tipo de Ingresso,
 *                    Status Inscrição, Status Pagamento,
 *                    Valor Bruto (R$), Taxa Moove (R$), Repasse Org. (R$),
 *                    Pago em, ID Pagamento MP
 *   - Colunas dinâmicas: todos os campos extras definidos em Event.formStructure
 *
 * Retorna com Content-Disposition: attachment para forçar download no browser.
 * Prefixo BOM (U+FEFF) garante compatibilidade de UTF-8 com Excel no Windows.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEventManager, canManageEvent } from "@/lib/event-auth";
import type { EventFormStructure, FormField } from "@/types";

// ---------------------------------------------------------------------------
// Mapeamentos de status → rótulo legível no CSV
// ---------------------------------------------------------------------------

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  REGISTERED:  "Aguardando pagamento",
  CONFIRMED:   "Confirmado",
  CHECKED_IN:  "Check-in realizado",
  CANCELLED:   "Cancelado",
  REFUNDED:    "Estornado",
};

const TX_STATUS_LABEL: Record<string, string> = {
  PENDING:      "Pendente",
  APPROVED:     "Aprovado",
  REJECTED:     "Recusado",
  CANCELLED:    "Cancelado",
  REFUNDED:     "Estornado",
  IN_PROCESS:   "Em análise",
  IN_MEDIATION: "Em disputa",
  CHARGED_BACK: "Chargeback",
};

// ---------------------------------------------------------------------------
// Escape de célula CSV
// RFC 4180: valores com vírgula, aspas ou quebra de linha são envolvidos em
// aspas duplas; aspas duplas internas são duplicadas ("").
// ---------------------------------------------------------------------------

function csvCell(val: unknown): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

// ---------------------------------------------------------------------------
// Formatação de data para o CSV (dd/MM/yyyy HH:mm)
// ---------------------------------------------------------------------------

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await requireEventManager();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id: eventId } = await params;

    if (!(await canManageEvent(session, eventId))) {
      return NextResponse.json({ error: "Sem permissão para este evento." }, { status: 403 });
    }

    const includeFinancialDetails = session.user.role === "ADMIN";
    const url = new URL(req.url);
    const orderByParam = url.searchParams.get("orderBy") ?? "ordemCompra";

    // -----------------------------------------------------------------------
    // 1. Busca o evento para obter título e formStructure
    // -----------------------------------------------------------------------
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        formStructure: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const formStructure = (
      typeof event.formStructure === "object" && event.formStructure !== null
        ? event.formStructure
        : { fields: [] }
    ) as unknown as EventFormStructure;

    const extraFields: FormField[] = formStructure.fields ?? [];

    // -----------------------------------------------------------------------
    // 2. Busca TODOS os participantes (sem paginação)
    //    Ordenação por ordemCompra no banco; ordenação por nome é feita em memória
    //    (formData é JSON — não filtrável diretamente via ORDER BY no Prisma)
    // -----------------------------------------------------------------------
    const participants = await prisma.participant.findMany({
      where: { eventId },
      include: {
        user:       { select: { name: true, email: true } },
        ticketType: { select: { name: true } },
        transaction: {
          select: {
            status: true,
            grossValue: true,
            mooveFee: true,
            organizerNetValue: true,
            paidAt: true,
            mercadoPagoPaymentId: true,
          },
        },
      },
      orderBy: { ordemCompra: "asc" }, // base sempre por compra; reordenado abaixo se necessário
    });

    // -----------------------------------------------------------------------
    // 3. Ordena por nome em memória se solicitado
    // -----------------------------------------------------------------------
    const sorted = orderByParam === "nome"
      ? [...participants].sort((a, b) => {
          const nameA = String(
            (a.formData as Record<string, unknown>).nome ?? a.user.name ?? ""
          ).toLowerCase();
          const nameB = String(
            (b.formData as Record<string, unknown>).nome ?? b.user.name ?? ""
          ).toLowerCase();
          return nameA.localeCompare(nameB, "pt-BR");
        })
      : participants; // já vem ordenado por ordemCompra do banco

    // -----------------------------------------------------------------------
    // 4. Monta cabeçalho CSV
    // -----------------------------------------------------------------------
    const fixedHeaders = [
      "#Ordem",
      "Nome",
      "E-mail",
      "Tipo de Ingresso",
      "Status Inscrição",
      "Status Pagamento",
      "Valor Bruto (R$)",
      ...(includeFinancialDetails
        ? ["Taxa Moove (R$)", "Repasse Org. (R$)"]
        : []),
      "Pago em",
      "ID Pagamento MP",
    ];

    const dynamicHeaders = extraFields.map((f) => f.label);
    const headers = [...fixedHeaders, ...dynamicHeaders];

    // -----------------------------------------------------------------------
    // 5. Monta linhas CSV
    // -----------------------------------------------------------------------
    const rows = sorted.map((p) => {
      const fd = p.formData as Record<string, unknown>;
      const tx = p.transaction;

      const fixedCells = [
        String(p.ordemCompra).padStart(5, "0"),
        fd.nome ?? p.user.name ?? "",
        fd.email ?? p.user.email ?? "",
        p.ticketType.name,
        PARTICIPANT_STATUS_LABEL[p.status] ?? p.status,
        tx ? (TX_STATUS_LABEL[tx.status] ?? tx.status) : "",
        tx ? Number(tx.grossValue).toFixed(2) : "",
        ...(includeFinancialDetails
          ? [
              tx ? Number(tx.mooveFee).toFixed(2) : "",
              tx ? Number(tx.organizerNetValue).toFixed(2) : "",
            ]
          : []),
        tx?.paidAt ? fmtDate(tx.paidAt) : "",
        tx?.mercadoPagoPaymentId ?? "",
      ];

      const dynamicCells = extraFields.map((f) => {
        const val = fd[f.name];
        return val !== undefined && val !== null ? val : "";
      });

      return csvRow([...fixedCells, ...dynamicCells]);
    });

    // -----------------------------------------------------------------------
    // 6. Monta o CSV final com BOM UTF-8 para compatibilidade com Excel
    // -----------------------------------------------------------------------
    const bom = "\uFEFF";
    const csvContent = bom + [csvRow(headers), ...rows].join("\r\n");

    // Nome do arquivo reflete o evento e a ordenação escolhida
    const safeName = event.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")  // remove acentos
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 50);

    const orderLabel = orderByParam === "nome" ? "alfa" : "ordem";
    const filename = `participantes_${safeName}_${orderLabel}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/events/[id]/export]", err);
    return NextResponse.json(
      { error: "Erro interno ao gerar exportação." },
      { status: 500 }
    );
  }
}

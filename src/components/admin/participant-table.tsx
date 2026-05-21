/**
 * ParticipantTable — tabela de participantes do evento com:
 *   - Busca por nome/email/ordem
 *   - Badge de status da inscrição e do pagamento
 *   - Botão "Editar" que abre o ParticipantEditDialog
 *   - Exibe campos extras do formData como tooltip/coluna
 */

"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  Download,
  ArrowDownAZ,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/fee";
import {
  ParticipantEditDialog,
  type ParticipantData,
} from "@/components/admin/participant-edit-dialog";
import type { EventFormStructure } from "@/types";

// ---------------------------------------------------------------------------
// Tipos vindos da API admin
// ---------------------------------------------------------------------------

export interface ParticipantRow {
  id: string;
  ordemCompra: number;
  status: string;
  formData: Record<string, string | boolean | number>;
  createdAt: string;
  ticketType: { id: string; name: string; price: string };
  user: { id: string; name: string; email: string };
  transaction: {
    id: string;
    status: string;
    grossValue: string;
    mooveFee: string;
    organizerNetValue: string;
    paymentMethod: string | null;
    paidAt: string | null;
    mercadoPagoPaymentId: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Badges de status
// ---------------------------------------------------------------------------

const PARTICIPANT_STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  REGISTERED: { label: "Aguardando", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "success" },
  CHECKED_IN: { label: "Check-in", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  REFUNDED: { label: "Estornado", variant: "outline" },
};

const TX_STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  PENDING: { label: "Pendente", variant: "warning" },
  APPROVED: { label: "Aprovado", variant: "success" },
  REJECTED: { label: "Recusado", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  REFUNDED: { label: "Estornado", variant: "outline" },
  IN_PROCESS: { label: "Em análise", variant: "secondary" },
  IN_MEDIATION: { label: "Disputa", variant: "warning" },
  CHARGED_BACK: { label: "Chargeback", variant: "destructive" },
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface ParticipantTableProps {
  eventId: string;
  participants: ParticipantRow[];
  formStructure: EventFormStructure;
}

type ExportOrderBy = "ordemCompra" | "nome";

const PAGE_SIZE = 15;

export function ParticipantTable({
  eventId,
  participants: initialParticipants,
  formStructure,
}: ParticipantTableProps) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantRow | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOrderBy, setExportOrderBy] = useState<ExportOrderBy>("ordemCompra");
  const [isExporting, setIsExporting] = useState(false);

  // Busca client-side
  const filtered = useMemo(() => {
    if (!search.trim()) return participants;
    const q = search.toLowerCase();
    return participants.filter((p) => {
      const fd = p.formData;
      const extraValues = formStructure.fields
        .map((f) => String(fd[f.name] ?? ""))
        .join(" ");
      return (
        String(fd.nome ?? "").toLowerCase().includes(q) ||
        String(fd.email ?? "").toLowerCase().includes(q) ||
        extraValues.toLowerCase().includes(q) ||
        p.user.email.toLowerCase().includes(q) ||
        String(p.ordemCompra).includes(q) ||
        p.ticketType.name.toLowerCase().includes(q)
      );
    });
  }, [participants, search, formStructure.fields]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handleParticipantUpdated(updated: ParticipantData) {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === updated.id ? { ...p, formData: updated.formData } : p
      )
    );
  }

  async function handleExportConfirm() {
    setIsExporting(true);
    try {
      const url = `/api/admin/events/${eventId}/export?orderBy=${exportOrderBy}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao gerar exportação.");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "participantes.csv";

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      setShowExportModal(false);
    } catch {
      alert("Erro ao exportar. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  }

  // Colunas extras do formStructure (todos os campos configurados)
  const extraCols = formStructure.fields;

  return (
    <div className="space-y-4">
      {/* Header + busca + exportar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            <strong className="text-foreground">{filtered.length}</strong> de{" "}
            {participants.length} participante
            {participants.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome, e-mail ou #ordem..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-64 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setShowExportModal(true)}
            disabled={participants.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Lista
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20">
                  #Ordem
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  E-mail
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Ingresso
                </th>
                {extraCols.map((col) => (
                  <th
                    key={col.name}
                    className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Inscrição
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Pagamento
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Data
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-16">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={9 + extraCols.length}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Nenhum participante encontrado.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const fd = p.formData;
                  const pStatus = PARTICIPANT_STATUS_BADGE[p.status] ?? {
                    label: p.status,
                    variant: "secondary" as const,
                  };
                  const txStatus = p.transaction
                    ? (TX_STATUS_BADGE[p.transaction.status] ?? {
                        label: p.transaction.status,
                        variant: "secondary" as const,
                      })
                    : null;

                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      {/* Ordem */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        #{String(p.ordemCompra).padStart(5, "0")}
                      </td>

                      {/* Nome */}
                      <td className="px-4 py-3 max-w-[140px]">
                        <p className="font-medium truncate">
                          {String(fd.nome ?? p.user.name ?? "—")}
                        </p>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-muted-foreground truncate text-xs">
                          {String(fd.email ?? p.user.email ?? "—")}
                        </p>
                      </td>

                      {/* Ingresso */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs">{p.ticketType.name}</span>
                      </td>

                      {/* Campos extras */}
                      {extraCols.map((col) => (
                        <td key={col.name} className="px-4 py-3 max-w-[120px]">
                          <span className="text-xs text-muted-foreground truncate block">
                            {fd[col.name] !== undefined && fd[col.name] !== ""
                              ? String(fd[col.name])
                              : <span className="text-muted-foreground/40">—</span>}
                          </span>
                        </td>
                      ))}

                      {/* Status inscrição */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={pStatus.variant as "default" | "secondary" | "destructive" | "outline"} className="text-xs">
                          {pStatus.label}
                        </Badge>
                      </td>

                      {/* Status pagamento */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {txStatus ? (
                          <Badge variant={txStatus.variant as "default" | "secondary" | "destructive" | "outline"} className="text-xs">
                            {txStatus.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium">
                          {p.transaction
                            ? formatCurrency(Number(p.transaction.grossValue))
                            : "—"}
                        </span>
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(p.createdAt), "dd/MM/yy HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingParticipant(p)}
                          title="Editar dados do participante"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal de Exportação                                                */}
      {/* ------------------------------------------------------------------ */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isExporting && setShowExportModal(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border bg-background shadow-2xl p-6">
            {/* Header do modal */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold">Exportar Lista de Participantes</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mr-1"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              O arquivo CSV incluirá todos os {participants.length} participante
              {participants.length !== 1 ? "s" : ""} com campos do formulário e dados financeiros.
            </p>

            <Separator className="mb-5" />

            {/* Seleção de ordenação */}
            <fieldset className="space-y-3 mb-6">
              <legend className="text-sm font-medium mb-3">Ordenar por</legend>

              <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${exportOrderBy === "ordemCompra" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                <input
                  type="radio"
                  name="exportOrder"
                  value="ordemCompra"
                  checked={exportOrderBy === "ordemCompra"}
                  onChange={() => setExportOrderBy("ordemCompra")}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <ListOrdered className="h-3.5 w-3.5 text-primary" />
                    Ordem de Compra (crescente)
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Participante #00001 primeiro — cronológico de inscrição
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${exportOrderBy === "nome" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                <input
                  type="radio"
                  name="exportOrder"
                  value="nome"
                  checked={exportOrderBy === "nome"}
                  onChange={() => setExportOrderBy("nome")}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <ArrowDownAZ className="h-3.5 w-3.5 text-primary" />
                    Ordem Alfabética (A → Z)
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ordenado pelo nome do participante
                  </p>
                </div>
              </label>
            </fieldset>

            {/* Ações */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleExportConfirm}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Baixar CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal de edição                                                     */}
      {/* ------------------------------------------------------------------ */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditingParticipant(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border bg-background shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Editar Participante</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditingParticipant(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Separator className="mb-4" />
            <ParticipantEditDialog
              participant={{
                id: editingParticipant.id,
                ordemCompra: editingParticipant.ordemCompra,
                formData: editingParticipant.formData,
              }}
              formStructure={formStructure}
              onSuccess={handleParticipantUpdated}
              onClose={() => setEditingParticipant(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

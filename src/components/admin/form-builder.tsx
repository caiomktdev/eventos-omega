/**
 * FormBuilder — editor visual do formStructure JSON de um evento.
 *
 * Permite ao admin:
 *   - Adicionar campos ao formulário de inscrição
 *   - Definir tipo, label, nome (snake_case), obrigatoriedade, placeholder
 *   - Para campos "select": adicionar/remover opções
 *   - Reordenar campos (mover para cima/baixo)
 *   - Remover campos
 *   - Ver o JSON gerado em tempo real
 *
 * Emite o formStructure atualizado via `onChange` a cada modificação.
 */

"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Eye,
  EyeOff,
  PlusCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { FormField, EventFormStructure } from "@/types";

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type FieldType = FormField["type"];

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto curto",
  email: "E-mail",
  tel: "Telefone",
  number: "Número",
  url: "URL",
  select: "Seleção (lista)",
  checkbox: "Caixa de marcação",
  textarea: "Texto longo",
};

interface FormBuilderProps {
  value: EventFormStructure;
  onChange: (structure: EventFormStructure) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSnakeCase(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function newBlankField(): FormField & { _id: string } {
  return {
    _id: Math.random().toString(36).slice(2),
    name: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
  };
}

// ---------------------------------------------------------------------------
// Sub-componente: row de um campo
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: FormField & { _id: string };
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<FormField>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
}

function FieldRow({ field, index, total, onChange, onRemove, onMove }: FieldRowProps) {
  const [newOption, setNewOption] = useState("");

  function addOption() {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const options = [...(field.options ?? []), trimmed];
    onChange(field._id, { options });
    setNewOption("");
  }

  function removeOption(opt: string) {
    onChange(field._id, { options: (field.options ?? []).filter((o) => o !== opt) });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header da linha */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Campo {index + 1}
          </span>
          {field.required && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
              obrigatório
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === 0}
            onClick={() => onMove(field._id, "up")}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === total - 1}
            onClick={() => onMove(field._id, "down")}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onRemove(field._id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Campos de configuração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Label (exibido ao participante)</Label>
          <Input
            placeholder="Ex: CPF, Tamanho da Camiseta"
            value={field.label}
            onChange={(e) => {
              const label = e.target.value;
              // Auto-gera o name se ainda não foi customizado
              const autoName =
                !field.name || field.name === toSnakeCase(field.label)
                  ? toSnakeCase(label)
                  : field.name;
              onChange(field._id, { label, name: autoName });
            }}
          />
        </div>

        {/* Nome (snake_case) */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Nome do campo{" "}
            <span className="text-muted-foreground">(snake_case, único)</span>
          </Label>
          <Input
            placeholder="ex: cpf, tamanho_camiseta"
            value={field.name}
            onChange={(e) =>
              onChange(field._id, { name: toSnakeCase(e.target.value) })
            }
            className="font-mono text-xs"
          />
        </div>

        {/* Tipo */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de campo</Label>
          <Select
            value={field.type}
            onValueChange={(v) =>
              onChange(field._id, { type: v as FieldType, options: v === "select" ? [""] : [] })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
                <SelectItem key={val} value={val}>
                  {lbl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Placeholder */}
        {field.type !== "checkbox" && field.type !== "select" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Placeholder (opcional)</Label>
            <Input
              placeholder="Texto de ajuda dentro do campo"
              value={field.placeholder ?? ""}
              onChange={(e) => onChange(field._id, { placeholder: e.target.value })}
            />
          </div>
        )}

        {/* Obrigatório */}
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id={`req-${field._id}`}
            checked={field.required}
            onChange={(e) => onChange(field._id, { required: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          <Label htmlFor={`req-${field._id}`} className="text-sm cursor-pointer">
            Campo obrigatório
          </Label>
        </div>
      </div>

      {/* Opções para campo select */}
      {field.type === "select" && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs">Opções da lista</Label>
          <div className="flex flex-wrap gap-1.5">
            {(field.options ?? []).map((opt) => (
              <span
                key={opt}
                className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs"
              >
                {opt}
                <button
                  type="button"
                  onClick={() => removeOption(opt)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nova opção..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addOption(); }
              }}
              className="h-8 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <PlusCircle className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormBuilder principal
// ---------------------------------------------------------------------------

export function FormBuilder({ value, onChange }: FormBuilderProps) {
  // Adiciona _id interno para controle de state (não vai para o JSON final)
  type InternalField = FormField & { _id: string };

  const [fields, setFields] = useState<InternalField[]>(() =>
    value.fields.map((f) => ({ ...f, _id: Math.random().toString(36).slice(2) }))
  );
  const [showJson, setShowJson] = useState(false);

  // Notifica o pai sempre que os campos mudam
  const emit = useCallback(
    (updated: InternalField[]) => {
      // Remove _id antes de emitir (não faz parte do schema)
      const clean: FormField[] = updated.map(({ _id, ...f }) => f);
      onChange({ fields: clean });
    },
    [onChange]
  );

  function addField() {
    const updated = [...fields, newBlankField() as InternalField];
    setFields(updated);
    emit(updated);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    const updated = fields.map((f) => (f._id === id ? { ...f, ...patch } : f));
    setFields(updated);
    emit(updated);
  }

  function removeField(id: string) {
    const updated = fields.filter((f) => f._id !== id);
    setFields(updated);
    emit(updated);
  }

  function moveField(id: string, dir: "up" | "down") {
    const idx = fields.findIndex((f) => f._id === id);
    if (idx < 0) return;
    const next = [...fields];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setFields(next);
    emit(next);
  }

  const cleanJson = fields.map(({ _id, ...f }) => f);

  return (
    <div className="space-y-4">
      {/* Campos cadastrados */}
      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum campo extra configurado.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Os campos <strong>Nome</strong> e <strong>E-mail</strong> já são
            incluídos automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, idx) => (
            <FieldRow
              key={field._id}
              field={field}
              index={idx}
              total={fields.length}
              onChange={updateField}
              onRemove={removeField}
              onMove={moveField}
            />
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="h-4 w-4" />
          Adicionar campo
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowJson((v) => !v)}
          className="text-muted-foreground"
        >
          {showJson ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showJson ? "Ocultar" : "Ver"} JSON
        </Button>
      </div>

      {/* Preview do JSON gerado */}
      {showJson && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            formStructure gerado
          </p>
          <pre className="text-xs overflow-auto max-h-60 text-foreground/80">
            {JSON.stringify({ fields: cleanJson }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

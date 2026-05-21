/**
 * ParticipantEditDialog — modal para o admin corrigir os dados do participante.
 *
 * Exibe todos os campos do formData (nome, email + campos extras do formStructure)
 * em inputs editáveis. Ao salvar, envia PATCH /api/admin/participants/[id].
 */

"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { FormField, EventFormStructure } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ParticipantData {
  id: string;
  ordemCompra: number;
  formData: Record<string, string | boolean | number>;
}

interface ParticipantEditDialogProps {
  participant: ParticipantData;
  formStructure: EventFormStructure;
  onSuccess: (updated: ParticipantData) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Renderiza um campo baseado no tipo do formStructure
// ---------------------------------------------------------------------------

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Selecione ${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-sm text-muted-foreground">{field.placeholder ?? field.label}</span>
      </div>
    );
  }

  return (
    <Input
      type={field.type}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

// ---------------------------------------------------------------------------
// Dialog principal
// ---------------------------------------------------------------------------

export function ParticipantEditDialog({
  participant,
  formStructure,
  onSuccess,
  onClose,
}: ParticipantEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Inicializa o estado com os dados atuais do participante
  const [values, setValues] = useState<Record<string, string | boolean | number>>(
    () => ({ ...participant.formData })
  );

  function setField(name: string, value: string | boolean | number) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSave() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/participants/${participant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formData: values }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Erro ao salvar.");
        }

        setSaved(true);
        onSuccess({ ...participant, formData: values });

        setTimeout(onClose, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      }
    });
  }

  // ---- Campos base sempre presentes ----
  const baseFields: FormField[] = [
    { name: "nome", label: "Nome completo", type: "text", required: true },
    { name: "email", label: "E-mail", type: "email", required: true },
  ];

  // ---- Todos os campos: base + extras do formStructure ----
  const allFields = [...baseFields, ...formStructure.fields];

  return (
    <div className="space-y-5 py-2">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Inscrição{" "}
            <span className="font-mono text-primary">
              #{String(participant.ordemCompra).padStart(5, "0")}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edite os campos abaixo e clique em Salvar.
          </p>
        </div>
      </div>

      <Separator />

      {/* Campos editáveis */}
      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
        {allFields.map((field) => {
          const val = values[field.name] ?? (field.type === "checkbox" ? false : "");

          return (
            <div key={field.name} className="space-y-1.5">
              <Label className="text-sm">
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-0.5">*</span>
                )}
                <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                  ({field.name})
                </span>
              </Label>
              <FieldInput
                field={field}
                value={val as string | boolean}
                onChange={(v) => setField(field.name, v)}
              />
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Dados salvos com sucesso!
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending || saved}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

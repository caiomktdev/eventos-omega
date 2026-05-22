/**
 * DynamicEventForm — formulário de inscrição gerado dinamicamente a partir
 * do JSON `formStructure` configurado pelo admin no evento.
 *
 * Campos base fixos: Nome completo + E-mail
 * Campos extras: definidos em Event.formStructure.fields
 *
 * Ao submeter, envia os dados para POST /api/enroll e trata os estados
 * de loading, erro e sucesso (incluindo redirect para pagamento MP).
 *
 * Exibição financeira: valores pré-calculados no Server Component pai;
 * este componente não executa calculateMooveFee().
 */

"use client";

import { useState, useTransition, useId } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  User,
  Mail,
} from "lucide-react";
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
import { formatCurrency } from "@/lib/fee";
import type { EventFormStructure, FormField } from "@/types";

// ---------------------------------------------------------------------------
// Tipos internos do formulário
// ---------------------------------------------------------------------------

type FieldValue = string | boolean;
type FormValues = Record<string, FieldValue>;
type FormErrors = Record<string, string>;

/** Breakdown financeiro pré-calculado no servidor (somente exibição) */
export interface SerializedTicketFees {
  grossAmount: number;
  mooveFee: number;
  feeRatePercent: number;
}

/** Ingresso serializado (price como number) — seguro para cruzar a fronteira Server→Client */
export interface SerializedTicketType {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  fees: SerializedTicketFees;
}

interface DynamicEventFormProps {
  eventId: string;
  eventTitle: string;
  formStructure: EventFormStructure;
  ticketTypes: SerializedTicketType[];
  /** Rótulo da taxa vigente, ex: "2%" — calculado no servidor */
  mooveFeePercentLabel: string;
}

// ---------------------------------------------------------------------------
// Sub-componente: renderiza um campo extra dinamicamente
// ---------------------------------------------------------------------------

interface DynamicFieldProps {
  field: FormField;
  value: FieldValue;
  error?: string;
  onChange: (name: string, value: FieldValue) => void;
}

function DynamicField({ field, value, error, onChange }: DynamicFieldProps) {
  const inputId = useId();

  const baseInputClass =
    "mt-1 block w-full" + (error ? " border-destructive focus-visible:ring-destructive" : "");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      {field.type === "select" && field.options ? (
        <Select
          value={value as string}
          onValueChange={(v) => onChange(field.name, v)}
        >
          <SelectTrigger id={inputId} className={error ? "border-destructive" : ""}>
            <SelectValue placeholder={field.placeholder ?? `Selecione ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          id={inputId}
          placeholder={field.placeholder ?? ""}
          value={value as string}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={baseInputClass}
          rows={3}
        />
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            id={inputId}
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(field.name, e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
          <span className="text-sm text-muted-foreground">{field.placeholder}</span>
        </div>
      ) : (
        <Input
          id={inputId}
          type={field.type}
          placeholder={field.placeholder ?? ""}
          value={value as string}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={baseInputClass}
        />
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function DynamicEventForm({
  eventId,
  eventTitle,
  formStructure,
  ticketTypes,
  mooveFeePercentLabel,
}: DynamicEventFormProps) {
  const [isPending, startTransition] = useTransition();

  // Inicializa valores para todos os campos (base + extras)
  const [values, setValues] = useState<FormValues>(() => {
    const base: FormValues = { nome: "", email: "" };
    for (const field of formStructure.fields) {
      base[field.name] = field.type === "checkbox" ? false : "";
    }
    return base;
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    () => ticketTypes.find((t) => t.soldQuantity < t.totalQuantity)?.id ?? ""
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    ordemCompra: number;
    isFree: boolean;
  } | null>(null);

  const selectedTicket = ticketTypes.find((t) => t.id === selectedTicketId);
  const feeDisplay = selectedTicket?.fees ?? null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function setFieldValue(name: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!values.nome || String(values.nome).trim().length < 2) {
      newErrors.nome = "Nome deve ter ao menos 2 caracteres.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!values.email || !emailRegex.test(String(values.email))) {
      newErrors.email = "Informe um e-mail válido.";
    }
    if (!selectedTicketId) {
      newErrors._ticket = "Selecione um tipo de ingresso.";
    }

    for (const field of formStructure.fields) {
      if (!field.required) continue;
      const val = values[field.name];
      if (val === "" || val === false || val === undefined) {
        newErrors[field.name] = `${field.label} é obrigatório.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setServerError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            ticketTypeId: selectedTicketId,
            formData: values,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Erro ao processar inscrição.");
        }

        if (data.requiresPayment) {
          const checkoutPath =
            data.checkoutUrl ??
            data.redirectTo ??
            (data.participantId ? `/checkout/${data.participantId}` : null);

          if (!checkoutPath) {
            throw new Error(
              data.paymentError ?? "Não foi possível iniciar o pagamento."
            );
          }

          window.location.assign(checkoutPath);
          return;
        }

        setSuccessData({ ordemCompra: data.ordemCompra, isFree: true });
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Ocorreu um erro inesperado."
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Estado: inscrição confirmada
  // ---------------------------------------------------------------------------

  if (successData) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6 px-4">
        <div className="rounded-full bg-green-100 p-5">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-green-700">
            Inscrição Confirmada!
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {eventTitle}
          </p>
        </div>
        <div className="rounded-lg bg-muted/60 px-6 py-3 text-sm">
          <p className="text-muted-foreground">Número da sua inscrição</p>
          <p className="text-2xl font-bold font-mono tracking-widest mt-1">
            #{String(successData.ordemCompra).padStart(5, "0")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          Sua inscrição foi registrada. Consulte seus ingressos em Meus ingressos
          usando o e-mail informado no formulário.
          Guarde o número acima para check-in.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render do formulário
  // ---------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Seleção de ingresso (se houver mais de um tipo) */}
      {ticketTypes.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="ticket-select">
            Tipo de Ingresso <span className="text-destructive">*</span>
          </Label>
          <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
            <SelectTrigger
              id="ticket-select"
              className={errors._ticket ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Selecione um ingresso" />
            </SelectTrigger>
            <SelectContent>
              {ticketTypes.map((t) => {
                const available = t.totalQuantity - t.soldQuantity;
                const isSoldOut = available === 0;
                return (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    disabled={isSoldOut}
                  >
                    <span className="flex items-center gap-2">
                      <span>{t.name}</span>
                      <span className="text-muted-foreground">
                        —{" "}
                        {Number(t.price) === 0
                          ? "Gratuito"
                          : formatCurrency(Number(t.price))}
                      </span>
                      {isSoldOut && (
                        <span className="text-xs text-destructive">
                          (Esgotado)
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {errors._ticket && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors._ticket}
            </p>
          )}
        </div>
      )}

      <Separator />

      {/* ---- Campos base fixos: Nome e E-mail ---- */}
      <div className="space-y-1.5">
        <Label htmlFor="field-nome">
          Nome completo <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="field-nome"
            type="text"
            placeholder="Seu nome completo"
            value={values.nome as string}
            onChange={(e) => setFieldValue("nome", e.target.value)}
            className={`pl-9 ${errors.nome ? "border-destructive focus-visible:ring-destructive" : ""}`}
            autoComplete="name"
          />
        </div>
        {errors.nome && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.nome}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="field-email">
          E-mail <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="field-email"
            type="email"
            placeholder="seu@email.com"
            value={values.email as string}
            onChange={(e) => setFieldValue("email", e.target.value)}
            className={`pl-9 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
            autoComplete="email"
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.email}
          </p>
        )}
      </div>

      {/* ---- Campos extras dinâmicos do formStructure ---- */}
      {formStructure.fields.length > 0 && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Informações adicionais
          </p>
          {formStructure.fields.map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              value={values[field.name] ?? (field.type === "checkbox" ? false : "")}
              error={errors[field.name]}
              onChange={setFieldValue}
            />
          ))}
        </>
      )}

      {/* ---- Resumo financeiro ---- */}
      {feeDisplay && (
        <>
          <Separator />
          <div className="rounded-lg bg-muted/50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ingresso</span>
              <span>
                {feeDisplay.grossAmount === 0
                  ? "Gratuito"
                  : formatCurrency(feeDisplay.grossAmount)}
              </span>
            </div>
            {feeDisplay.grossAmount > 0 && (
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Taxa de serviço ({mooveFeePercentLabel})</span>
                <span>{formatCurrency(feeDisplay.mooveFee)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">
                {feeDisplay.grossAmount === 0
                  ? "Gratuito"
                  : formatCurrency(feeDisplay.grossAmount)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ---- Erro do servidor ---- */}
      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* ---- Botão submit ---- */}
      <Button
        type="submit"
        disabled={isPending || !selectedTicketId}
        className="w-full h-12 text-base font-semibold"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processando inscrição...
          </>
        ) : (
          <>
            {feeDisplay && feeDisplay.grossAmount > 0
              ? `Pagar ${formatCurrency(feeDisplay.grossAmount)}`
              : "Confirmar Inscrição"}
            <ChevronRight className="h-5 w-5" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ao se inscrever você concorda com os termos do evento.
        {feeDisplay && feeDisplay.grossAmount > 0 && (
          <> O pagamento é processado com segurança pelo Mercado Pago.</>
        )}
      </p>
    </form>
  );
}

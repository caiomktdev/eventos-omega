/**
 * AdminEventForm — formulário completo de criação/edição de evento para o admin.
 * Inclui o FormBuilder integrado e gestão de TicketTypes com proteção de soldQuantity.
 * Usado em /admin/events/new e /admin/events/[id]/edit.
 */

"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FormBuilder } from "@/components/admin/form-builder";
import type { EventFormStructure } from "@/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const ticketSchema = z.object({
  id: z.string().optional(), // undefined → new ticket; string → existing
  name: z.string().min(1, "Nome obrigatório."),
  description: z.string().optional(),
  price: z.number({ invalid_type_error: "Informe o preço." }).min(0),
  totalQuantity: z
    .number({ invalid_type_error: "Informe a quantidade." })
    .int()
    .positive("Deve ser positivo."),
  maxPerOrder: z.number().int().min(1).max(100).default(10),
  soldQuantity: z.number().int().min(0).default(0),
});

const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres.").max(120),
  description: z.string().min(10, "Descreva o evento.").max(5000),
  coverImage: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.startsWith("data:") || /^https?:\/\//i.test(v),
      "Use uma URL http(s) ou envie uma imagem."
    ),
  venue: z.string().min(2, "Informe o local.").max(100),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(80),
  state: z.string().length(2, "Use a sigla (ex: SP)."),
  startDate: z.string().min(1, "Informe a data de início."),
  endDate: z.string().min(1, "Informe a data de término."),
  producerName: z.string().max(100).optional(),
  producerBio: z.string().max(1500).optional(),
  ticketTypes: z
    .array(ticketSchema)
    .min(1, "Adicione ao menos um tipo de ingresso."),
});

type FormValues = z.infer<typeof schema>;

interface TicketDefault {
  id?: string;
  name: string;
  description?: string;
  price: number;
  totalQuantity: number;
  maxPerOrder: number;
  soldQuantity?: number;
}

interface AdminEventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  initialStatus?: "DRAFT" | "PUBLISHED" | "CANCELLED" | "FINISHED";
  successRedirectPath?: string;
  /** Capa já salva no banco — evita reenviar base64 enorme no PATCH. */
  storedCoverImage?: string | null;
  defaultValues?: Partial<Omit<FormValues, "ticketTypes">> & {
    formStructure?: EventFormStructure;
    ticketTypes?: TicketDefault[];
  };
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export function AdminEventForm({
  mode,
  eventId,
  initialStatus = "DRAFT",
  successRedirectPath,
  storedCoverImage,
  defaultValues,
}: AdminEventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const submitActionRef = useRef<"save" | "publish">("save");
  const [formStructure, setFormStructure] = useState<EventFormStructure>(
    defaultValues?.formStructure ?? { fields: [] }
  );

  const defaultTickets: FormValues["ticketTypes"] =
    defaultValues?.ticketTypes?.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      price: t.price,
      totalQuantity: t.totalQuantity,
      maxPerOrder: t.maxPerOrder,
      soldQuantity: t.soldQuantity ?? 0,
    })) ?? [{ name: "Ingresso Geral", price: 0, totalQuantity: 100, maxPerOrder: 10, soldQuantity: 0 }];

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticketTypes: defaultTickets,
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "ticketTypes" });
  const ticketValues = watch("ticketTypes") ?? [];

  function onSubmit(data: FormValues) {
    // Validação client-side adicional: totalQuantity >= soldQuantity
    for (const t of data.ticketTypes) {
      if (t.totalQuantity < (t.soldQuantity ?? 0)) {
        setServerError(
          `"${t.name}": quantidade total (${t.totalQuantity}) não pode ser menor que os vendidos (${t.soldQuantity}).`
        );
        return;
      }
    }

    const incompleteFormFields = formStructure.fields.filter(
      (f) => !f.name.trim() || !f.label.trim()
    );
    if (incompleteFormFields.length > 0) {
      setServerError(
        "Há campos do formulário de inscrição incompletos. Preencha o label e o nome ou remova os campos vazios."
      );
      return;
    }

    const selectWithoutOptions = formStructure.fields.filter(
      (f) =>
        f.type === "select" &&
        (!f.options || f.options.filter((o) => o.trim()).length === 0)
    );
    if (selectWithoutOptions.length > 0) {
      setServerError(
        'Campos do tipo "Seleção" precisam de ao menos uma opção.'
      );
      return;
    }

    const cleanedFormStructure: EventFormStructure = {
      fields: formStructure.fields.map((f) => ({
        ...f,
        name: f.name.trim(),
        label: f.label.trim(),
        ...(f.type === "select"
          ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) }
          : {}),
      })),
    };

    setServerError(null);

    startTransition(async () => {
      try {
        const url =
          mode === "create" ? "/api/admin/events" : `/api/admin/events/${eventId}`;
        const method = mode === "create" ? "POST" : "PATCH";

        const trimmedCover = data.coverImage?.trim() ?? "";
        let coverImage: string | null | undefined;
        if (trimmedCover) {
          coverImage = trimmedCover;
        } else if (mode === "edit" && storedCoverImage) {
          coverImage = undefined;
        } else {
          coverImage = null;
        }

        const payload: Record<string, unknown> = {
          title: data.title,
          description: data.description,
          venue: data.venue,
          address: data.address,
          city: data.city,
          state: data.state.toUpperCase(),
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          producerName: data.producerName?.trim() || null,
          producerBio: data.producerBio?.trim() || null,
          status:
            submitActionRef.current === "publish"
              ? "PUBLISHED"
              : mode === "edit"
                ? initialStatus
                : "DRAFT",
          formStructure: cleanedFormStructure,
          ticketTypes: data.ticketTypes.map((t) => ({
            ...(t.id ? { id: t.id } : {}),
            name: t.name,
            description: t.description?.trim() || undefined,
            price: t.price,
            totalQuantity: t.totalQuantity,
            maxPerOrder: t.maxPerOrder,
          })),
        };

        if (coverImage !== undefined) {
          payload.coverImage = coverImage;
        }

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) {
          const details = json.details as Record<string, string[] | undefined> | undefined;
          const detailMsg = details
            ? Object.entries(details)
                .flatMap(([key, msgs]) =>
                  (msgs ?? []).map((m) => `${key}: ${m}`)
                )
                .join(" · ")
            : "";
          throw new Error(
            detailMsg
              ? `${json.error ?? "Erro ao salvar evento."} ${detailMsg}`
              : (json.error ?? "Erro ao salvar evento.")
          );
        }

        setSuccess(true);
        const id = mode === "create" ? json.id : eventId;
        const redirectTo = successRedirectPath ?? `/admin/events/${id}`;
        setTimeout(() => router.push(redirectTo), 1200);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Erro inesperado.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ── Informações básicas ── */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Evento</CardTitle>
          <CardDescription>Dados principais exibidos na página pública.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" placeholder="Ex: Festival de Rock Omega 2026" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea id="description" rows={5} placeholder="Descreva o evento..." {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImage">Imagem de capa (URL)</Label>
            {storedCoverImage && !watch("coverImage") && (
              <p className="text-xs text-muted-foreground">
                Este evento já possui uma capa salva. Informe uma URL abaixo apenas se quiser substituí-la.
              </p>
            )}
            <Input
              id="coverImage"
              type="text"
              placeholder="https://..."
              {...register("coverImage")}
            />
            {errors.coverImage && <p className="text-xs text-destructive">{errors.coverImage.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Início *</Label>
              <Input id="startDate" type="datetime-local" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Término *</Label>
              <Input id="endDate" type="datetime-local" {...register("endDate")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sobre o produtor ── */}
      <Card>
        <CardHeader>
          <CardTitle>Sobre o Produtor</CardTitle>
          <CardDescription>Exibido na seção "Sobre o produtor" da página pública.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="producerName">Nome do produtor / organização</Label>
            <Input id="producerName" placeholder="Ex: Colégio Ômega Eventos" {...register("producerName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="producerBio">Bio curta</Label>
            <Textarea
              id="producerBio"
              rows={3}
              placeholder="Breve descrição do organizador..."
              {...register("producerBio")}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Local ── */}
      <Card>
        <CardHeader>
          <CardTitle>Local</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="venue">Nome do Local *</Label>
              <Input id="venue" placeholder="Ex: Allianz Parque" {...register("venue")} />
              {errors.venue && <p className="text-xs text-destructive">{errors.venue.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço *</Label>
              <Input id="address" placeholder="Rua, Número, Bairro" {...register("address")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="city">Cidade *</Label>
              <Input id="city" placeholder="São Paulo" {...register("city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">UF *</Label>
              <Input id="state" placeholder="SP" maxLength={2} className="uppercase" {...register("state")} />
              {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Ingressos ── */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Ingresso</CardTitle>
          <CardDescription>
            Os preços são base para o cálculo da taxa Moove (2%) no servidor.
            {mode === "edit" && (
              <span className="block mt-1 text-amber-600">
                Atenção: a quantidade total não pode ser menor que os ingressos já vendidos.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {fields.map((field, idx) => {
            const soldQty = ticketValues?.[idx]?.soldQuantity ?? 0;
            const isExisting = !!ticketValues?.[idx]?.id;

            return (
              <div key={field.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ingresso {idx + 1}
                    </span>
                    {isExisting && soldQty > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <Info className="h-3 w-3" />
                        {soldQty} vendido{soldQty > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      isExisting && soldQty > 0
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-destructive hover:text-destructive"
                    )}
                    onClick={() => {
                      if (isExisting && soldQty > 0) return;
                      remove(idx);
                    }}
                    title={
                      isExisting && soldQty > 0
                        ? "Não é possível remover um ingresso com vendas"
                        : "Remover ingresso"
                    }
                    disabled={isExisting && soldQty > 0}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input placeholder="Pista, VIP, Early Bird..." {...register(`ticketTypes.${idx}.name`)} />
                    {errors.ticketTypes?.[idx]?.name && (
                      <p className="text-xs text-destructive">{errors.ticketTypes[idx]?.name?.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço (R$) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      {...register(`ticketTypes.${idx}.price`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Qtd. Total *
                      {isExisting && soldQty > 0 && (
                        <span className="ml-1.5 text-[11px] font-normal text-amber-600">
                          (mín. {soldQty})
                        </span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      min={soldQty > 0 ? soldQty : 1}
                      placeholder="100"
                      {...register(`ticketTypes.${idx}.totalQuantity`, { valueAsNumber: true })}
                    />
                    {errors.ticketTypes?.[idx]?.totalQuantity && (
                      <p className="text-xs text-destructive">
                        {errors.ticketTypes[idx]?.totalQuantity?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Máx. por pedido</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="10"
                      {...register(`ticketTypes.${idx}.maxPerOrder`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Descrição (opcional)</Label>
                    <Input
                      placeholder="Ex: Inclui open bar e acesso VIP"
                      {...register(`ticketTypes.${idx}.description`)}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {errors.ticketTypes?.root && (
            <p className="text-xs text-destructive">{errors.ticketTypes.root.message}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ name: "", price: 0, totalQuantity: 100, maxPerOrder: 10, soldQuantity: 0 })
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar ingresso
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Formulário de Inscrição (FormBuilder) ── */}
      <Card id="formulario">
        <CardHeader>
          <CardTitle>Formulário de Inscrição</CardTitle>
          <CardDescription>
            Campos extras além de Nome e E-mail que os participantes devem preencher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormBuilder value={formStructure} onChange={setFormStructure} />
        </CardContent>
      </Card>

      {/* ── Feedback ── */}
      {serverError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {mode === "create" ? "Evento criado!" : "Evento atualizado!"} Redirecionando...
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || success}
        className="w-full h-12 text-base"
        size="lg"
        onClick={() => {
          submitActionRef.current = "save";
        }}
      >
        {isPending && submitActionRef.current === "save" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {mode === "create"
              ? "Salvar rascunho"
              : initialStatus === "DRAFT"
                ? "Salvar rascunho"
                : "Salvar alterações"}
          </>
        )}
      </Button>

      {(mode === "edit" && initialStatus === "DRAFT") || mode === "create" ? (
        <Button
          type="submit"
          disabled={isPending || success}
          className="w-full h-12 text-base"
          size="lg"
          onClick={() => {
            submitActionRef.current = "publish";
          }}
        >
          {isPending && submitActionRef.current === "publish" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Publicando...
            </>
          ) : (
            "Publicar evento"
          )}
        </Button>
      ) : null}
    </form>
  );
}

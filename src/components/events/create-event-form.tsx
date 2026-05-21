/**
 * CreateEventForm — formulário completo de criação de evento para o organizador.
 * 7 seções estilo Sympla com footer fixo (Salvar Rascunho / Pré-visualizar / Publicar).
 */

"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Upload,
  X,
  ImageIcon,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ShoppingBag,
  User2,
  FileText,
  Eye,
  Save,
  Rocket,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Schema do formulário (lado client)
// ---------------------------------------------------------------------------
const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres.").max(120),
  startDate: z.string().min(1, "Informe a data de início."),
  startTime: z.string().min(1, "Informe o horário de início."),
  endDate: z.string().min(1, "Informe a data de término."),
  endTime: z.string().min(1, "Informe o horário de término."),
  description: z.string().min(10, "Descreva melhor o seu evento.").max(5000),
  cep: z.string().max(9).optional(),
  venue: z.string().min(2, "Informe o nome do local.").max(100),
  street: z.string().min(3, "Informe o endereço.").max(200),
  addressNumber: z.string().max(20).optional(),
  addressComplement: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().min(2, "Informe a cidade.").max(80),
  state: z.string().length(2, "Use a sigla do estado (ex: SP)."),
  showOnGoogleMaps: z.boolean().default(true),
  sellProducts: z.boolean().default(false),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(1, "Nome obrigatório."),
        description: z.string().optional(),
        price: z.number({ invalid_type_error: "Informe o preço." }).min(0),
        totalQuantity: z
          .number({ invalid_type_error: "Informe a quantidade." })
          .int()
          .positive("Deve ser positivo."),
        maxPerOrder: z.number().int().min(1).max(100).default(10),
        isFree: z.boolean().default(false),
      })
    )
    .min(1, "Adicione ao menos um tipo de ingresso."),
  producerName: z.string().max(100).optional(),
  producerBio: z.string().max(1500).optional(),
  acceptTerms: z.boolean(),
  visibility: z.enum(["public", "private"]).default("public"),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Sub-componente: cartão de seção numerado
// ---------------------------------------------------------------------------
interface SectionCardProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function SectionCard({ number, icon, title, subtitle, children }: SectionCardProps) {
  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="flex-none w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-primary shrink-0">{icon}</span>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="px-6 py-6 space-y-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: área de upload de imagem
// ---------------------------------------------------------------------------
interface CoverImageUploaderProps {
  preview: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  error?: string;
}

function CoverImageUploader({ preview, onFileSelect, onClear, error }: CoverImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Apenas JPEG e PNG são aceitos.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2 MB.");
      return;
    }
    onFileSelect(file);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-2">
      <Label>
        Imagem de divulgação
        <span className="ml-1.5 text-xs font-normal text-gray-400">
          JPEG ou PNG · máx. 2 MB · dimensão ideal 1600×838
        </span>
      </Label>

      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ aspectRatio: "1600 / 838" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Pré-visualização da capa" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label="Remover imagem"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors select-none",
            "aspect-[1600/838]",
            dragOver
              ? "border-primary/40 bg-primary/10"
              : "border-gray-200 bg-gray-50 hover:border-primary/30 hover:bg-primary/10"
          )}
        >
          <div className="flex flex-col items-center gap-2 text-center p-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              Arraste uma imagem ou clique para selecionar
            </p>
            <p className="text-xs text-gray-400">JPEG / PNG — máximo 2 MB</p>
            <Button type="button" variant="outline" size="sm" className="mt-1 pointer-events-none">
              <Upload className="h-3.5 w-3.5" />
              Escolher arquivo
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: calculadora de duração
// ---------------------------------------------------------------------------
function DurationBadge({ startDate, startTime, endDate, endTime }: {
  startDate: string; startTime: string; endDate: string; endTime: string;
}) {
  if (!startDate || !startTime || !endDate || !endTime) return null;

  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(`${endDate}T${endTime}:00`);
  const diffMs = end.getTime() - start.getTime();

  if (isNaN(diffMs) || diffMs <= 0) return null;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let label = "";
  if (days > 0) {
    label = `Seu evento vai durar ${days} dia${days > 1 ? "s" : ""}`;
    if (hours > 0) label += ` e ${hours}h`;
  } else if (hours > 0) {
    label = `Duração: ${hours}h`;
    if (minutes > 0) label += `${minutes}min`;
  } else {
    label = `Duração: ${minutes} minutos`;
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">
      <Info className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export interface CreateEventFormProps {
  /** URL de retorno no header contextual */
  backHref?: string;
  /** Rótulo do botão voltar */
  backLabel?: string;
  /** Contexto define os redirects pós-salvamento */
  formContext?: "admin" | "dashboard";
}

function getDraftRedirect(
  context: "admin" | "dashboard",
  event: { id: string; slug: string }
): string {
  if (context === "dashboard") return "/dashboard";
  return `/admin/events/${event.id}`;
}

function getPublishRedirect(event: { id: string; slug: string }): string {
  return `/event/${event.slug}`;
}

export function CreateEventForm({
  backHref = "/dashboard",
  backLabel = "Meu painel",
  formContext = "admin",
}: CreateEventFormProps = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cover image state (fora do RHF pois é um File)
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string>("");

  // Draft submit type
  const submitTypeRef = useRef<"draft" | "publish">("draft");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticketTypes: [],
      showOnGoogleMaps: true,
      sellProducts: false,
      visibility: "public",
      acceptTerms: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "ticketTypes" });

  const [startDate, startTime, endDate, endTime, visibility, acceptTerms] = useWatch({
    control,
    name: ["startDate", "startTime", "endDate", "endTime", "visibility", "acceptTerms"],
  });

  // Cover image handlers
  function handleFileSelect(file: File) {
    setCoverFile(file);
    setCoverError("");
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  }

  function handleClearCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  }

  // Convert file to base64 data URL for API transmission
  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  function onSubmit(data: FormValues) {
    if (submitTypeRef.current === "publish" && !data.acceptTerms) {
      setServerError("Aceite os termos de uso para publicar o evento.");
      return;
    }

    setServerError(null);

    startTransition(async () => {
      try {
        let coverImage: string | undefined;
        if (coverFile) {
          coverImage = await fileToDataUrl(coverFile);
        }

        // Combina date + time em ISO datetime
        const startDateTime = new Date(`${data.startDate}T${data.startTime}:00`).toISOString();
        const endDateTime = new Date(`${data.endDate}T${data.endTime}:00`).toISOString();

        // Monta endereço completo
        const addressParts = [data.street];
        if (data.addressNumber) addressParts.push(data.addressNumber);
        if (data.addressComplement) addressParts.push(data.addressComplement);
        if (data.neighborhood) addressParts.push(data.neighborhood);
        if (data.cep) addressParts.push(`CEP: ${data.cep}`);
        const fullAddress = addressParts.join(", ");

        const payload = {
          title: data.title,
          description: data.description,
          coverImage,
          venue: data.venue,
          address: fullAddress,
          city: data.city,
          state: data.state.toUpperCase(),
          startDate: startDateTime,
          endDate: endDateTime,
          producerName: data.producerName || undefined,
          producerBio: data.producerBio || undefined,
          status: submitTypeRef.current === "publish" ? "PUBLISHED" : "DRAFT",
          formStructure: { fields: [] },
          ticketTypes: data.ticketTypes.map((t) => ({
            name: t.name,
            description: t.description,
            price: t.isFree ? 0 : t.price,
            totalQuantity: t.totalQuantity,
            maxPerOrder: t.maxPerOrder,
          })),
        };

        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao criar evento.");

        setSuccess(true);

        if (submitTypeRef.current === "publish") {
          setTimeout(() => router.push(getPublishRedirect(json)), 1200);
        } else {
          setTimeout(() => router.push(getDraftRedirect(formContext, json)), 1200);
        }
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Erro inesperado.");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Ticket helpers
  // ---------------------------------------------------------------------------
  function addPaidTicket() {
    append({ name: "", description: "", price: 0, totalQuantity: 100, maxPerOrder: 10, isFree: false });
  }

  function addFreeTicket() {
    append({ name: "Entrada Gratuita", description: "", price: 0, totalQuantity: 100, maxPerOrder: 10, isFree: true });
  }

  const ticketValues = watch("ticketTypes") ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32 space-y-5">

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 1 — Informações básicas                               */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={1}
            icon={<FileText className="h-4 w-4" />}
            title="Informações básicas"
            subtitle="Nome e imagem do seu evento"
          >
            <div className="space-y-1.5">
              <Label htmlFor="title">Nome do evento *</Label>
              <Input
                id="title"
                placeholder="Ex: Festival de Rock Omega 2026"
                {...register("title")}
                className={errors.title ? "border-red-400" : ""}
              />
              {errors.title && (
                <p className="text-xs text-red-500">{errors.title.message}</p>
              )}
            </div>

            <CoverImageUploader
              preview={coverPreview}
              onFileSelect={handleFileSelect}
              onClear={handleClearCover}
              error={coverError}
            />
          </SectionCard>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 2 — Data e horário                                     */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={2}
            icon={<Calendar className="h-4 w-4" />}
            title="Data e horário"
            subtitle="Quando o evento vai acontecer?"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  Data de início *
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register("startDate")}
                  className={errors.startDate ? "border-red-400" : ""}
                />
                {errors.startDate && (
                  <p className="text-xs text-red-500">{errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">
                  <Clock className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  Hora de início *
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  {...register("startTime")}
                  className={errors.startTime ? "border-red-400" : ""}
                />
                {errors.startTime && (
                  <p className="text-xs text-red-500">{errors.startTime.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  Data de término *
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register("endDate")}
                  className={errors.endDate ? "border-red-400" : ""}
                />
                {errors.endDate && (
                  <p className="text-xs text-red-500">{errors.endDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">
                  <Clock className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  Hora de término *
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  {...register("endTime")}
                  className={errors.endTime ? "border-red-400" : ""}
                />
                {errors.endTime && (
                  <p className="text-xs text-red-500">{errors.endTime.message}</p>
                )}
              </div>
            </div>

            <DurationBadge
              startDate={startDate}
              startTime={startTime}
              endDate={endDate}
              endTime={endTime}
            />
          </SectionCard>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 3 — Descrição                                          */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={3}
            icon={<FileText className="h-4 w-4" />}
            title="Descrição do evento"
            subtitle="Conte os detalhes, atrações e programação"
          >
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                placeholder="Descreva o evento, atrações, programação, informações importantes para os participantes..."
                rows={7}
                {...register("description")}
                className={cn(
                  "resize-none leading-relaxed",
                  errors.description ? "border-red-400" : ""
                )}
              />
              {errors.description ? (
                <p className="text-xs text-red-500">{errors.description.message}</p>
              ) : (
                <p className="text-xs text-gray-400">
                  {watch("description")?.length ?? 0} / 5000 caracteres
                </p>
              )}
            </div>
          </SectionCard>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 4 — Local                                              */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={4}
            icon={<MapPin className="h-4 w-4" />}
            title="Onde o seu evento vai acontecer?"
            subtitle="Endereço completo do local"
          >
            {/* Nome do local */}
            <div className="space-y-1.5">
              <Label htmlFor="venue">Nome do local *</Label>
              <Input
                id="venue"
                placeholder="Ex: Allianz Parque, Centro de Convenções, etc."
                {...register("venue")}
                className={errors.venue ? "border-red-400" : ""}
              />
              {errors.venue && (
                <p className="text-xs text-red-500">{errors.venue.message}</p>
              )}
            </div>

            {/* CEP */}
            <div className="space-y-1.5">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                placeholder="00000-000"
                maxLength={9}
                {...register("cep")}
                className="max-w-[180px]"
              />
            </div>

            {/* Rua + Número */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="street">Rua / Avenida *</Label>
                <Input
                  id="street"
                  placeholder="Rua das Flores"
                  {...register("street")}
                  className={errors.street ? "border-red-400" : ""}
                />
                {errors.street && (
                  <p className="text-xs text-red-500">{errors.street.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addressNumber">Número</Label>
                <Input
                  id="addressNumber"
                  placeholder="100"
                  {...register("addressNumber")}
                />
              </div>
            </div>

            {/* Complemento + Bairro */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="addressComplement">Complemento</Label>
                <Input
                  id="addressComplement"
                  placeholder="Bloco A, Ap. 201..."
                  {...register("addressComplement")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  placeholder="Centro"
                  {...register("neighborhood")}
                />
              </div>
            </div>

            {/* Cidade + Estado */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  placeholder="São Paulo"
                  {...register("city")}
                  className={errors.city ? "border-red-400" : ""}
                />
                {errors.city && (
                  <p className="text-xs text-red-500">{errors.city.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">Estado *</Label>
                <Input
                  id="state"
                  placeholder="SP"
                  maxLength={2}
                  className={cn("uppercase", errors.state ? "border-red-400" : "")}
                  {...register("state")}
                />
                {errors.state && (
                  <p className="text-xs text-red-500">{errors.state.message}</p>
                )}
              </div>
            </div>

            {/* Google Maps checkbox */}
            <div className="flex items-center gap-2.5 pt-1">
              <Checkbox
                id="showOnGoogleMaps"
                checked={watch("showOnGoogleMaps")}
                onCheckedChange={(v: boolean | "indeterminate") => setValue("showOnGoogleMaps", v === true)}
              />
              <Label htmlFor="showOnGoogleMaps" className="cursor-pointer font-normal">
                Mostrar o endereço no Google Maps na página do evento
              </Label>
            </div>

            {/* Store promo block */}
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-900 text-sm">
                    EventosOmega Store — Venda produtos no seu evento!
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    Ofereça camisetas, brindes, drinks e outros produtos diretamente no momento da compra do ingresso.
                  </p>
                  <div className="flex items-center gap-2.5 mt-3">
                    <Checkbox
                      id="sellProducts"
                      checked={watch("sellProducts")}
                      onCheckedChange={(v: boolean | "indeterminate") => setValue("sellProducts", v === true)}
                    />
                    <Label htmlFor="sellProducts" className="cursor-pointer font-medium text-amber-800 text-sm">
                      Quero vender produtos!
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 5 — Ingressos                                          */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={5}
            icon={<Ticket className="h-4 w-4" />}
            title="Ingressos"
            subtitle="Configure os tipos de ingresso disponíveis para venda"
          >
            {fields.length === 0 && (
              <div className="text-center py-8 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                <Ticket className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">Nenhum ingresso adicionado</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Use os botões abaixo para criar ingressos pagos ou gratuitos.
                </p>
              </div>
            )}

            {errors.ticketTypes?.root && (
              <p className="text-xs text-red-500">{errors.ticketTypes.root.message}</p>
            )}

            {/* Listagem de ingressos */}
            <div className="space-y-3">
              {fields.map((field, idx) => {
                const isFree = ticketValues?.[idx]?.isFree ?? false;
                return (
                  <div
                    key={field.id}
                    className={cn(
                      "rounded-lg border p-4 space-y-4",
                      isFree
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-primary/20 bg-primary/5"
                    )}
                  >
                    {/* Cabeçalho do card de ingresso */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full",
                          isFree
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-primary/15 text-primary"
                        )}
                      >
                        <Ticket className="h-3 w-3" />
                        {isFree ? "Gratuito" : "Pago"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-500"
                        onClick={() => remove(idx)}
                        title="Remover ingresso"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Campos do ingresso */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label>Nome do ingresso *</Label>
                        <Input
                          placeholder={isFree ? "Entrada Gratuita" : "Ex: Pista, VIP, Camarote..."}
                          {...register(`ticketTypes.${idx}.name`)}
                          className={errors.ticketTypes?.[idx]?.name ? "border-red-400" : ""}
                        />
                        {errors.ticketTypes?.[idx]?.name && (
                          <p className="text-xs text-red-500">
                            {errors.ticketTypes[idx]?.name?.message}
                          </p>
                        )}
                      </div>

                      {!isFree && (
                        <div className="space-y-1.5">
                          <Label>Preço (R$) *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                              R$
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0,00"
                              className="pl-9"
                              {...register(`ticketTypes.${idx}.price`, { valueAsNumber: true })}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label>Quantidade total *</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="100"
                          {...register(`ticketTypes.${idx}.totalQuantity`, { valueAsNumber: true })}
                          className={errors.ticketTypes?.[idx]?.totalQuantity ? "border-red-400" : ""}
                        />
                        {errors.ticketTypes?.[idx]?.totalQuantity && (
                          <p className="text-xs text-red-500">
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
                          placeholder="Ex: Inclui open bar, acesso ao camarote VIP..."
                          {...register(`ticketTypes.${idx}.description`)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botões de adicionar */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPaidTicket}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4" />
                + INGRESSO PAGO
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFreeTicket}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                + INGRESSO GRATUITO
              </Button>
            </div>
          </SectionCard>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 6 — Sobre o produtor                                   */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={6}
            icon={<User2 className="h-4 w-4" />}
            title="Sobre o produtor"
            subtitle="Informações exibidas na página pública do evento"
          >
            <div className="space-y-1.5">
              <Label htmlFor="producerName">Nome do produtor / organização</Label>
              <Input
                id="producerName"
                placeholder="Ex: Colégio Ômega Eventos"
                {...register("producerName")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="producerBio">Bio curta</Label>
              <Textarea
                id="producerBio"
                placeholder="Conte um pouco sobre quem organiza este evento, a missão e o histórico..."
                rows={4}
                className="resize-none"
                {...register("producerBio")}
              />
              <p className="text-xs text-gray-400">
                {watch("producerBio")?.length ?? 0} / 1500 caracteres
              </p>
            </div>
          </SectionCard>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Seção 7 — Responsabilidades e visibilidade                   */}
          {/* ──────────────────────────────────────────────────────────── */}
          <SectionCard
            number={7}
            icon={<FileText className="h-4 w-4" />}
            title="Responsabilidades e visibilidade"
            subtitle="Termos de uso e configuração de acesso ao evento"
          >
            {/* Visibilidade */}
            <div className="space-y-2">
              <Label>Visibilidade do evento</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("visibility", "public")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    visibility === "public"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  <Globe className="h-4 w-4" />
                  Público
                </button>
                <button
                  type="button"
                  onClick={() => setValue("visibility", "private")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    visibility === "private"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  <Lock className="h-4 w-4" />
                  Privado
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {visibility === "public"
                  ? "O evento será listado publicamente e poderá ser encontrado na busca."
                  : "O evento não aparecerá na listagem pública. Apenas quem tiver o link poderá acessar."}
              </p>
            </div>

            {/* Termos */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3 text-sm text-gray-600 leading-relaxed">
              <p className="font-medium text-gray-800">Política de uso da plataforma EventosOmega</p>
              <ul className="list-disc list-inside space-y-1.5 text-xs">
                <li>O organizador é responsável por todas as informações divulgadas sobre o evento.</li>
                <li>
                  A taxa de intermediação da plataforma é de{" "}
                  <strong className="text-gray-800">2%</strong> sobre o valor bruto de cada venda,
                  calculada automaticamente no servidor.
                </li>
                <li>O reembolso de participantes deve seguir a política do organizador, respeitando o CDC.</li>
                <li>Conteúdo enganoso, ilegal ou ofensivo resultará em remoção imediata do evento.</li>
                <li>O organizador deve garantir que o local e a data estão confirmados antes de publicar.</li>
              </ul>
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="acceptTerms"
                checked={acceptTerms}
                onCheckedChange={(v: boolean | "indeterminate") => setValue("acceptTerms", v === true)}
              />
              <Label htmlFor="acceptTerms" className="cursor-pointer font-normal leading-relaxed">
                Li e concordo com os{" "}
                <span className="text-primary underline underline-offset-2">
                  Termos de Uso
                </span>{" "}
                e a{" "}
                <span className="text-primary underline underline-offset-2">
                  Política de Privacidade
                </span>{" "}
                da plataforma EventosOmega.
              </Label>
            </div>
          </SectionCard>

          {/* Feedback de erro */}
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {submitTypeRef.current === "publish"
                  ? "Evento publicado com sucesso! Redirecionando..."
                  : "Rascunho salvo! Redirecionando..."}
              </span>
            </div>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* Footer fixo com ações                                           */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isPending || success}
                onClick={() => { submitTypeRef.current = "draft"; }}
                className="gap-1.5"
              >
                {isPending && submitTypeRef.current === "draft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar rascunho
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="gap-1.5 hidden sm:flex"
                title="Salve um rascunho primeiro para pré-visualizar"
              >
                <Eye className="h-4 w-4" />
                Pré-visualizar
              </Button>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isPending || success}
              onClick={() => { submitTypeRef.current = "publish"; }}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
            >
              {isPending && submitTypeRef.current === "publish" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Publicar Evento
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

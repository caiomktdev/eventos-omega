import type { ElementType } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Settings2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/fee";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  PUBLISHED: { label: "Publicado", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  FINISHED: { label: "Finalizado", variant: "outline" },
};

interface DashboardEventCardProps {
  id: string;
  slug: string;
  title: string;
  status: string;
  startDate: Date;
  participantCount: number;
  confirmedCount: number;
  revenue: number;
}

function StatPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5",
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0 opacity-70" />
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

export function DashboardEventCard({
  id,
  slug,
  title,
  status,
  startDate,
  participantCount,
  confirmedCount,
  revenue,
}: DashboardEventCardProps) {
  const statusCfg = STATUS_LABEL[status] ?? STATUS_LABEL.DRAFT;

  const enrollmentLabel =
    participantCount === 1
      ? "1 inscrição"
      : `${participantCount} inscrições`;

  const confirmedSuffix =
    confirmedCount > 0
      ? ` · ${confirmedCount} confirmado${confirmedCount !== 1 ? "s" : ""}`
      : "";

  return (
    <article className="group rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:border-border hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/event/${slug}`}
                className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary sm:text-lg"
              >
                {title}
              </Link>
              <Badge variant={statusCfg.variant} className="shrink-0">
                {statusCfg.label}
              </Badge>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {format(new Date(startDate), "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <StatPill
              icon={Users}
              label="Inscrições"
              value={`${enrollmentLabel}${confirmedSuffix}`}
            />
            <StatPill
              icon={DollarSign}
              label="Receita"
              value={formatCurrency(revenue)}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
          <Button asChild size="sm" className="shadow-sm">
            <Link href={`/dashboard/events/${id}`}>
              <Settings2 className="h-3.5 w-3.5" />
              Gerenciar
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/events/${id}/edit#formulario`}>
              <ClipboardList className="h-3.5 w-3.5" />
              Formulário
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/event/${slug}`}>
              Ver página
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

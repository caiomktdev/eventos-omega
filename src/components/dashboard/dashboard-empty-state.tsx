import Link from "next/link";
import { CalendarPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <CalendarPlus className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        Nenhum evento ainda
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Crie seu primeiro evento para começar a vender ingressos e acompanhar
        inscrições em tempo real.
      </p>
      <Button asChild className="mt-6 shadow-sm">
        <Link href="/dashboard/events/new">
          <Sparkles className="h-4 w-4" />
          Criar primeiro evento
        </Link>
      </Button>
    </div>
  );
}

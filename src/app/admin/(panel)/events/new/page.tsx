/**
 * /admin/events/new — criação de evento pelo administrador.
 * Usa o mesmo formulário premium de 7 seções estilo Sympla do organizador.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateEventForm } from "@/components/events/create-event-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Criar Evento",
};

export default function AdminNewEventPage() {
  return (
    <div className="-m-6 lg:-m-8">
      {/* Barra superior de contexto — padrão Sympla */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 gap-1.5 text-slate-600"
          >
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              Painel Admin
            </Link>
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-none">
              Criar novo evento
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Preencha as 7 seções abaixo e publique quando estiver pronto.
            </p>
          </div>
        </div>
      </div>

      <CreateEventForm
        backHref="/admin"
        backLabel="Painel Admin"
        formContext="admin"
      />
    </div>
  );
}

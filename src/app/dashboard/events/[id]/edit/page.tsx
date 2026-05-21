/**
 * /dashboard/events/[id]/edit — edição de evento pelo organizador.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { AdminEventForm } from "@/components/admin/admin-event-form";
import type { EventFormStructure } from "@/types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  return { title: event ? `Editar: ${event.title}` : "Editar Evento" };
}

export default async function DashboardEditEventPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      ticketTypes: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          totalQuantity: true,
          soldQuantity: true,
          maxPerOrder: true,
        },
        orderBy: { price: "asc" },
      },
    },
  });

  if (!event) notFound();

  const canEdit =
    session.user.role === "ADMIN" || event.organizerId === session.user.id;
  if (!canEdit) notFound();

  const defaultValues = {
    title: event.title,
    description: event.description,
    coverImage: event.coverImage?.startsWith("data:") ? "" : (event.coverImage ?? ""),
    venue: event.venue,
    address: event.address,
    city: event.city,
    state: event.state,
    startDate: event.startDate.toISOString().slice(0, 16),
    endDate: event.endDate.toISOString().slice(0, 16),
    producerName: event.producerName ?? "",
    producerBio: event.producerBio ?? "",
    ticketTypes: event.ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      price: Number(t.price),
      totalQuantity: t.totalQuantity,
      soldQuantity: t.soldQuantity,
      maxPerOrder: t.maxPerOrder,
    })),
    formStructure: event.formStructure as unknown as EventFormStructure,
  };

  return (
    <div className="-m-6 lg:-m-8 min-h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 text-slate-600">
            <Link href={`/dashboard/events/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              Gerenciar evento
            </Link>
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 leading-none truncate">
              Editar evento
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{event.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <AdminEventForm
          mode="edit"
          eventId={id}
          initialStatus={event.status}
          storedCoverImage={event.coverImage}
          successRedirectPath={`/dashboard/events/${id}`}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  );
}

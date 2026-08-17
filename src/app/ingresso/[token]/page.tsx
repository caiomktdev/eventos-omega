import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, Ticket, CircleCheckBig } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TicketPage({ params }: PageProps) {
  const { token } = await params;

  const participant = await prisma.participant.findUnique({
    where: { checkInToken: token },
    select: {
      ordemCompra: true,
      status: true,
      formData: true,
      user: { select: { name: true } },
      event: {
        select: {
          title: true,
          slug: true,
          venue: true,
          city: true,
          state: true,
          startDate: true,
        },
      },
      ticketType: { select: { name: true } },
    },
  });

  if (!participant) notFound();

  if (participant.status !== "CONFIRMED" && participant.status !== "CHECKED_IN") {
    return (
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Ingresso indisponível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Este ingresso ainda não está confirmado para acesso digital.</p>
            <Button asChild variant="outline">
              <Link href="/meus-ingressos">Ver meus ingressos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formData = participant.formData as Record<string, unknown>;
  const participantName =
    String(formData?.nome ?? formData?.name ?? participant.user.name ?? "Participante");
  const orderLabel = `#${String(participant.ordemCompra).padStart(5, "0")}`;
  const eventDate = format(
    new Date(participant.event.startDate),
    "EEEE, dd 'de' MMMM 'às' HH:mm",
    { locale: ptBR }
  ).replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-primary/5">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-xl">Ingresso digital</CardTitle>
            <Badge variant={participant.status === "CHECKED_IN" ? "secondary" : "success"}>
              {participant.status === "CHECKED_IN" ? "Check-in realizado" : "Confirmado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ordem de compra</p>
            <p className="mt-1 font-mono text-3xl font-bold">{orderLabel}</p>
          </div>

          <div className="space-y-3 text-sm">
            <p className="font-medium">{participantName}</p>
            <p className="text-muted-foreground">{participant.ticketType.name}</p>
            <p className="font-semibold">{participant.event.title}</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{eventDate}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                {participant.event.venue} · {participant.event.city}/{participant.event.state}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-4 text-center">
            <Ticket className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">Token para validação de check-in</p>
            <p className="mt-1 break-all font-mono text-xs">{token}</p>
          </div>

          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <div className="flex items-center gap-2">
              <CircleCheckBig className="h-4 w-4" />
              <span>Apresente este ingresso na entrada do evento.</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href={`/event/${participant.event.slug}`}>Ver evento</Link>
            </Button>
            <Button asChild className="w-full">
              <Link href="/meus-ingressos">Meus ingressos</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

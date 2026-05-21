/**
 * /events/[id] — Redirect permanente para /event/[slug]
 *
 * Esta rota é mantida exclusivamente para compatibilidade com links antigos.
 * Qualquer acesso é redirecionado (308 Permanent) para a URL canônica por slug.
 */

import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface EventRedirectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventRedirectPage({
  params,
}: EventRedirectPageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { slug: true },
  });

  if (!event) notFound();

  permanentRedirect(`/event/${event.slug}`);
}

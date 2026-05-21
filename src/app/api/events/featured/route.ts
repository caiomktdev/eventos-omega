import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 4), 8);

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
      city: true,
      state: true,
      startDate: true,
      venue: true,
    },
    orderBy: { startDate: "asc" },
    take: limit,
  });

  return NextResponse.json(events);
}

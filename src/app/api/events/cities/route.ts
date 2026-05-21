import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: { city: true, state: true },
    orderBy: [{ city: "asc" }, { state: "asc" }],
  });

  const seen = new Set<string>();
  const cities = events.filter(({ city, state }) => {
    const key = `${city}|${state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(cities);
}

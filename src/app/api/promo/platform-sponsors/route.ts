/**
 * GET /api/promo/platform-sponsors — logos ativos de patrocinadores da plataforma
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sponsors = await prisma.platformSponsor.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        logoUrl: true,
        linkUrl: true,
        sortOrder: true,
      },
    });

    return NextResponse.json(sponsors);
  } catch (error) {
    console.error("[GET /api/promo/platform-sponsors]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

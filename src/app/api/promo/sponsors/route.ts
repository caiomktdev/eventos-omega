/**
 * GET /api/promo/sponsors — mídias ativas do banner promocional da home
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sponsors = await prisma.platformBannerMedia.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        sponsorName: true,
        mediaType: true,
        mediaUrl: true,
        linkUrl: true,
      },
    });

    return NextResponse.json(sponsors);
  } catch (error) {
    console.error("[GET /api/promo/sponsors]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

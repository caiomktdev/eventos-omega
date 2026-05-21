/**
 * Smoke test — valida dados mínimos da home e APIs públicas.
 * Uso: npm run test:smoke (requer .env.local; APIs opcionais se dev server ativo)
 */

import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function assertDb() {
  const prisma = new PrismaClient();

  try {
    const [publishedEvents, sponsors, banners, users] = await Promise.all([
      prisma.event.count({ where: { status: "PUBLISHED" } }),
      prisma.platformSponsor.count({ where: { isActive: true } }),
      prisma.platformBannerMedia.count({ where: { isActive: true } }),
      prisma.user.count(),
    ]);

    const checks: Array<[string, number, number]> = [
      ["eventos publicados", publishedEvents, 1],
      ["patrocinadores ativos", sponsors, 1],
      ["banners ativos", banners, 1],
      ["usuários", users, 1],
    ];

    for (const [label, count, min] of checks) {
      if (count < min) {
        throw new Error(
          `DB: esperado >= ${min} ${label}, encontrado ${count}. Rode npm run db:seed`
        );
      }
    }

    console.log("✓ Banco OK:", { publishedEvents, sponsors, banners, users });
  } finally {
    await prisma.$disconnect();
  }
}

async function assertJsonArray(path: string, minLength: number) {
  const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length < minLength) {
    throw new Error(
      `${path} → esperado array com >= ${minLength}, recebido ${Array.isArray(data) ? data.length : typeof data}`
    );
  }
  console.log(`✓ ${path} → ${data.length} item(ns)`);
}

async function assertHomeHtml() {
  const res = await fetch(`${BASE_URL}/`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Home → HTTP ${res.status}`);
  }
  const html = await res.text();
  const markers = ["Festival de Rock", "Patrocinadores", "Eventos em destaque"];
  for (const marker of markers) {
    if (!html.includes(marker)) {
      throw new Error(`Home não contém "${marker}"`);
    }
  }
  console.log("✓ Home HTML contém eventos, patrocinadores e seção de destaque");
}

async function assertApisIfServerUp() {
  try {
    await assertJsonArray("/api/events/featured?limit=4", 1);
    await assertJsonArray("/api/promo/sponsors", 1);
    await assertJsonArray("/api/promo/platform-sponsors", 1);
    await assertHomeHtml();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      console.warn(
        "⚠ APIs/home não testadas — servidor dev não está em",
        BASE_URL
      );
      return;
    }
    throw err;
  }
}

async function main() {
  console.log("Smoke test EventosOmega\n");
  await assertDb();
  await assertApisIfServerUp();
  console.log("\nSmoke test concluído.");
}

main().catch((err) => {
  console.error("\n✗ Smoke test falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});

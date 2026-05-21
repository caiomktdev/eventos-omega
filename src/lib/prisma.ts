/**
 * Singleton do Prisma Client para evitar múltiplas conexões em dev com hot-reload.
 * Usa Proxy para revalidar delegates após `prisma generate` sem reiniciar o servidor.
 */

import type { PrismaClient as PrismaClientType } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

const REQUIRED_DELEGATES = ["platformSponsor", "platformBannerMedia"] as const;

function loadPrismaClientClass(): typeof PrismaClientType {
  if (process.env.NODE_ENV === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const clientPath = require.resolve("@prisma/client");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const runtimePath = require.resolve(".prisma/client/default");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      delete require.cache[clientPath];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      delete require.cache[runtimePath];
    } catch {
      // Turbopack/edge podem não expor require.resolve.
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@prisma/client") as typeof import("@prisma/client");
  return mod.PrismaClient;
}

function createPrismaClient(): PrismaClientType {
  const PrismaClient = loadPrismaClientClass();
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function hasRequiredDelegates(client: PrismaClientType): boolean {
  return REQUIRED_DELEGATES.every(
    (key) =>
      typeof (client as PrismaClientType & Record<string, unknown>)[key]?.findMany ===
      "function"
  );
}

function ensurePrismaClient(): PrismaClientType {
  const cached = globalForPrisma.prisma;

  if (cached && hasRequiredDelegates(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop, receiver) {
    const client = ensurePrismaClient();
    const value = Reflect.get(client, prop, receiver);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});

/**
 * Extensão de tipos do Auth.js v5 para incluir `role` e `mercadoPagoUserId`
 * na Session e no JWT token.
 *
 * Esses tipos ficam disponíveis em qualquer lugar que importe de "next-auth".
 */

import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      mercadoPagoUserId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    mercadoPagoUserId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    mercadoPagoUserId?: string | null;
  }
}

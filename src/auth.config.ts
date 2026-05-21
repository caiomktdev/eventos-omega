/**
 * Configuração Edge-compatível do Auth.js v5.
 *
 * Este arquivo NÃO pode importar Prisma, bcryptjs nem nenhuma dependência
 * Node.js exclusiva, pois é usado pelo middleware que roda no Edge Runtime.
 *
 * O auth.ts importa este arquivo e adiciona os providers (Credentials)
 * que requerem Node.js.
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" as const },

  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },

  callbacks: {
    /**
     * `authorized` é chamado pelo middleware a cada request protegido.
     * Roda no Edge — zero imports Node.js aqui.
     *
     * - /admin/login → sempre permitido
     * - /admin/*     → requer role === "ADMIN"
     * - /dashboard/* → requer role === "ADMIN" | "ORGANIZER"
     */
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;
      const role = (auth?.user as { role?: string } | undefined)?.role;

      if (pathname === "/admin/login") return true;

      if (pathname.startsWith("/admin")) {
        return !!auth?.user && role === "ADMIN";
      }

      if (pathname.startsWith("/dashboard")) {
        return !!auth?.user && (role === "ADMIN" || role === "ORGANIZER");
      }

      return true;
    },

    // Persiste role e mercadoPagoUserId no JWT
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.mercadoPagoUserId =
          (user as { mercadoPagoUserId?: string | null }).mercadoPagoUserId ??
          null;
      }
      return token;
    },

    // Repassa campos do JWT para a Session
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.user.role = token.role as any;
        session.user.mercadoPagoUserId = token.mercadoPagoUserId as
          | string
          | null;
      }
      return session;
    },
  },

  providers: [],
} satisfies NextAuthConfig;

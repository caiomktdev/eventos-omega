/**
 * Middleware de controle de acesso por roles — src/middleware.ts
 *
 * NOTA: Em projetos Next.js com diretório src/, o middleware DEVE estar
 * em src/middleware.ts (não na raiz do projeto).
 *
 * Usa `auth` do NextAuth(authConfig) — Edge-compatível (sem Prisma/bcrypt).
 * O callback `authorized` em authConfig.ts define as regras por role:
 *
 *   /admin/login  → livre (sempre)
 *   /admin/*      → role === "ADMIN"
 *   /dashboard/*  → role === "ADMIN" | "ORGANIZER"
 *
 * Quando `authorized` retorna false, Auth.js redireciona para
 * pages.signIn (/admin/login) com ?callbackUrl preservado.
 */

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
  ],
};

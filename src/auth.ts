/**
 * Configuração principal do Auth.js v5 — roda no runtime Node.js.
 *
 * Estende authConfig (Edge-compatível) adicionando o CredentialsProvider
 * que usa Prisma e bcryptjs (Node.js only).
 *
 * NUNCA importe este arquivo no middleware.ts.
 * Use sempre @/auth.config no middleware.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },

      async authorize(credentials) {
        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        if (!email?.trim() || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            password: true,
            mercadoPagoUserId: true,
          },
        });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          mercadoPagoUserId: user.mercadoPagoUserId,
        };
      },
    }),
  ],
});

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").max(120),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres.").max(72),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit({
      scope: "api:auth:register",
      key: ip,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSec);
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.flatten().fieldErrors.email?.[0] ??
            parsed.error.flatten().fieldErrors.password?.[0] ??
            parsed.error.flatten().fieldErrors.name?.[0] ??
            "Dados inválidos.",
        },
        { status: 422 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, role: true },
    });

    if (existing?.password) {
      return NextResponse.json({ error: "Este e-mail já possui uma conta." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    if (existing && !existing.password) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name.trim(),
          password: passwordHash,
          role: existing.role ?? "BUYER",
        },
      });
      return NextResponse.json({ created: true, linked: true }, { status: 201 });
    }

    await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        password: passwordHash,
        role: "BUYER",
      },
    });

    return NextResponse.json({ created: true, linked: false }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Erro interno ao criar conta." }, { status: 500 });
  }
}

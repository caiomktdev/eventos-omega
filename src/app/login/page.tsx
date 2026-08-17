import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function UserLoginPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "ADMIN") redirect("/admin");
    if (session.user.role === "ORGANIZER") redirect("/dashboard");
    redirect("/meus-ingressos");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Entrar na sua conta</h1>
        <p className="mt-1.5 text-sm text-gray-500">Acompanhe compras e ingressos digitais.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <LoginForm callbackUrl={callbackUrl} audience="user" />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

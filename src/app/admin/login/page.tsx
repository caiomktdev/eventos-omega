/**
 * /admin/login — tela de login unificada para Admin e Organizer.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar — EventosOmega",
};

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const session = await auth();

  if (session?.user) {
    const { callbackUrl } = await searchParams;
    redirect(
      session.user.role === "ADMIN"
        ? callbackUrl ?? "/admin"
        : callbackUrl ?? "/dashboard"
    );
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Bem-vindo de volta
        </h1>
        <p className="text-sm text-gray-500 mt-1.5">
          Entre com suas credenciais para continuar
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <LoginForm callbackUrl={callbackUrl} />
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Problemas para acessar?{" "}
        <span className="text-primary cursor-pointer hover:underline">
          Entre em contato com o suporte
        </span>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "ADMIN") redirect("/admin");
    if (session.user.role === "ORGANIZER") redirect("/dashboard");
    redirect("/meus-ingressos");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Criar conta</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Cadastre-se para comprar ingressos e acompanhar seus pedidos.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <RegisterForm />
      </div>
    </div>
  );
}

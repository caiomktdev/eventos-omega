/**
 * LoginForm — formulário de autenticação com tratamento de erros amigável.
 * Client Component: usa signIn de next-auth/react com redirect: false
 * para controlar o fluxo de erro/sucesso sem page reload.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  callbackUrl?: string;
}

// Mapeia os códigos de erro do next-auth para mensagens em português
function humanizeError(error: string | undefined | null): string {
  if (!error) return "";
  switch (error) {
    case "CredentialsSignin":
      return "E-mail ou senha incorretos. Verifique e tente novamente.";
    case "SessionRequired":
      return "Sua sessão expirou. Faça login novamente.";
    case "AccessDenied":
      return "Você não tem permissão para acessar esta área.";
    default:
      return "Ocorreu um erro inesperado. Tente novamente.";
  }
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Informe o seu e-mail.");
      return;
    }
    if (!password) {
      setError("Informe a sua senha.");
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(humanizeError(result.error));
        return;
      }

      // Força re-fetch da session no server após login
      router.refresh();

      // Redireciona para callbackUrl ou para área correta por role
      // O redirect definitivo é feito pelo middleware, aqui usamos o callback
      const destination = callbackUrl ?? "/admin";
      router.push(destination);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Campo e-mail */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          E-mail
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "pl-9",
              error && !password ? "border-red-400 focus-visible:ring-red-400" : ""
            )}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Campo senha */}
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
          Senha
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              "pl-9 pr-10",
              error ? "border-red-400 focus-visible:ring-red-400" : ""
            )}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Botão de submit */}
      <Button
        type="submit"
        className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-medium"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>

      {/* Dica de credenciais (apenas dev) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Credenciais de desenvolvimento:</p>
          <p>Admin: admin@eventosomega.com / Admin@2026!</p>
          <p>Organizer: organizer@eventosomega.com / Org@2026!</p>
        </div>
      )}
    </form>
  );
}

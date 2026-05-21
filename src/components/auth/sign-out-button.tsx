/**
 * SignOutButton — botão de logout que chama signOut do next-auth.
 * Client Component necessário pois signOut da v5 requer interação do browser.
 */

"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        className
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      Sair
    </button>
  );
}

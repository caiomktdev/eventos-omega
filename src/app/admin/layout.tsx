/**
 * Layout raiz da área administrativa.
 *
 * O guard de acesso é feito exclusivamente pelo middleware.ts (Auth.js v5).
 * Este layout apenas lê a sessão para exibir o nome/email do usuário logado
 * e renderiza a sidebar de navegação.
 */

import Link from "next/link";
import { LayoutDashboard, CalendarDays, BarChart3, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SiteLogo } from "@/components/brand/site-logo";

const NAV_ITEMS = [
  { href: "/admin",           label: "Visão Geral",         icon: LayoutDashboard },
  { href: "/admin/dashboard", label: "Dashboard Financeiro", icon: BarChart3 },
  { href: "/admin/events",    label: "Eventos",              icon: CalendarDays },
] as const;

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-background">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <SiteLogo variant="full" className="max-w-[140px]" />
          <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
            Admin
          </span>
        </div>

        {/* Usuário logado */}
        {user && (
          <div className="px-4 py-3 border-b bg-muted/20">
            <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
              {user.role}
            </span>
          </div>
        )}

        {/* Navegação */}
        <nav className="flex-1 space-y-1 p-3 pt-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <Separator />

        {/* Rodapé da sidebar */}
        <div className="p-3 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver site público
          </Link>
          <SignOutButton />
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

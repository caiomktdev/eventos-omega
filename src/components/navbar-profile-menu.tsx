/**
 * Menu de perfil do cabeçalho — estilo Sympla (hamburger + avatar).
 */

"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Menu,
  LogIn,
  LogOut,
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  Ticket,
  Loader2,
  Handshake,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function NavbarProfileMenu() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const initials = getInitials(user?.name);

  if (status === "loading") {
    return (
      <div
        className="flex h-10 w-[72px] items-center justify-center rounded-full border border-border/70"
        aria-label="Carregando perfil"
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-full border border-white/30",
            "bg-white/50 px-2.5 backdrop-blur-sm",
            "transition-all duration-200 ease-out",
            "hover:bg-white/80 hover:shadow-md hover:scale-[1.02]",
            "active:scale-[0.98]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
          aria-label={user ? `Menu de ${user.name ?? "usuário"}` : "Abrir menu de perfil"}
        >
          <Menu className="h-[18px] w-[18px] text-foreground/70" strokeWidth={2} />
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
              user ? "bg-muted text-foreground" : "bg-muted/80 text-muted-foreground"
            )}
          >
            {initials}
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 min-w-[240px] overflow-hidden rounded-xl border bg-popover p-1.5",
            "text-popover-foreground shadow-lg",
            "animate-in fade-in-0 slide-in-from-top-2 duration-200"
          )}
        >
          {user ? (
            <>
              <div className="mb-1 border-b border-border/60 px-3 py-2.5">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>

              {user.role === "ADMIN" && (
                <>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/admin"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Painel Admin
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/dashboard/sponsors"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <Handshake className="h-4 w-4" />
                      Patrocinadores
                    </Link>
                  </DropdownMenu.Item>
                </>
              )}

              {(user.role === "ORGANIZER" || user.role === "ADMIN") && (
                <>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/dashboard/events/new"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Criar evento
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/dashboard"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Meus eventos
                    </Link>
                  </DropdownMenu.Item>
                </>
              )}

              <DropdownMenu.Item asChild>
                <Link
                  href="/meus-ingressos"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                >
                  <Ticket className="h-4 w-4" />
                  Meus ingressos
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10"
                onSelect={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <DropdownMenu.Item asChild>
                <Link
                  href="/admin/login"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                >
                  <LogIn className="h-4 w-4" />
                  Entrar
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/dashboard/events/new"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                >
                  <PlusCircle className="h-4 w-4" />
                  Criar evento
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/dashboard"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                >
                  <CalendarDays className="h-4 w-4" />
                  Meus eventos
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/meus-ingressos"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                >
                  <Ticket className="h-4 w-4" />
                  Meus ingressos
                </Link>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

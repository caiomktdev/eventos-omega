"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname === "/admin/login" || pathname === "/login" || pathname === "/cadastro";

  if (isAuthPage) {
    return (
      <div className="flex min-h-dvh flex-col bg-gray-50">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {children}
        </main>
        <SiteFooter className="mt-0 shrink-0" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <SiteFooter />
    </>
  );
}

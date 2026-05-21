/**
 * Layout raiz da aplicação.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { SiteChrome } from "@/components/site-chrome";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "EventosOmega — Sua plataforma de eventos",
    template: "%s | EventosOmega",
  },
  description:
    "Descubra, crie e venda ingressos para os melhores eventos com segurança e praticidade.",
  keywords: ["eventos", "ingressos", "shows", "teatro", "concerts"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Eventos Omega",
  },
  icons: {
    icon: "/brand/favicon-omega.png",
    apple: "/brand/favicon-omega.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <SessionProvider>
          <SiteChrome>{children}</SiteChrome>
        </SessionProvider>
      </body>
    </html>
  );
}

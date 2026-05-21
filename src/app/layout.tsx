/**
 * Layout raiz da aplicação.
 * Define fonte, metadados globais e o Navbar persistente.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { SessionProvider } from "next-auth/react";

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
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <footer className="border-t bg-muted/40 py-8 mt-16">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              <p>© 2026 EventosOmega. Todos os direitos reservados.</p>
              <p className="mt-1">
                Uma tecnologia{" "}
                <a
                  href="https://www.instagram.com/moovehubb/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline underline-offset-2"
                >
                  Moovehubb
                </a>
                .
              </p>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}

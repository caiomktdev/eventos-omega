import Link from "next/link";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={`border-t bg-muted/40 py-8 ${className ?? "mt-16"}`}
    >
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>© 2026 EventosOmega. Todos os direitos reservados.</p>
        <p className="mt-1">
          Uma tecnologia{" "}
          <Link
            href="https://www.instagram.com/moovehubb/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline underline-offset-2"
          >
            Moovehubb
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}

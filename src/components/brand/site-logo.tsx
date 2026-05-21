import Link from "next/link";
import { cn } from "@/lib/utils";

export const BRAND = {
  logoFull: "/brand/logo-eventos-omega.png",
  logoMark: "/brand/favicon-omega.png",
  name: "Eventos Omega",
} as const;

interface SiteLogoProps {
  /** Logo completa ou apenas o ícone M (header compacto). */
  variant?: "full" | "mark";
  href?: string;
  className?: string;
}

export function SiteLogo({
  variant = "full",
  href = "/",
  className,
}: SiteLogoProps) {
  const isMark = variant === "mark";

  return (
    <Link
      href={href}
      aria-label={`${BRAND.name} — ir para a home`}
      className={cn("relative inline-flex shrink-0 items-center hover:opacity-90", className)}
    >
      {/* Container fixo evita reflow ao alternar variantes */}
      <span className="relative inline-flex h-10 items-center sm:h-11">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND.logoFull}
          alt=""
          aria-hidden={isMark}
          width={160}
          height={40}
          decoding="async"
          className={cn(
            "h-10 w-auto max-w-[min(160px,44vw)] object-contain transition-opacity duration-200 ease-out sm:h-11",
            isMark ? "pointer-events-none absolute inset-y-0 left-0 opacity-0" : "opacity-100"
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND.logoMark}
          alt={BRAND.name}
          width={80}
          height={40}
          decoding="async"
          className={cn(
            "max-h-10 w-auto max-w-20 object-contain transition-opacity duration-200 ease-out",
            isMark ? "opacity-100" : "pointer-events-none absolute inset-y-0 left-0 opacity-0"
          )}
        />
      </span>
    </Link>
  );
}

/**
 * CategoryNav — carrossel horizontal de categorias em destaque.
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FEATURED_CATEGORIES } from "@/lib/featured-categories";
import { buildCategoryHref } from "@/lib/home-query";

export function CategoryNav() {
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q")?.toLowerCase() ?? "";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent sm:hidden" />

      <div className="mx-auto flex w-fit max-w-full justify-center gap-2.5 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
        {FEATURED_CATEGORIES.map((cat) => {
          const isActive = currentQ === cat.query.toLowerCase();

          return (
            <Link
              key={cat.query}
              href={buildCategoryHref(searchParams, cat.query)}
              className={`
                flex shrink-0 snap-start items-center gap-2 rounded-full
                border px-4 py-2 text-sm font-medium
                transition-all duration-150 whitespace-nowrap
                ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/5"
                }
              `}
            >
              <span className="text-base leading-none" role="img" aria-hidden>
                {cat.emoji}
              </span>
              {cat.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

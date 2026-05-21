"use client";

/**
 * HomeFaq — seção de perguntas frequentes estilo Sympla (accordion).
 */

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_FAQ_ITEMS } from "@/lib/faq-items";

export function HomeFaq() {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section
      aria-labelledby="home-faq-heading"
      className="border-t border-border/80 py-8"
    >
      <div className="mb-6">
        <h2 id="home-faq-heading" className="text-xl font-bold">
          Precisa de ajuda?
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tire suas dúvidas aqui
        </p>
      </div>

      <div className="space-y-3">
        {HOME_FAQ_ITEMS.map((item) => {
          const isOpen = openId === item.id;

          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm"
            >
              <button
                type="button"
                id={`faq-trigger-${item.id}`}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${item.id}`}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
                  "text-sm font-semibold text-foreground transition-colors hover:bg-muted/30",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                )}
              >
                <span>{item.question}</span>
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary"
                >
                  {isOpen ? (
                    <Minus className="h-5 w-5" strokeWidth={2.2} />
                  ) : (
                    <Plus className="h-5 w-5" strokeWidth={2.2} />
                  )}
                </span>
              </button>

              <div
                id={`faq-panel-${item.id}`}
                role="region"
                aria-labelledby={`faq-trigger-${item.id}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 border-t border-border/50 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground">
                    <p>{item.answer}</p>
                    {item.id === "localizar-ingressos" && (
                      <p>
                        Acesse diretamente em{" "}
                        <Link
                          href="/meus-ingressos"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Meus ingressos
                        </Link>
                        .
                      </p>
                    )}
                    {item.id === "acesso-conta" && (
                      <p>
                        Faça login em{" "}
                        <Link
                          href="/admin/login"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Entrar na conta
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

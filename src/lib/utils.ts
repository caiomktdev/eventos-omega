/**
 * Utilitários gerais.
 *   cn()           — composição de classes Tailwind (padrão Shadcn)
 *   generateSlug() — gera slug URL-safe a partir de um título
 *   uniqueSlug()   — garante unicidade do slug consultando o banco
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte um texto em slug URL-safe, sem acentos e caracteres especiais.
 * Ex: "Festival de Rock Ômega 2026!" → "festival-de-rock-omega-2026"
 */
export function generateSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove diacríticos (acentos)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")      // mantém apenas alfanum, espaço e hífen
    .trim()
    .replace(/\s+/g, "-")              // espaços → hífens
    .replace(/-{2,}/g, "-");           // colapsa múltiplos hífens
}

/**
 * Gera um slug único adicionando sufixo numérico se já existir colisão.
 * Recebe uma função de verificação para ser agnóstico à fonte de dados.
 *
 * @param base   Slug base (gerado por generateSlug)
 * @param exists Função async que retorna true se o slug já estiver em uso
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = base;
  let attempt = 0;

  while (await exists(slug)) {
    attempt++;
    slug = `${base}-${attempt}`;
  }

  return slug;
}

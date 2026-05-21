/**
 * Helpers de URL/filtro da home — testáveis sem React.
 */

export function buildCategoryHref(
  searchParams: URLSearchParams | string,
  query: string
): string {
  const params =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams)
      : new URLSearchParams(searchParams.toString());

  params.set("q", query);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function getHomeSectionCopy(query?: string, city?: string) {
  if (query?.trim()) {
    return {
      title: `Resultados para "${query.trim()}"`,
      description: `Mostrando eventos que correspondem à sua busca${
        city?.trim() ? ` em ${city.trim()}` : ""
      }`,
    };
  }

  if (city?.trim()) {
    return {
      title: `Eventos em ${city.trim()}`,
      description: "Eventos publicados nesta cidade",
    };
  }

  return {
    title: "Eventos em destaque",
    description: "Os eventos com mais inscrições na plataforma",
  };
}

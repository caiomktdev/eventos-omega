/**
 * Categorias em destaque na home — hero carousel + CategoryNav.
 */

export interface FeaturedCategory {
  label: string;
  query: string;
  emoji: string;
  /** Gradiente Tailwind para o banner do hero */
  gradient: string;
  subtitle: string;
}

export const FEATURED_CATEGORIES: FeaturedCategory[] = [
  {
    label: "Festa junina Omega",
    query: "festa junina",
    emoji: "🎉",
    gradient: "from-orange-500 via-amber-500 to-yellow-400",
    subtitle: "Arraiá, quadrilha e muita diversão para toda a família",
  },
  {
    label: "Corrida Omega",
    query: "corrida",
    emoji: "🏃",
    gradient: "from-sky-500 via-blue-500 to-cyan-400",
    subtitle: "Provas, maratonas e desafios esportivos na sua cidade",
  },
  {
    label: "Prova substitutiva",
    query: "prova substitutiva",
    emoji: "📝",
    gradient: "from-indigo-500 via-blue-600 to-primary",
    subtitle: "Recupere sua nota com segurança e acompanhamento",
  },
  {
    label: "Pré-Enem",
    query: "pre enem",
    emoji: "📚",
    gradient: "from-violet-500 via-purple-600 to-indigo-600",
    subtitle: "Simulados e aulas intensivas para o vestibular",
  },
  {
    label: "Pré-medicina",
    query: "pre medicina",
    emoji: "🩺",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    subtitle: "Preparação focada para medicina e áreas da saúde",
  },
  {
    label: "Prova de bolsas colégio",
    query: "prova de bolsas",
    emoji: "🎓",
    gradient: "from-rose-500 via-pink-500 to-orange-400",
    subtitle: "Conquiste sua vaga com desconto no ensino médio",
  },
];

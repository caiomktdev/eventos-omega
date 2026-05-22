/**
 * Módulo de cálculo da taxa de intermediação Moove.
 *
 * REGRA DE NEGÓCIO CRÍTICA:
 * A taxa Moove é SEMPRE 5,5% sobre o valor bruto, calculada no servidor.
 * Este valor é imutável — nunca deve ser alterado por input do cliente.
 */

// Percentual fixo e imutável da taxa Moove (5,5%)
const MOOVE_FEE_RATE = 0.055 as const;

export interface FeeCalculation {
  grossAmount: number;
  mooveFee: number;
  organizerAmount: number;
  feeRateApplied: typeof MOOVE_FEE_RATE;
}

/**
 * Calcula a taxa de intermediação Moove e o valor líquido ao organizador.
 * Arredonda em centavos usando "round half up" para evitar fraudes de arredondamento.
 *
 * @param grossAmount - Valor bruto total em Reais (ex: 100.00)
 * @returns Objeto com taxa Moove, valor ao organizador e taxa aplicada para auditoria
 * @throws Error se o valor bruto for negativo ou inválido
 */
export function calculateMooveFee(grossAmount: number): FeeCalculation {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    throw new Error(
      `Valor bruto inválido para cálculo de taxa: ${grossAmount}`
    );
  }

  // Calculado em centavos para evitar imprecisão de ponto flutuante
  const grossCents = Math.round(grossAmount * 100);
  const feeCents = Math.round(grossCents * MOOVE_FEE_RATE);
  const organizerCents = grossCents - feeCents;

  return {
    grossAmount: grossCents / 100,
    mooveFee: feeCents / 100,
    organizerAmount: organizerCents / 100,
    feeRateApplied: MOOVE_FEE_RATE,
  };
}

/**
 * Formata o valor em Reais para exibição (ex: R$ 10,00)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Retorna a taxa Moove em percentual formatado para exibição
 */
export function getMooveFeePercentLabel(): string {
  const percent = MOOVE_FEE_RATE * 100;
  return Number.isInteger(percent)
    ? `${percent}%`
    : `${percent.toFixed(1).replace(".", ",")}%`;
}

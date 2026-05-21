import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMooveFee, formatCurrency } from "./fee";

describe("calculateMooveFee", () => {
  it("calcula 2% sobre o valor bruto", () => {
    const result = calculateMooveFee(100);
    assert.equal(result.grossAmount, 100);
    assert.equal(result.mooveFee, 2);
    assert.equal(result.organizerAmount, 98);
    assert.equal(result.feeRateApplied, 0.02);
  });

  it("arredonda centavos corretamente", () => {
    const result = calculateMooveFee(33.33);
    assert.equal(result.mooveFee, 0.67);
    assert.equal(result.organizerAmount, 32.66);
  });

  it("rejeita valores inválidos", () => {
    assert.throws(() => calculateMooveFee(-1));
  });
});

describe("formatCurrency", () => {
  it("formata em BRL", () => {
    assert.match(formatCurrency(150), /R\$\s*150,00/);
  });
});

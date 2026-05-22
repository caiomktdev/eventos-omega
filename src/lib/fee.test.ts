import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMooveFee, formatCurrency } from "./fee";

describe("calculateMooveFee", () => {
  it("calcula 5,5% sobre o valor bruto", () => {
    const result = calculateMooveFee(100);
    assert.equal(result.grossAmount, 100);
    assert.equal(result.mooveFee, 5.5);
    assert.equal(result.organizerAmount, 94.5);
    assert.equal(result.feeRateApplied, 0.055);
  });

  it("arredonda centavos corretamente", () => {
    const result = calculateMooveFee(33.33);
    assert.equal(result.mooveFee, 1.83);
    assert.equal(result.organizerAmount, 31.5);
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

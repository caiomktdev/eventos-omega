import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isReservationActive,
  reservationExpiresAtFromNow,
  RESERVATION_TTL_MS,
} from "./constants";

describe("reservation constants", () => {
  it("RESERVATION_TTL_MS é 30 minutos", () => {
    assert.equal(RESERVATION_TTL_MS, 30 * 60 * 1000);
  });

  it("reservationExpiresAtFromNow adiciona TTL", () => {
    const now = Date.UTC(2026, 4, 23, 12, 0, 0);
    const expires = reservationExpiresAtFromNow(now);
    assert.equal(expires.getTime(), now + RESERVATION_TTL_MS);
  });

  it("isReservationActive retorna true dentro do TTL", () => {
    const now = new Date("2026-05-23T12:00:00.000Z");
    const expires = new Date("2026-05-23T12:29:59.000Z");
    assert.equal(isReservationActive(expires, now), true);
  });

  it("isReservationActive retorna false após expirar", () => {
    const now = new Date("2026-05-23T12:30:01.000Z");
    const expires = new Date("2026-05-23T12:30:00.000Z");
    assert.equal(isReservationActive(expires, now), false);
  });

  it("isReservationActive retorna false sem data", () => {
    assert.equal(isReservationActive(null), false);
    assert.equal(isReservationActive(undefined), false);
  });
});

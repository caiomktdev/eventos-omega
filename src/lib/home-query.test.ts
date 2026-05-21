import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryHref,
  getHomeSectionCopy,
} from "./home-query.ts";
import {
  createOAuthState,
  parseOAuthState,
} from "./mercadopago-oauth.ts";

describe("buildCategoryHref", () => {
  it("preserva filtro de cidade ao trocar categoria", () => {
    const href = buildCategoryHref("city=Vi%C3%A7osa", "show");
    assert.equal(href, "/?city=Vi%C3%A7osa&q=show");
  });

  it("adiciona q quando não há outros params", () => {
    assert.equal(buildCategoryHref("", "teatro"), "/?q=teatro");
  });
});

describe("getHomeSectionCopy", () => {
  it("retorna título de busca com cidade", () => {
    const copy = getHomeSectionCopy("rock", "Viçosa");
    assert.match(copy.title, /rock/i);
    assert.match(copy.description, /Viçosa/);
  });

  it("retorna título padrão sem filtros", () => {
    const copy = getHomeSectionCopy();
    assert.equal(copy.title, "Eventos em destaque");
  });
});

describe("mercadopago OAuth state", () => {
  it("cria e parseia state com userId", () => {
    const state = createOAuthState("user-123");
    const parsed = parseOAuthState(state);
    assert.ok(parsed);
    assert.equal(parsed!.userId, "user-123");
    assert.ok(parsed!.nonce.length > 0);
  });

  it("rejeita state inválido", () => {
    assert.equal(parseOAuthState("invalid"), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeInitialHash } from "./SmoothScroll";

describe("normalizeInitialHash", () => {
  it("preserves valid section hashes on the landing page for deep linking", () => {
    assert.equal(normalizeInitialHash("/", "#interview"), "#interview");
    assert.equal(normalizeInitialHash("/", "#projects"), "#projects");
    assert.equal(normalizeInitialHash("/", "#about"), "#about");
    assert.equal(normalizeInitialHash("/", "#top"), "#top");
    assert.equal(normalizeInitialHash("/about", "#team"), "#team");
  });

  it("clears empty or invalid hashes", () => {
    assert.equal(normalizeInitialHash("/", ""), "");
    assert.equal(normalizeInitialHash("/", "#"), "");
    assert.equal(normalizeInitialHash("/", null), "");
    assert.equal(normalizeInitialHash("/", undefined), "");
    assert.equal(normalizeInitialHash("/", "#invalid hash with spaces"), "");
  });
});

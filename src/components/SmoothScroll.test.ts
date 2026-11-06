import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeInitialHash } from "./SmoothScroll";

describe("normalizeInitialHash", () => {
  it("clears stale interview hashes on the landing page and preserves the hero as the default view", () => {
    assert.equal(normalizeInitialHash("/", "#interview"), "");
    assert.equal(normalizeInitialHash("/", "#entretien"), "");
    assert.equal(normalizeInitialHash("/", "#top"), "");
    assert.equal(normalizeInitialHash("/about", "#team"), "#team");
  });
});

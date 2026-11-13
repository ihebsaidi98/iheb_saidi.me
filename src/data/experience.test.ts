/**
 * src/data/experience.test.ts
 *
 * Guards the data coupling between `src/data/experience.ts` and
 * `src/data/projects.ts` (`workPeriodsByOrganization`).
 *
 * Every organization listed in `experience` must have a corresponding entry
 * in `workPeriodsByOrganization`. Without this guarantee, `period` could be
 * `undefined` at runtime (the unsafe `as` assertion previously masked this).
 *
 * Run with: npm test
 * Or:       npx tsx --test src/data/experience.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { experience, validateExperiencePeriods } from "./experience";
import { workPeriodsByOrganization } from "./projects";

describe("experience / workPeriodsByOrganization coupling", () => {
  it("every experience organization has a period entry", () => {
    for (const job of experience) {
      const period = workPeriodsByOrganization[job.organization as keyof typeof workPeriodsByOrganization];
      assert.ok(period, `missing period for organization "${job.organization}"`);
      assert.strictEqual(typeof period, "string", `period for "${job.organization}" must be a string`);
      assert.ok(period.length > 0, `period for "${job.organization}" must not be empty`);
    }
  });

  it("experience entry count matches source config count", () => {
    assert.strictEqual(experience.length, 6);
  });

  it("every experience entry has a non-empty period", () => {
    for (const job of experience) {
      assert.ok(job.period.length > 0, `job "${job.organization}" has an empty period`);
    }
  });
});

// ============================================================
// validateExperiencePeriods
// ============================================================

describe("validateExperiencePeriods", () => {
  const currentOrganizations = experience.map((job) => job.organization);

  it("passes when every current organization has a period", () => {
    assert.doesNotThrow(() =>
      validateExperiencePeriods(experience, workPeriodsByOrganization),
    );
  });

  it("throws a descriptive error for an unknown organization", () => {
    assert.throws(
      () =>
        validateExperiencePeriods(
          [{ organization: "Unknown Organization" } as const],
          workPeriodsByOrganization,
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error, "expected an Error instance");
        assert.match(error.message, /Unknown Organization/);
        assert.match(
          error.message,
          /workPeriodsByOrganization/,
        );
        return true;
      },
      "unknown organization must throw a descriptive error",
    );
  });

  it("throws a descriptive error for an empty period", () => {
    const periodsWithEmpty: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(workPeriodsByOrganization).map(([key, value]) => [
          key,
          value as string,
        ]),
      ),
      "Empty Period Org": "",
    };
    assert.throws(
      () =>
        validateExperiencePeriods(
          [{ organization: "Empty Period Org" } as const],
          periodsWithEmpty,
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error, "expected an Error instance");
        assert.match(error.message, /Empty Period Org/);
        assert.match(error.message, /empty/);
        return true;
      },
      "empty period must throw a descriptive error",
    );
  });

  it("does not modify the input entries or periods", () => {
    const entriesSnapshot = JSON.stringify(currentOrganizations);
    const periodsSnapshot = JSON.stringify(workPeriodsByOrganization);

    validateExperiencePeriods(experience, workPeriodsByOrganization);

    assert.strictEqual(
      JSON.stringify(currentOrganizations),
      entriesSnapshot,
      "entries must not be modified by validation",
    );
    assert.strictEqual(
      JSON.stringify(workPeriodsByOrganization),
      periodsSnapshot,
      "periods must not be modified by validation",
    );
  });

  it("is deterministic across repeated calls", () => {
    const first = () =>
      validateExperiencePeriods(experience, workPeriodsByOrganization);
    const second = () =>
      validateExperiencePeriods(experience, workPeriodsByOrganization);

    assert.doesNotThrow(first);
    assert.doesNotThrow(second);
  });

  it("all six current entries keep their expected periods", () => {
    const expected: Record<string, string> = {
      "AgroRetail OS": "2026 – Present",
      "Novatek (Délice Group)": "Jul 2024 – Jan 2026",
      Tunisair: "Jan 2024 – Jul 2024",
      "Xtensus, Ariana": "Jul 2023 – Aug 2023",
      "World Soft Group, Marsa": "Jul 2022 – Sep 2022",
      "ISIMS, Sfax — Bachelor's Final Project": "Feb 2021 – Jun 2021",
    };

    assert.strictEqual(experience.length, 6);

    for (const job of experience) {
      assert.strictEqual(
        job.period,
        expected[job.organization],
        `period for "${job.organization}" must match the expected value`,
      );
    }
  });

  it("current organizations match workPeriodsByOrganization keys", () => {
    for (const organization of currentOrganizations) {
      assert.ok(
        organization in workPeriodsByOrganization,
        `organization "${organization}" must be a key of workPeriodsByOrganization`,
      );
    }
  });
});

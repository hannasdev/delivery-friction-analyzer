import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTargetRepository, validateTargetRepository } from "../src/contracts/target-repository.js";

describe("target repository contract", () => {
  it("normalizes a target repository separately from the product repository", () => {
    const result = normalizeTargetRepository(
      {
        owner: "hannasdev",
        name: "mcp-writing",
        defaultBranch: "main",
        visibility: "public",
        analysisWindowDays: 30,
        isValidationTarget: true,
      },
      {
        productRepository: {
          owner: "hannasdev",
          name: "delivery-friction-analyzer",
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.targetRepository.fullName, "hannasdev/mcp-writing");
    assert.equal(result.targetRepository.isValidationTarget, true);
  });

  it("rejects analyzing the product repository through the target contract", () => {
    const errors = validateTargetRepository(
      {
        owner: "hannasdev",
        name: "delivery-friction-analyzer",
        defaultBranch: "main",
        visibility: "public",
        analysisWindowDays: 30,
      },
      {
        productRepository: {
          owner: "hannasdev",
          name: "delivery-friction-analyzer",
        },
      },
    );

    assert(errors.some(error => error.includes("distinct from the product repository")));
  });

  it("rejects product repository matches case-insensitively", () => {
    const errors = validateTargetRepository(
      {
        owner: "HannasDev",
        name: "Delivery-Friction-Analyzer",
        defaultBranch: "main",
        visibility: "public",
        analysisWindowDays: 30,
      },
      {
        productRepository: {
          owner: "hannasdev",
          name: "delivery-friction-analyzer",
        },
      },
    );

    assert(errors.some(error => error.includes("distinct from the product repository")));
  });

  it("reports malformed owner and name without throwing during product repository comparison", () => {
    let errors;
    assert.doesNotThrow(() => {
      errors = validateTargetRepository(
        {
          owner: null,
          name: 42,
          defaultBranch: "main",
          visibility: "public",
          analysisWindowDays: 30,
        },
        {
          productRepository: {
            owner: "hannasdev",
            name: "delivery-friction-analyzer",
          },
        },
      );
    });

    assert(errors.some(error => error.includes("owner must be a GitHub owner/name segment")));
    assert(errors.some(error => error.includes("name must be a GitHub owner/name segment")));
  });

  it("rejects malformed analysis windows and branch names", () => {
    const errors = validateTargetRepository({
      owner: "hannasdev",
      name: "mcp-writing",
      defaultBranch: "main with spaces",
      visibility: "public",
      analysisWindowDays: 0,
    });

    assert(errors.some(error => error.includes("defaultBranch")));
    assert(errors.some(error => error.includes("analysisWindowDays")));
  });
});

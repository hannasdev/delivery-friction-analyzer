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
        analysisPullRequestLimit: 30,
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
        analysisPullRequestLimit: 30,
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

  it("allows the product repository only when an explicit override is supplied", () => {
    const result = normalizeTargetRepository(
      {
        owner: "hannasdev",
        name: "delivery-friction-analyzer",
        defaultBranch: "main",
        visibility: "public",
        analysisPullRequestLimit: 30,
      },
      {
        productRepository: {
          owner: "hannasdev",
          name: "delivery-friction-analyzer",
        },
        allowProductRepository: true,
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.targetRepository.fullName, "hannasdev/delivery-friction-analyzer");
    assert.equal(result.targetRepository.isValidationTarget, false);
  });

  it("rejects product repository matches case-insensitively", () => {
    const errors = validateTargetRepository(
      {
        owner: "HannasDev",
        name: "Delivery-Friction-Analyzer",
        defaultBranch: "main",
        visibility: "public",
        analysisPullRequestLimit: 30,
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
          analysisPullRequestLimit: 30,
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

  it("rejects malformed pull request limits and branch names", () => {
    const errors = validateTargetRepository({
      owner: "hannasdev",
      name: "mcp-writing",
      defaultBranch: "main with spaces",
      visibility: "public",
      analysisPullRequestLimit: 0,
    });

    assert(errors.some(error => error.includes("defaultBranch")));
    assert(errors.some(error => error.includes("analysisPullRequestLimit")));
  });

  it("rejects non-boolean validation target flags", () => {
    const result = normalizeTargetRepository({
      owner: "hannasdev",
      name: "mcp-writing",
      defaultBranch: "main",
      visibility: "public",
      analysisPullRequestLimit: 30,
      isValidationTarget: "false",
    });

    assert.equal(result.ok, false);
    assert(result.errors.some(error => error.includes("isValidationTarget must be a boolean")));
  });
});

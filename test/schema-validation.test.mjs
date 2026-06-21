import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { computePullRequestMetrics } from "../src/metrics/friction.js";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";
import { conventionalCommitPrClassRules } from "../src/profile/pr-class-presets.js";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

function matchesType(value, expected) {
  if (Array.isArray(expected)) {
    return expected.some(type => matchesType(value, type));
  }
  if (expected === "null") return value === null;
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  return typeof value === expected && !Array.isArray(value) && value !== null;
}

function validateSchema(value, schema, schemas, path = "$") {
  if (!schema) {
    return [`${path} has no schema`];
  }

  if (schema.$ref) {
    const referencedSchema = schemas[schema.$ref];
    if (!referencedSchema) {
      return [`${path} references unknown schema ${schema.$ref}`];
    }
    return validateSchema(value, referencedSchema, schemas, path);
  }

  const errors = [];
  if (schema.allOf) {
    for (const childSchema of schema.allOf) {
      errors.push(...validateSchema(value, childSchema, schemas, path));
    }
  }
  if (schema.anyOf) {
    const childErrors = schema.anyOf.map(childSchema => validateSchema(value, childSchema, schemas, path));
    if (childErrors.every(result => result.length > 0)) {
      errors.push(`${path} must match at least one allowed schema`);
    }
  }
  if (schema.not && validateSchema(value, schema.not, schemas, path).length === 0) {
    errors.push(`${path} must not match disallowed schema`);
  }
  if (schema.if) {
    const conditionMatches = validateSchema(value, schema.if, schemas, path).length === 0;
    if (conditionMatches && schema.then) {
      errors.push(...validateSchema(value, schema.then, schemas, path));
    }
    if (!conditionMatches && schema.else) {
      errors.push(...validateSchema(value, schema.else, schemas, path));
    }
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
  }
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}`);
    return errors;
  }
  if ((schema.type === "integer" || schema.type === "number" || Array.isArray(schema.type)) && typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
  }
  if (typeof value === "string" && schema.pattern) {
    const pattern = new RegExp(schema.pattern);
    if (!pattern.test(value)) {
      errors.push(`${path} must match ${schema.pattern}`);
    }
  }
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${path} must have length >= ${schema.minLength}`);
  }
  const shouldValidateObjectShape = (schema.type === "object" || schema.required || schema.properties || schema.additionalProperties)
    && value
    && typeof value === "object"
    && !Array.isArray(value);
  if (shouldValidateObjectShape) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      errors.push(`${path} must have at least ${schema.minProperties} propert${schema.minProperties === 1 ? "y" : "ies"}`);
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = schema.properties?.[key];
      if (childSchema) {
        errors.push(...validateSchema(childValue, childSchema, schemas, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`);
      } else if (typeof schema.additionalProperties === "object") {
        errors.push(...validateSchema(childValue, schema.additionalProperties, schemas, `${path}.${key}`));
      }
    }
  }
  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(...validateSchema(item, schema.items, schemas, `${path}[${index}]`));
    });
  }
  return errors;
}

describe("repository profile schema", () => {
  it("validates profiles with omitted or configured PR class, workflow, and contributor source rules", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const baseProfile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
    };
    const classedProfile = {
      ...baseProfile,
      prClasses: [
        {
          id: "release-title",
          class: "release",
          match: { titleRegex: "^Release\\b" },
        },
      ],
    };
    const workflowProfile = {
      ...baseProfile,
      workflow: {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "main_plus_release_branches",
      },
    };
    const contributorProfile = {
      ...baseProfile,
      contributors: {
        sourceType: "all_contributors",
        path: ".all-contributorsrc",
      },
    };

    assert.deepEqual(validateSchema(baseProfile, schema, {}), []);
    assert.deepEqual(validateSchema(classedProfile, schema, {}), []);
    assert.deepEqual(validateSchema(workflowProfile, schema, {}), []);
    assert.deepEqual(validateSchema(contributorProfile, schema, {}), []);
  });

  it("validates the generated Conventional Commit PR class preset", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const profile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
      prClasses: conventionalCommitPrClassRules(),
    };

    assert.deepEqual(validateSchema(profile, schema, {}), []);
  });

  it("rejects malformed PR class rule fields", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const profile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
      prClasses: [
        {
          id: "",
          class: "Release PR",
          match: {},
          unsupported: true,
        },
      ],
    };

    const errors = validateSchema(profile, schema, {});

    assert(errors.some(error => error.includes("$.prClasses[0].id must have length >= 1")));
    assert(errors.some(error => error.includes("$.prClasses[0].class must match")));
    assert(errors.some(error => error.includes("$.prClasses[0].match must have at least 1 property")));
    assert(errors.some(error => error.includes("$.prClasses[0].unsupported is not allowed")));
  });

  it("rejects malformed file-role rule fields", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const profile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [
        {
          id: "",
          match: { prefix: "", observedFrom: "github" },
          category: "source",
          role: "application",
          functionalSurface: "Runtime Surface",
          generated: "false",
          unsupported: true,
        },
      ],
    };

    const errors = validateSchema(profile, schema, {});

    assert(errors.some(error => error.includes("$.rules[0].id must have length >= 1")));
    assert(errors.some(error => error.includes("$.rules[0].match.prefix must have length >= 1")));
    assert(errors.some(error => error.includes("$.rules[0].match.observedFrom is not allowed")));
    assert(errors.some(error => error.includes("$.rules[0].category must be one of")));
    assert(errors.some(error => error.includes("$.rules[0].role must be one of")));
    assert(errors.some(error => error.includes("$.rules[0].functionalSurface must match")));
    assert(errors.some(error => error.includes("$.rules[0].generated must be boolean")));
    assert(errors.some(error => error.includes("$.rules[0].unsupported is not allowed")));
  });

  it("rejects malformed workflow context fields", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const emptyErrors = validateSchema({
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
      workflow: {},
    }, schema, {});
    const profile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
      workflow: {
        primaryMergeMethod: "squash merges",
        releaseStrategy: "release-pull-requests",
        branchStrategy: "main",
        observedFrom: "github",
      },
    };

    const errors = validateSchema(profile, schema, {});

    assert(emptyErrors.some(error => error.includes("$.workflow must have at least 1 property")));
    assert(errors.some(error => error.includes("$.workflow.primaryMergeMethod must be one of")));
    assert(errors.some(error => error.includes("$.workflow.releaseStrategy must be one of")));
    assert(errors.some(error => error.includes("$.workflow.branchStrategy must be one of")));
    assert(errors.some(error => error.includes("$.workflow.observedFrom is not allowed")));
  });

  it("rejects unsupported contributor source profile fields", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const profile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
      contributors: {
        sourceType: "markdown",
        path: "../CONTRIBUTORS.md",
        observedFrom: "github",
      },
    };

    const errors = validateSchema(profile, schema, {});

    assert(errors.some(error => error.includes("$.contributors.sourceType must be one of")));
    assert(errors.some(error => error.includes("$.contributors.path must not match disallowed schema")));
    assert(errors.some(error => error.includes("$.contributors.observedFrom is not allowed")));
  });

  it("aligns contributor source path schema with runtime repository-relative rules", async () => {
    const schema = await readJson("../schemas/repository-profile.schema.json");
    const validProfile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "repo" },
      rules: [],
      contributors: {
        sourceType: "all_contributors",
        path: "docs/contributors..fixture.json",
      },
    };

    assert.deepEqual(validateSchema(validProfile, schema, {}), []);

    for (const path of [
      "../CONTRIBUTORS.md",
      "docs/../CONTRIBUTORS.md",
      "/CONTRIBUTORS.md",
      "docs\\CONTRIBUTORS.md",
      " docs/CONTRIBUTORS.md",
      "docs/CONTRIBUTORS.md ",
      "   ",
    ]) {
      const errors = validateSchema({
        ...validProfile,
        contributors: {
          sourceType: "all_contributors",
          path,
        },
      }, schema, {});

      assert(errors.some(error => error.includes("$.contributors.path")), `expected schema to reject ${path}`);
    }
  });

  it("keeps existing fixture profiles valid without workflow context", async () => {
    const [schema, fixtureProfile] = await Promise.all([
      readJson("../schemas/repository-profile.schema.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
    ]);

    assert.deepEqual(validateSchema(fixtureProfile, schema, {}), []);
  });

  it("keeps the delivery-friction-analyzer self-profile schema-valid", async () => {
    const [schema, selfProfile] = await Promise.all([
      readJson("../schemas/repository-profile.schema.json"),
      readJson("../profiles/delivery-friction-analyzer.json"),
    ]);

    assert.deepEqual(validateSchema(selfProfile, schema, {}), []);
  });
});

describe("normalized entity schema", () => {
  it("validates normalized fixture output against the schema", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert.deepEqual(errors, []);
  });

  it("rejects normalized pull requests missing nested required fields", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    delete normalized.pullRequests[0].commits;

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert(errors.some(error => error.includes("$.pullRequests[0].commits is required")));
  });

  it("rejects normalized pull requests missing PR class evidence", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    delete normalized.pullRequests[0].prClass;

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert(errors.some(error => error.includes("$.pullRequests[0].prClass is required")));
  });

  it("enforces referenced schema maximum and pattern constraints", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    normalized.targetRepository.owner = "bad owner";
    normalized.targetRepository.analysisPullRequestLimit = 101;

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert(errors.some(error => error.includes("$.targetRepository.owner must match")));
    assert(errors.some(error => error.includes("$.targetRepository.analysisPullRequestLimit must be <= 100")));
  });

  it("accepts schema-valid PR-open diff counts used for diff growth", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    normalized.pullRequests[0].prOpenDiff = {
      source: "direct",
      confidence: "high",
      additions: 1,
      deletions: 0,
      changedFiles: 1,
    };

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });
    const metrics = computePullRequestMetrics(normalized.pullRequests[0]);

    assert.deepEqual(errors, []);
    assert.equal(metrics.coverage.prOpenDiff.status, "computed");
    assert.equal(metrics.components.diffGrowthRatio.value, 2);
    assert.equal(metrics.components.diffGrowthRatio.inputs.changedFileGrowthRatio, 1);
  });

  it("rejects unavailable PR-open diff counts", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    normalized.pullRequests[0].prOpenDiff = {
      source: "unavailable",
      confidence: "unavailable",
      additions: 1,
      deletions: 0,
      changedFiles: 1,
    };

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert(errors.some(error => error.includes("$.pullRequests[0].prOpenDiff must not match disallowed schema")));
  });

  it("rejects partial PR-open diff counts", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    normalized.pullRequests[0].prOpenDiff = {
      source: "direct",
      confidence: "high",
      additions: 1,
    };

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert(errors.some(error => error.includes("$.pullRequests[0].prOpenDiff.deletions is required")));
    assert(errors.some(error => error.includes("$.pullRequests[0].prOpenDiff.changedFiles is required")));
  });

  it("reports unresolved schema references without throwing", async () => {
    assert.deepEqual(
      validateSchema({}, { $ref: "missing.schema.json" }, {}),
      ["$ references unknown schema missing.schema.json"],
    );

    assert.deepEqual(validateSchema({}, undefined, {}), ["$ has no schema"]);
  });
});

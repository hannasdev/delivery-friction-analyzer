import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";

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
  if (schema.$ref) {
    return validateSchema(value, schemas[schema.$ref], schemas, path);
  }

  const errors = [];
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
  if (schema.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
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

  it("enforces referenced schema maximum and pattern constraints", async () => {
    const [bundle, profile, normalizedSchema, targetSchema] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../schemas/normalized-entities.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    normalized.targetRepository.owner = "bad owner";
    normalized.targetRepository.analysisWindowDays = 366;

    const errors = validateSchema(normalized, normalizedSchema, {
      "target-repository.schema.json": targetSchema,
    });

    assert(errors.some(error => error.includes("$.targetRepository.owner must match")));
    assert(errors.some(error => error.includes("$.targetRepository.analysisWindowDays must be <= 365")));
  });
});

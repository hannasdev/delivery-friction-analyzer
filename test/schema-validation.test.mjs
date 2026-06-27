import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { computePullRequestMetrics } from "../src/metrics/friction.js";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";
import { conventionalCommitPrClassRules } from "../src/profile/pr-class-presets.js";
import { assertSchemaValid, validateSchema } from "./support/schema-validation.mjs";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

function sourceBundleSchemas(sourceBundleSchema, targetSchema) {
  return {
    schema: sourceBundleSchema,
    refs: { "target-repository.schema.json": targetSchema },
  };
}

function countWorkflowConclusions(runs) {
  return runs.reduce((counts, run) => {
    if (run.conclusion) {
      counts[run.conclusion] = (counts[run.conclusion] ?? 0) + 1;
    }
    return counts;
  }, {});
}

async function readTextFilesUnder(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const fileTexts = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      fileTexts.push(...await readTextFilesUnder(new URL(`${entry.name}/`, directoryUrl)));
    } else if (entry.isFile()) {
      fileTexts.push(await readFile(new URL(entry.name, directoryUrl), "utf8"));
    }
  }

  return fileTexts;
}

const GRAPHQL_REVIEW_THREADS_SOURCE = "graphql:repository.pullRequest.reviewThreads";
const HISTORICAL_SNAPSHOT_SOURCE = "historical_snapshot";
const LANGUAGES_SOURCE = "rest:/repos/{owner}/{repo}/languages";
const REPOSITORY_SOURCE = "rest:/repos/{owner}/{repo}";
const CONTENTS_SOURCE = "rest:/repos/{owner}/{repo}/contents/{path}";
const WORKFLOW_RUNS_SOURCE = "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request";

function coverageEntry(family, source, status) {
  return {
    family,
    source,
    status,
    attempts: 1,
    diagnostics: [],
    downstreamImpact: null,
  };
}

function validSourcePullRequest() {
  return {
    number: 7,
    title: "feat: collect live source",
    author: { login: "maintainer", type: "User", id: "upstream-user-id" },
    url: "https://github.com/example/example-repo/pull/7",
    state: "MERGED",
    createdAt: "2026-06-01T10:00:00Z",
    mergedAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:01:00Z",
    baseRefName: "main",
    headRefName: "feat/live-source",
    headRefOid: "abc123",
    additions: 10,
    deletions: 2,
    changedFiles: 2,
    prOpenDiff: {
      source: "unavailable",
      confidence: "unavailable",
      reason: "Historical PR-open diff data is not available from the live collector.",
    },
    commits: [{
      oid: "abc123",
      authoredDate: "2026-06-01T09:55:00Z",
      committedDate: "2026-06-01T09:56:00Z",
      messageHeadline: "feat: collect live source",
    }],
    files: [{ path: "src/collect/github-source-bundle.js", additions: 8, deletions: 1, changeType: "ADDED" }],
    reviews: [{
      id: "review-1",
      author: { login: "reviewer", type: "User" },
      submittedAt: "2026-06-01T10:30:00Z",
      state: "COMMENTED",
      commitOid: "abc123",
      generatedCommentCount: 1,
      failedAttempt: false,
    }],
    reviewThreads: {
      source: GRAPHQL_REVIEW_THREADS_SOURCE,
      totalCount: 1,
      nodes: [{
        id: "thread-1",
        isResolved: true,
        isOutdated: false,
        path: "src/collect/github-source-bundle.js",
        line: 42,
        comments: [{
          databaseId: 1001,
          author: { login: "reviewer", type: "User" },
          path: "src/collect/github-source-bundle.js",
          line: 42,
          originalLine: 42,
          createdAt: "2026-06-01T10:31:00Z",
          updatedAt: "2026-06-01T10:31:00Z",
          url: "https://github.com/example/example-repo/pull/7#discussion_r1001",
        }],
      }],
    },
    statusCheckRollup: [{
      __typename: "CheckRun",
      name: "Test",
      context: null,
      workflowName: "CI",
      status: "COMPLETED",
      conclusion: "SUCCESS",
      startedAt: "2026-06-01T10:05:00Z",
      completedAt: "2026-06-01T10:07:00Z",
    }],
    workflowRuns: {
      source: WORKFLOW_RUNS_SOURCE,
      totalCount: 1,
      conclusions: { success: 1 },
      runs: [{
        id: 501,
        name: "CI",
        workflowName: "CI",
        headSha: "abc123",
        headBranch: "feat/live-source",
        event: "pull_request",
        status: "completed",
        conclusion: "success",
        createdAt: "2026-06-01T10:01:00Z",
        updatedAt: "2026-06-01T10:07:00Z",
        runStartedAt: "2026-06-01T10:05:00Z",
        htmlUrl: "https://github.com/example/example-repo/actions/runs/501",
      }],
    },
    coverage: {
      prOpenDiff: coverageEntry("pr_open_diff", HISTORICAL_SNAPSHOT_SOURCE, "unavailable"),
      reviewThreads: coverageEntry("review_threads", GRAPHQL_REVIEW_THREADS_SOURCE, "available"),
      workflowRuns: coverageEntry("workflow_runs", WORKFLOW_RUNS_SOURCE, "available"),
    },
  };
}

function validSourceBundle() {
  return {
    schemaVersion: "source-bundle.v1",
    collectedAt: "2026-06-09T00:00:00Z",
    source: {
      kind: "github",
      label: "GitHub live collection",
    },
    collector: { name: "github-live-collector", provider: "mock-gh" },
    targetRepository: { owner: "example", name: "example-repo", defaultBranch: "main", visibility: "public", analysisPullRequestLimit: 1, isValidationTarget: false },
    repositoryMetadata: {
      id: 42,
      name: "example-repo",
      owner: "example",
      fullName: "example/example-repo",
      defaultBranch: "main",
      visibility: "public",
      isPrivate: false,
      htmlUrl: "https://github.com/example/example-repo",
    },
    selection: {
      strategy: "latest_merged_pull_requests",
      requestedLimit: 1,
      collectedCount: 1,
      source: "gh pr list --state merged --search \"is:merged sort:merged-desc\"",
    },
    coverage: {
      status: "partial",
      sourceFamilies: [
        coverageEntry("repository_metadata", REPOSITORY_SOURCE, "available"),
        coverageEntry("pull_request_details", "gh pr view --json", "available"),
        coverageEntry("pr_open_diff", HISTORICAL_SNAPSHOT_SOURCE, "unavailable"),
        coverageEntry("contributor_source", CONTENTS_SOURCE, "partial"),
      ],
    },
    languageDistribution: {
      source: LANGUAGES_SOURCE,
      bytesByLanguage: { JavaScript: 1200 },
      coverage: coverageEntry("languages", LANGUAGES_SOURCE, "available"),
    },
    contributorSource: {
      sourceType: "all_contributors",
      path: ".all-contributorsrc",
      coverage: coverageEntry("contributor_source", CONTENTS_SOURCE, "partial"),
      hintCount: 2,
    },
    pullRequests: [validSourcePullRequest()],
  };
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

  it("keeps the tutorial sample profile schema-valid with educational notes", async () => {
    const [schema, sampleProfile] = await Promise.all([
      readJson("../schemas/repository-profile.schema.json"),
      readJson("../examples/tutorial/profile.json"),
    ]);

    assert.deepEqual(validateSchema(sampleProfile, schema, {}), []);
    assert(sampleProfile.rules.some(rule => typeof rule.notes === "string" && rule.notes.includes("surface")));
    assert(sampleProfile.prClasses.some(rule => typeof rule.notes === "string" && rule.notes.includes("Conventional Commit")));
  });
});

describe("source bundle schema", () => {
  it("validates the canonical source bundle contract with sanitized contributor-source metadata", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();

    assertSchemaValid({
      artifact: "source-bundle.json",
      schemaPath: "schemas/source-bundle.schema.json",
      value: bundle,
      schema,
      refs,
    });
  });

  it("validates sample source provenance with generic source-family labels", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    bundle.source = {
      kind: "sample",
      label: "Bundled synthetic sample, not live GitHub data",
    };
    bundle.collector = { name: "tutorial-sample-collector", provider: "bundled-sample" };
    bundle.selection = {
      strategy: "bundled_tutorial_pull_requests",
      requestedLimit: 1,
      collectedCount: 1,
      source: "bundled tutorial sample",
    };
    bundle.coverage.sourceFamilies[0].source = "bundled tutorial sample";
    bundle.languageDistribution.source = "bundled tutorial sample";
    bundle.languageDistribution.coverage.source = "bundled tutorial sample";

    assert.deepEqual(validateSchema(bundle, schema, refs), []);
  });

  it("validates the tutorial sample source bundle contract", async () => {
    const [sourceBundleSchema, targetSchema, bundle] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
      readJson("../examples/tutorial/source-bundle.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);

    assertSchemaValid({
      artifact: "examples/tutorial/source-bundle.json",
      schemaPath: "schemas/source-bundle.schema.json",
      value: bundle,
      schema,
      refs,
    });
    assert.equal(bundle.source.kind, "sample");
    assert.equal(bundle.source.label, "Bundled synthetic sample, not live GitHub data");
    assert.equal(bundle.coverage.status, "partial");
    assert(bundle.coverage.sourceFamilies.some(family => family.status === "partial"));

    for (const pullRequest of bundle.pullRequests) {
      if (Array.isArray(pullRequest.reviewThreads?.nodes)) {
        assert.equal(
          pullRequest.reviewThreads.totalCount,
          pullRequest.reviewThreads.nodes.length,
          `PR #${pullRequest.number} reviewThreads.totalCount should match listed rows`,
        );
      }

      if (
        Array.isArray(pullRequest.workflowRuns?.runs)
        && pullRequest.workflowRuns.totalCount !== null
      ) {
        assert.equal(
          pullRequest.workflowRuns.totalCount,
          pullRequest.workflowRuns.runs.length,
          `PR #${pullRequest.number} workflowRuns.totalCount should match listed rows`,
        );
        assert.deepEqual(
          pullRequest.workflowRuns.conclusions,
          countWorkflowConclusions(pullRequest.workflowRuns.runs),
          `PR #${pullRequest.number} workflowRuns.conclusions should match listed rows`,
        );
      }
    }
  });

  it("keeps tutorial sample data public-safe and package-eligible", async () => {
    const tutorialDir = new URL("../examples/tutorial/", import.meta.url);
    const [fileTexts, packageJson] = await Promise.all([
      readTextFilesUnder(tutorialDir),
      readJson("../package.json"),
    ]);
    const combined = fileTexts.join("\n");

    assert(packageJson.files.includes("examples/tutorial"));
    assert(!combined.includes("hannasdev"));
    assert(!combined.includes("mcp-writing"));
    assert(!combined.includes("github.com"));
    assert(!combined.includes("github-actions"));
    assert(!combined.includes("ghp_"));
    assert(!combined.includes("sk-"));
    assert(!combined.includes("/Users/"));
    assert(!combined.includes("raw comment"));
    assert.match(combined, /https:\/\/example\.com\/pull\/10[1-4]/);
  });

  it("rejects legacy github-source-bundle.v1 artifacts instead of silently accepting them", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    bundle.schemaVersion = "github-source-bundle.v1";
    bundle.coverage.apiFamilies = bundle.coverage.sourceFamilies;
    delete bundle.coverage.sourceFamilies;
    delete bundle.source;

    const errors = validateSchema(bundle, schema, refs);

    assert(errors.some(error => error.includes('$.schemaVersion must equal "source-bundle.v1"')));
    assert(errors.some(error => error.includes("$.source is required")));
    assert(errors.some(error => error.includes("$.coverage.sourceFamilies is required")));
    assert(errors.some(error => error.includes("$.coverage.apiFamilies is not allowed")));
  });

  it("rejects missing required collector, selection, coverage, and PR fields", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    delete bundle.collector;
    delete bundle.selection.requestedLimit;
    delete bundle.coverage.sourceFamilies;
    delete bundle.pullRequests[0].reviews;

    const errors = validateSchema(bundle, schema, refs);

    assert(errors.some(error => error.includes("$.collector is required")));
    assert(errors.some(error => error.includes("$.selection.requestedLimit is required")));
    assert(errors.some(error => error.includes("$.coverage.sourceFamilies is required")));
    assert(errors.some(error => error.includes("$.pullRequests[0].reviews is required")));
  });

  it("rejects unexpected canonical wrapper fields unless they are under raw", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    bundle.unmappedGitHubPayload = { arbitrary: true };

    const errors = validateSchema(bundle, schema, refs);

    assert(errors.some(error => error.includes("$.unmappedGitHubPayload is not allowed")));

    delete bundle.unmappedGitHubPayload;
    bundle.raw = { futureProviderPayload: { arbitrary: true } };
    assert.deepEqual(validateSchema(bundle, schema, refs), []);
  });

  it("preserves unavailable or partial coverage without invented counts", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    bundle.pullRequests[0].workflowRuns = {
      source: "unavailable",
      totalCount: null,
      conclusions: {},
      runs: [],
    };
    bundle.pullRequests[0].coverage.workflowRuns.status = "unavailable";
    bundle.pullRequests[0].prOpenDiff = {
      source: "unavailable",
      confidence: "unavailable",
      reason: "Historical PR-open diff data is not available from the live collector.",
    };

    assert.deepEqual(validateSchema(bundle, schema, refs), []);

    bundle.pullRequests[0].prOpenDiff.additions = 0;
    const errors = validateSchema(bundle, schema, refs);
    assert(errors.some(error => error.includes("$.pullRequests[0].prOpenDiff must not match disallowed schema")));
  });

  it("keeps contributor-source metadata sanitized", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    bundle.contributorSource.hints = { logins: ["maintainer"] };
    bundle.contributorSource.rawContents = "{\"contributors\":[]}";

    const errors = validateSchema(bundle, schema, refs);

    assert(errors.some(error => error.includes("$.contributorSource.hints is not allowed")));
    assert(errors.some(error => error.includes("$.contributorSource.rawContents is not allowed")));

    delete bundle.contributorSource.hints;
    delete bundle.contributorSource.rawContents;
    assert.deepEqual(validateSchema(bundle, schema, refs), []);
  });

  it("reports source-bundle schema failures with artifact, path, and fix direction", async () => {
    const [sourceBundleSchema, targetSchema] = await Promise.all([
      readJson("../schemas/source-bundle.schema.json"),
      readJson("../schemas/target-repository.schema.json"),
    ]);
    const { schema, refs } = sourceBundleSchemas(sourceBundleSchema, targetSchema);
    const bundle = validSourceBundle();
    delete bundle.selection.requestedLimit;

    assert.throws(
      () => assertSchemaValid({
        artifact: "source-bundle.json",
        schemaPath: "schemas/source-bundle.schema.json",
        value: bundle,
        schema,
        refs,
      }),
      error => (
        error.message.includes("source-bundle.json")
        && error.message.includes("schemas/source-bundle.schema.json")
        && error.message.includes("$.selection.requestedLimit")
        && error.message.includes("Fix the collector output or intentionally update the schema contract")
      ),
    );
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

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ANALYZE_GITHUB_ARTIFACTS,
  parseAnalyzeGithubArgs,
  runAnalyzeGithub,
} from "../src/cli/analyze-github.js";

function repositoryMetadata() {
  return {
    id: 42,
    name: "example-repo",
    full_name: "example/example-repo",
    owner: { login: "example" },
    default_branch: "main",
    private: false,
    html_url: "https://github.com/example/example-repo",
  };
}

function pullRequestDetails(overrides = {}) {
  return {
    number: 7,
    title: "feat: live analyze",
    author: { login: "maintainer", type: "User" },
    url: "https://github.com/example/example-repo/pull/7",
    state: "MERGED",
    createdAt: "2026-06-01T10:00:00Z",
    mergedAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:01:00Z",
    baseRefName: "main",
    headRefName: "feat/live-analyze",
    headRefOid: "abc123",
    additions: 20,
    deletions: 5,
    changedFiles: 2,
    commits: [
      {
        oid: "abc123",
        authoredDate: "2026-06-01T09:55:00Z",
        committedDate: "2026-06-01T09:56:00Z",
        messageHeadline: "feat: live analyze",
      },
    ],
    files: [
      { path: "src/live.js", additions: 15, deletions: 2, changeType: "MODIFIED" },
      { path: "test/live.test.mjs", additions: 5, deletions: 3, changeType: "ADDED" },
    ],
    reviews: [
      {
        id: "review-1",
        author: { login: "copilot-pull-request-reviewer", type: "Bot" },
        submittedAt: "2026-06-01T10:30:00Z",
        state: "COMMENTED",
        commitOid: "abc123",
        generatedCommentCount: 1,
      },
    ],
    statusCheckRollup: [
      {
        __typename: "CheckRun",
        name: "Test",
        workflowName: "CI",
        status: "COMPLETED",
        conclusion: "SUCCESS",
        startedAt: "2026-06-01T10:05:00Z",
        completedAt: "2026-06-01T10:07:00Z",
      },
    ],
    ...overrides,
  };
}

function reviewThreads() {
  return {
    totalCount: 1,
    nodes: [
      {
        id: "thread-1",
        isResolved: true,
        isOutdated: false,
        path: "src/live.js",
        line: 12,
        comments: {
          nodes: [
            {
              databaseId: 1001,
              author: { login: "copilot-pull-request-reviewer", type: "Bot" },
              path: "src/live.js",
              line: 12,
              originalLine: 12,
              createdAt: "2026-06-01T10:31:00Z",
              updatedAt: "2026-06-01T10:31:00Z",
              url: "https://github.com/example/example-repo/pull/7#discussion_r1001",
            },
          ],
        },
      },
    ],
  };
}

function workflowRuns() {
  return {
    total_count: 1,
    workflow_runs: [
      {
        id: 501,
        name: "CI",
        workflow_name: "CI",
        head_sha: "abc123",
        head_branch: "feat/live-analyze",
        event: "pull_request",
        status: "completed",
        conclusion: "success",
      },
    ],
  };
}

function createProvider(overrides = {}) {
  const calls = [];
  return {
    kind: "mock-gh",
    calls,
    async getRepository(input) {
      calls.push(["getRepository", input]);
      return repositoryMetadata();
    },
    async getLanguages(input) {
      calls.push(["getLanguages", input]);
      return { JavaScript: 1200 };
    },
    async listMergedPullRequests(input) {
      calls.push(["listMergedPullRequests", input]);
      return [{ number: 7, mergedAt: "2026-06-01T12:00:00Z" }];
    },
    async getPullRequest(input) {
      calls.push(["getPullRequest", input]);
      return pullRequestDetails();
    },
    async getReviewThreads(input) {
      calls.push(["getReviewThreads", input]);
      return reviewThreads();
    },
    async getWorkflowRuns(input) {
      calls.push(["getWorkflowRuns", input]);
      return workflowRuns();
    },
    ...overrides,
  };
}

async function withTempDirectory(fn) {
  const directory = await mkdtemp(join(tmpdir(), "analyze-github-cli-"));
  try {
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeProfile(directory) {
  const profilePath = join(directory, "profile.json");
  await writeFile(profilePath, JSON.stringify({
    schemaVersion: "repository-profile.v1",
    repository: { owner: "example", name: "example-repo" },
    rules: [
      {
        id: "runtime",
        match: { prefix: "src/" },
        category: "code",
        role: "core_product_code",
        functionalSurface: "runtime",
      },
      {
        id: "tests",
        match: { prefix: "test/" },
        category: "tests",
        role: "tests",
        functionalSurface: "test_suite",
      },
    ],
  }), "utf8");
  return profilePath;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("GitHub live analyze CLI", () => {
  it("parses supported command line options", () => {
    assert.deepEqual(parseAnalyzeGithubArgs([
      "--repo",
      "example/example-repo",
      "--limit",
      "30",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
      "--metadata-only",
      "--validation-target",
    ]), {
      repository: "example/example-repo",
      limit: 30,
      profilePath: "profile.json",
      outDir: "reports/live",
      dryRun: true,
      isValidationTarget: true,
    });
  });

  it("runs live collection through reports and writes expected artifacts", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "out");
      const provider = createProvider();

      const result = await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
        isValidationTarget: true,
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
      });

      assert.equal(result.dryRun, false);
      assert.equal(result.selection.collectedCount, 1);
      assert.equal(result.targetRepository.isValidationTarget, true);
      assert.deepEqual((await readdir(outDir)).sort(), Object.values(ANALYZE_GITHUB_ARTIFACTS).sort());

      const [sourceBundle, normalized, metricsSummary, reportJson, reportMarkdown] = await Promise.all([
        readJson(join(outDir, "source-bundle.json")),
        readJson(join(outDir, "normalized.json")),
        readJson(join(outDir, "metrics-summary.json")),
        readJson(join(outDir, "friction-report.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
      ]);

      assert.equal(sourceBundle.schemaVersion, "github-source-bundle.v1");
      assert.equal(normalized.schemaVersion, "normalized-fixture.v1");
      assert.equal(metricsSummary.metricVersion, "friction-metrics.v1");
      assert.equal(reportJson.reportVersion, "friction-report.v1");
      assert.equal(reportJson.collectionCoverage.status, "partial");
      assert(reportMarkdown.includes("# Repository Friction Report: example/example-repo"));
      assert(reportMarkdown.includes("## Collection Coverage"));
      assert(reportMarkdown.includes("pr_open_diff: unavailable"));
    });
  });

  it("dry-runs GitHub coverage without writing report artifacts", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "dry-run-out");
      const provider = createProvider();

      const result = await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 30,
        profilePath,
        outDir,
        dryRun: true,
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
      });

      assert.equal(result.dryRun, true);
      assert.equal(result.requestedLimit, 30);
      assert.equal(result.sampledLimit, 1);
      assert.equal(result.selection.requestedLimit, 1);
      assert.equal(result.selection.collectedCount, 1);
      assert.equal(result.artifactPaths, null);
      assert.deepEqual(await readdir(outDir), []);
      assert(provider.calls.some(([method]) => method === "getWorkflowRuns"));
    });
  });

  it("surfaces degraded GitHub coverage in report artifacts", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "degraded-out");
      const provider = createProvider({
        async getWorkflowRuns(input) {
          this.calls.push(["getWorkflowRuns", input]);
          throw new Error("HTTP 403: actions access denied for this token");
        },
      });

      await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
      });

      const [reportJson, reportMarkdown] = await Promise.all([
        readJson(join(outDir, "friction-report.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
      ]);

      const workflowCoverage = reportJson.collectionCoverage.apiFamilies.find(entry => entry.family === "workflow_runs");
      assert.equal(workflowCoverage.status, "unavailable");
      assert(workflowCoverage.diagnostics.some(diagnostic => diagnostic.includes("403")));
      assert(reportMarkdown.includes("workflow_runs: unavailable"));
      assert(reportMarkdown.includes("actions access denied"));
    });
  });

  it("fails fast on malformed repository input before provider calls", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "not-a-repo",
          limit: 1,
          profilePath,
          outDir: join(directory, "out"),
        }, { provider }),
        /repo must use owner\/name/,
      );
      assert.deepEqual(provider.calls, []);
    });
  });

  it("fails fast when output path is a file before provider calls", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outPath = join(directory, "out-file");
      await writeFile(outPath, "not a directory\n", "utf8");
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir: outPath,
        }, { provider }),
        /out must be a directory path/,
      );
      assert.deepEqual(provider.calls, []);
    });
  });

  it("does not leave partial report artifacts when a final artifact path is blocked", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "blocked-artifact-out");
      await mkdir(join(outDir, ANALYZE_GITHUB_ARTIFACTS.sourceBundle), { recursive: true });
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir,
        }, {
          provider,
          now: () => "2026-06-09T00:00:00Z",
        }),
        /artifact path must be a writable file path/,
      );

      assert.deepEqual(provider.calls, []);
      assert.deepEqual(await readdir(outDir), [ANALYZE_GITHUB_ARTIFACTS.sourceBundle]);
    });
  });

  it("fails before provider calls when an existing artifact file is not writable", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "readonly-artifact-out");
      await mkdir(outDir, { recursive: true });
      const artifactPath = join(outDir, ANALYZE_GITHUB_ARTIFACTS.sourceBundle);
      await writeFile(artifactPath, "existing artifact\n", "utf8");
      await chmod(artifactPath, 0o444);
      const provider = createProvider();

      try {
        await assert.rejects(
          runAnalyzeGithub({
            repository: "example/example-repo",
            limit: 1,
            profilePath,
            outDir,
          }, {
            provider,
            now: () => "2026-06-09T00:00:00Z",
          }),
          /artifact path must be writable/,
        );
      } finally {
        await chmod(artifactPath, 0o644);
      }

      assert.deepEqual(provider.calls, []);
      assert.equal(await readFile(artifactPath, "utf8"), "existing artifact\n");
    });
  });
});

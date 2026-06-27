import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fsPromises, { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, mock } from "node:test";
import { promisify } from "node:util";
import {
  ANALYZE_GITHUB_ARTIFACTS,
  collectInteractiveAnalyzeGithubOptions,
  formatAnalyzeGithubCompletion,
  parseAnalyzeGithubArgs,
  runAnalyzeGithub,
  runAnalyzeGithubCli,
  writeAnalyzeGithubCompletion,
  writeAnalysisArtifacts,
} from "../src/cli/analyze-github.js";

const execFileAsync = promisify(execFile);

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
    async getRepositoryContent(input) {
      calls.push(["getRepositoryContent", input]);
      return {
        encoding: "base64",
        content: Buffer.from(JSON.stringify({
          contributors: [
            { login: "known-reviewer", name: "Known Reviewer" },
          ],
        })).toString("base64"),
      };
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

async function writeWorkflowProfile(directory) {
  const profilePath = join(directory, "profile-with-workflow.json");
  await writeFile(profilePath, JSON.stringify({
    schemaVersion: "repository-profile.v1",
    repository: { owner: "example", name: "example-repo" },
    workflow: {
      primaryMergeMethod: "squash_merge",
      releaseStrategy: "release_prs",
      branchStrategy: "main_plus_release_branches",
    },
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

async function writeContributorProfile(directory) {
  const profilePath = join(directory, "profile-with-contributors.json");
  await writeFile(profilePath, JSON.stringify({
    schemaVersion: "repository-profile.v1",
    repository: { owner: "example", name: "example-repo" },
    contributors: {
      sourceType: "all_contributors",
      path: ".all-contributorsrc",
    },
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

async function writeCanonicalProfile(directory, name, profile) {
  const profilePath = join(directory, name);
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return profilePath;
}

async function writePrClassProfile(directory) {
  const profilePath = join(directory, "profile-with-pr-classes.json");
  await writeFile(profilePath, JSON.stringify({
    schemaVersion: "repository-profile.v1",
    repository: { owner: "example", name: "example-repo" },
    prClasses: [
      {
        id: "release-title",
        class: "release",
        match: { titleIncludes: "Release" },
      },
      {
        id: "development-title",
        class: "development",
        match: { titleIncludes: "feature" },
      },
    ],
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

function createScriptedPromptAdapter(answers, prompts = []) {
  const scriptedAnswers = new Map(Object.entries(answers).map(([id, value]) => [
    id,
    Array.isArray(value) ? [...value] : [value],
  ]));
  return async prompt => {
    prompts.push(prompt);
    const values = scriptedAnswers.get(prompt.id) ?? [""];
    if (values.length > 1) {
      return values.shift();
    }
    return values[0] ?? "";
  };
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
      "--interactive",
    ]), {
      repository: "example/example-repo",
      limit: 30,
      profilePath: "profile.json",
      outDir: "reports/live",
      dryRun: true,
      isValidationTarget: true,
      excludedPrClasses: [],
      csv: true,
      json: false,
      interactive: true,
    });
  });

  it("runs help output when invoked through an npm-style symlinked bin", async () => {
    await withTempDirectory(async directory => {
      const binPath = join(directory, "delivery-friction-analyzer");
      await symlink(join(process.cwd(), "src/cli/analyze-github.js"), binPath);

      const { stdout } = await execFileAsync(process.execPath, [binPath, "--help"]);

      assert.match(stdout, /Usage:\n  delivery-friction-analyzer --repo <owner\/name>/);
      assert.match(stdout, /--dry-run/);
      assert.match(stdout, /--validation-target\s+Mark output metadata as an internal validation run; does not bypass target validation\./);
    });
  });

  it("prints help without loading preset files", async () => {
    let stdout = "";

    await runAnalyzeGithubCli(["--help", "--preset", "missing-preset.json"], {
      stdout: { write: chunk => { stdout += chunk; } },
      stderr: { write() {} },
    });

    assert(stdout.includes("--preset <path>"));
  });

  it("parses --json as a machine-readable completion output opt-in", () => {
    assert.equal(parseAnalyzeGithubArgs([
      "--repo",
      "example/example-repo",
      "--limit",
      "1",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
      "--json",
    ]).json, true);
  });

  it("collects interactive answers and maps them to analyze options", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "interactive-out");
      const prompts = [];

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "2",
          profilePath,
          configureWorkflow: "no",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "no",
          csv: "no",
          json: "yes",
          excludedPrClasses: "release",
        }, prompts),
      });

      assert.deepEqual(options, {
        interactive: true,
        repository: "example/example-repo",
        limit: 2,
        profilePath,
        outDir,
        dryRun: false,
        excludedPrClasses: ["release"],
        csv: false,
        json: true,
      });
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "repository",
        "limit",
        "profilePath",
        "configureWorkflow",
        "addConventionalCommitPrClasses",
        "outDir",
        "dryRun",
        "csv",
        "json",
        "excludedPrClasses",
      ]);
    });
  });

  it("renders workflow enum prompts as labeled choices while storing schema identifiers", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "labeled-workflow-profile.json");
      const outDir = join(directory, "labeled-workflow-out");
      const prompts = [];

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "2",
          profilePath,
          createProfile: "yes",
          primaryMergeMethod: "2",
          releaseStrategy: "Direct tags",
          branchStrategy: "1",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "yes",
          json: "no",
        }, prompts),
      });

      const workflowPrompts = prompts.filter(prompt => [
        "primaryMergeMethod",
        "releaseStrategy",
        "branchStrategy",
      ].includes(prompt.id));
      assert.deepEqual(workflowPrompts.map(prompt => prompt.type), ["select", "select", "select"]);
      assert.deepEqual(workflowPrompts[0].choices.map(choice => choice.label), [
        "Merge commits",
        "Squash merges",
        "Rebase merges",
        "Mixed",
        "Unknown",
      ]);
      assert.deepEqual(workflowPrompts[0].choices.map(choice => choice.value), [
        "merge_commit",
        "squash_merge",
        "rebase_merge",
        "mixed",
        "unknown",
      ]);
      for (const prompt of workflowPrompts) {
        assert(!prompt.choices.some(choice => choice.label === "Other" || choice.value === "other"));
      }
      assert.equal(options.profilePath, profilePath);
      assert.deepEqual((await readJson(profilePath)).workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
    });
  });

  it("re-prompts invalid interactive answers until valid", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "interactive-retry-out");
      const blockedOutPath = join(directory, "blocked-output-path");
      await writeFile(blockedOutPath, "not a directory\n", "utf8");
      const prompts = [];
      let errorOutput = "";

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        output: { write: chunk => { errorOutput += chunk; } },
        promptAdapter: createScriptedPromptAdapter({
          repository: ["not-a-repo", "example/example-repo"],
          limit: ["0", "2"],
          profilePath,
          configureWorkflow: "no",
          addConventionalCommitPrClasses: "no",
          outDir: [blockedOutPath, outDir],
          dryRun: ["maybe", "yes"],
          json: "no",
          excludedPrClasses: ["Release PR", "dependency", "release"],
        }, prompts),
      });

      assert.deepEqual(options, {
        interactive: true,
        repository: "example/example-repo",
        limit: 2,
        profilePath,
        outDir,
        dryRun: true,
        excludedPrClasses: ["release"],
        csv: true,
        json: false,
      });
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "repository",
        "repository",
        "limit",
        "limit",
        "profilePath",
        "configureWorkflow",
        "addConventionalCommitPrClasses",
        "outDir",
        "outDir",
        "dryRun",
        "dryRun",
        "json",
        "excludedPrClasses",
        "excludedPrClasses",
        "excludedPrClasses",
      ]);
      assert.match(errorOutput, /repo must use owner\/name/);
      assert.match(errorOutput, /limit must be an integer between 1 and 100/);
      assert.match(errorOutput, /out must be a directory path, not a file/);
      assert.match(errorOutput, /Answer yes or no/);
      assert.match(errorOutput, /exclude-pr-class must be a lowercase PR class identifier/);
      assert.match(errorOutput, /exclude-pr-class must name configured PR class\(es\): dependency/);
    });
  });

  it("rejects directory-style interactive profile paths before creation", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "profile.json");
      const outDir = join(directory, "directory-style-profile-out");
      const prompts = [];
      let errorOutput = "";

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        output: { write: chunk => { errorOutput += chunk; } },
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath: [`${join(directory, "missing-profile")}/`, profilePath],
          createProfile: "yes",
          primaryMergeMethod: "squash_merge",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "yes",
          json: "no",
        }, prompts),
      });

      assert.equal(options.profilePath, profilePath);
      assert.equal(options.savedProfilePath, profilePath);
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "repository",
        "limit",
        "profilePath",
        "profilePath",
        "createProfile",
        "primaryMergeMethod",
        "releaseStrategy",
        "branchStrategy",
        "addConventionalCommitPrClasses",
        "outDir",
        "dryRun",
        "json",
      ]);
      assert.match(errorOutput, /profile path must be a JSON file path/);
    });
  });

  it("rejects broken symlink interactive profile paths before creation", async () => {
    await withTempDirectory(async directory => {
      const brokenProfilePath = join(directory, "broken-profile.json");
      const profilePath = join(directory, "profile.json");
      const outDir = join(directory, "broken-symlink-profile-out");
      const prompts = [];
      let errorOutput = "";
      await symlink(join(directory, "missing-target.json"), brokenProfilePath);

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        output: { write: chunk => { errorOutput += chunk; } },
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath: [brokenProfilePath, profilePath],
          createProfile: "yes",
          primaryMergeMethod: "squash_merge",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "yes",
          json: "no",
        }, prompts),
      });

      assert.equal(options.profilePath, profilePath);
      assert.equal(options.savedProfilePath, profilePath);
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "repository",
        "limit",
        "profilePath",
        "profilePath",
        "createProfile",
        "primaryMergeMethod",
        "releaseStrategy",
        "branchStrategy",
        "addConventionalCommitPrClasses",
        "outDir",
        "dryRun",
        "json",
      ]);
      assert.match(errorOutput, /profile could not be read/);
    });
  });

  it("creates an interactive workflow profile with a release title rule", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "generated-profile.json");
      const outDir = join(directory, "generated-profile-out");
      const prompts = [];

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath,
          createProfile: "yes",
          primaryMergeMethod: "squash_merge",
          releaseStrategy: "release_prs",
          branchStrategy: "main_plus_release_branches",
          releasePrTitleIncludes: "Release",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "yes",
          json: "no",
          excludedPrClasses: "",
        }, prompts),
      });

      assert.equal(options.profilePath, profilePath);
      assert.equal(options.savedProfilePath, profilePath);
      assert.equal(options.dryRun, true);
      assert.deepEqual(options.excludedPrClasses, []);
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "repository",
        "limit",
        "profilePath",
        "createProfile",
        "primaryMergeMethod",
        "releaseStrategy",
        "branchStrategy",
        "releasePrTitleIncludes",
        "addConventionalCommitPrClasses",
        "outDir",
        "dryRun",
        "json",
        "excludedPrClasses",
      ]);

      const profile = await readJson(profilePath);
      assert.deepEqual(profile.repository, { owner: "example", name: "example-repo" });
      assert.deepEqual(profile.workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "main_plus_release_branches",
      });
      assert.deepEqual(profile.prClasses, [
        {
          id: "release-title",
          class: "release",
          match: { titleIncludes: "Release" },
          notes: "Generated by interactive setup from the configured release PR title convention.",
        },
      ]);
      assert.deepEqual(profile.rules, []);
    });
  });

  it("writes a generated copy when a missing profile appears before creation", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "new-stale-profile.json");
      const generatedPath = join(directory, "new-stale-profile.generated.json");
      const concurrentProfile = {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        rules: [],
      };
      let concurrentWriteDone = false;

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir: join(directory, "new-stale-profile-out"),
        dryRun: true,
        csv: false,
        json: false,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: async prompt => {
          if (prompt.id === "branchStrategy" && !concurrentWriteDone) {
            concurrentWriteDone = true;
            await writeCanonicalProfile(directory, "new-stale-profile.json", concurrentProfile);
          }
          return {
            createProfile: "yes",
            primaryMergeMethod: "squash_merge",
            releaseStrategy: "direct_tags",
            branchStrategy: "trunk_based",
          }[prompt.id] ?? "";
        },
      });

      assert.equal(options.profilePath, generatedPath);
      assert.equal(options.savedProfilePath, generatedPath);
      assert.deepEqual(await readJson(profilePath), concurrentProfile);
      assert.deepEqual((await readJson(generatedPath)).workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
    });
  });

  it("writes a generated copy when a missing profile becomes a directory before creation", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "directory-profile.json");
      const generatedPath = join(directory, "directory-profile.generated.json");
      let concurrentDirectoryDone = false;

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir: join(directory, "directory-profile-out"),
        dryRun: true,
        csv: false,
        json: false,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: async prompt => {
          if (prompt.id === "branchStrategy" && !concurrentDirectoryDone) {
            concurrentDirectoryDone = true;
            await mkdir(profilePath);
          }
          return {
            createProfile: "yes",
            primaryMergeMethod: "squash_merge",
            releaseStrategy: "direct_tags",
            branchStrategy: "trunk_based",
          }[prompt.id] ?? "";
        },
      });

      assert.equal(options.profilePath, generatedPath);
      assert.equal(options.savedProfilePath, generatedPath);
      assert.equal((await lstat(profilePath)).isDirectory(), true);
      assert.deepEqual((await readJson(generatedPath)).workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
    });
  });

  it("writes a generated profile copy instead of rewriting non-canonical profile formatting", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "profile-with-pr-classes.json");
      await writeFile(profilePath, JSON.stringify({
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        prClasses: [
          {
            id: "release-regex",
            class: "release",
            match: { titleRegex: "^Release v\\d+" },
            notes: "Curated regex release rule.",
          },
          {
            id: "release-title",
            class: "release",
            match: { titleIncludes: "Ship" },
          },
        ],
        rules: [],
      }), "utf8");
      const originalProfileText = await readFile(profilePath, "utf8");
      const existingGeneratedPath = join(directory, "profile-with-pr-classes.generated.json");
      const generatedPath = join(directory, "profile-with-pr-classes.generated-2.json");
      await writeFile(existingGeneratedPath, "existing generated profile\n", "utf8");
      const outDir = join(directory, "generated-copy-out");

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath,
          configureWorkflow: "yes",
          primaryMergeMethod: "rebase_merge",
          releaseStrategy: "release_prs",
          branchStrategy: "mixed",
          releasePrTitleIncludes: "Release",
          addReleasePrClass: "yes",
          outDir,
          dryRun: "yes",
          json: "no",
          excludedPrClasses: "",
        }),
      });

      assert.equal(options.profilePath, generatedPath);
      assert.equal(options.savedProfilePath, generatedPath);
      assert.equal(await readFile(profilePath, "utf8"), originalProfileText);
      assert.equal(await readFile(existingGeneratedPath, "utf8"), "existing generated profile\n");

      const profile = await readJson(generatedPath);
      assert.deepEqual(profile.workflow, {
        primaryMergeMethod: "rebase_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "mixed",
      });
      assert.deepEqual(profile.prClasses[0], {
        id: "release-regex",
        class: "release",
        match: { titleRegex: "^Release v\\d+" },
        notes: "Curated regex release rule.",
      });
      assert.equal(profile.prClasses[1].match.titleIncludes, "Ship");
      assert.equal(profile.prClasses[2].id, "release-title-2");
      assert.deepEqual(profile.prClasses[2].match, { titleIncludes: "Release" });
    });
  });

  it("updates an explicitly provided canonical profile JSON with confirmed workflow fields", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeCanonicalProfile(directory, "canonical-profile.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        rules: [],
      });
      const outDir = join(directory, "canonical-profile-out");
      const prompts = [];

      const result = await runAnalyzeGithubCli([
        "--interactive",
        "--repo",
        "example/example-repo",
        "--limit",
        "1",
        "--profile",
        profilePath,
        "--out",
        outDir,
        "--dry-run",
        "--no-csv",
        "--json",
      ], {
        provider: createProvider(),
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          configureWorkflow: "yes",
          primaryMergeMethod: "merge_commit",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
          addConventionalCommitPrClasses: "no",
        }, prompts),
        stdout: { write() {} },
        stderr: { write() {} },
      });

      assert.equal(result.savedProfilePath, profilePath);
      assert.deepEqual((await readJson(profilePath)).workflow, {
        primaryMergeMethod: "merge_commit",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "configureWorkflow",
        "primaryMergeMethod",
        "releaseStrategy",
        "branchStrategy",
        "addConventionalCommitPrClasses",
        "saveRunPreset",
      ]);
    });
  });

  it("retries canonical profile rewrites when Windows refuses destination overwrite", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeCanonicalProfile(directory, "windows-profile.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        rules: [],
      });
      const outDir = join(directory, "windows-profile-out");
      const originalRename = fsPromises.rename.bind(fsPromises);
      let profileRenameAttempts = 0;
      const renameMock = mock.method(fsPromises, "rename", async (oldPath, newPath) => {
        if (newPath === profilePath) {
          profileRenameAttempts += 1;
          if (profileRenameAttempts === 1) {
            throw Object.assign(new Error("destination exists"), { code: "EPERM" });
          }
        }
        return originalRename(oldPath, newPath);
      });
      syncBuiltinESMExports();

      try {
        const result = await runAnalyzeGithubCli([
          "--interactive",
          "--repo",
          "example/example-repo",
          "--limit",
          "1",
          "--profile",
          profilePath,
          "--out",
          outDir,
          "--dry-run",
          "--no-csv",
          "--json",
        ], {
          provider: createProvider(),
          isInteractiveTerminal: true,
          promptAdapter: createScriptedPromptAdapter({
            configureWorkflow: "yes",
            primaryMergeMethod: "merge_commit",
            releaseStrategy: "direct_tags",
            branchStrategy: "trunk_based",
          }),
          stdout: { write() {} },
          stderr: { write() {} },
        });

        assert.equal(result.savedProfilePath, profilePath);
        assert.equal(profileRenameAttempts, 2);
        assert.deepEqual((await readJson(profilePath)).workflow, {
          primaryMergeMethod: "merge_commit",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
        });
      } finally {
        renameMock.mock.restore();
        syncBuiltinESMExports();
      }
    });
  });

  it("writes a generated copy when a canonical profile changes before rewrite", async () => {
    await withTempDirectory(async directory => {
      const originalProfile = {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        rules: [],
      };
      const staleProfile = {
        ...originalProfile,
        rules: [
          {
            id: "runtime",
            match: { prefix: "src/" },
            category: "code",
            role: "core_product_code",
            functionalSurface: "runtime",
          },
        ],
      };
      const profilePath = await writeCanonicalProfile(directory, "stale-profile.json", originalProfile);
      const generatedPath = join(directory, "stale-profile.generated.json");
      let staleWriteDone = false;

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir: join(directory, "stale-profile-out"),
        dryRun: true,
        csv: false,
        json: false,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: async prompt => {
          if (prompt.id === "branchStrategy" && !staleWriteDone) {
            staleWriteDone = true;
            await writeCanonicalProfile(directory, "stale-profile.json", staleProfile);
          }
          return {
            configureWorkflow: "yes",
            primaryMergeMethod: "merge_commit",
            releaseStrategy: "direct_tags",
            branchStrategy: "trunk_based",
          }[prompt.id] ?? "";
        },
      });

      assert.equal(options.profilePath, generatedPath);
      assert.equal(options.savedProfilePath, generatedPath);
      assert.deepEqual(await readJson(profilePath), staleProfile);
      assert.deepEqual((await readJson(generatedPath)).workflow, {
        primaryMergeMethod: "merge_commit",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
    });
  });

  it("writes a generated profile copy for symlinked canonical profiles", async () => {
    await withTempDirectory(async directory => {
      const targetPath = await writeCanonicalProfile(directory, "target-profile.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        rules: [],
      });
      const profilePath = join(directory, "linked-profile.json");
      const generatedPath = join(directory, "linked-profile.generated.json");
      await symlink(targetPath, profilePath);

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir: join(directory, "symlink-profile-out"),
        dryRun: true,
        csv: false,
        json: false,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          configureWorkflow: "yes",
          primaryMergeMethod: "squash_merge",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
        }),
      });

      assert.equal(options.profilePath, generatedPath);
      assert.equal(options.savedProfilePath, generatedPath);
      assert.equal((await lstat(profilePath)).isSymbolicLink(), true);
      assert.equal((await readJson(targetPath)).workflow, undefined);
      assert.deepEqual((await readJson(generatedPath)).workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
    });
  });

  it("respects explicitly provided interactive boolean options", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "explicit-boolean-out");
      const prompts = [];

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        repository: "example/example-repo",
        limit: 2,
        profilePath,
        outDir,
        dryRun: false,
        csv: true,
        json: false,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          configureWorkflow: "no",
          addConventionalCommitPrClasses: "no",
        }, prompts),
      });

      assert.deepEqual(options, {
        interactive: true,
        repository: "example/example-repo",
        limit: 2,
        profilePath,
        outDir,
        dryRun: false,
        excludedPrClasses: [],
        csv: true,
        json: false,
      });
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "configureWorkflow",
        "addConventionalCommitPrClasses",
      ]);
    });
  });

  it("rejects malformed interactive profile PR class rules with a validation error", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "malformed-pr-classes.json");
      await writeFile(profilePath, JSON.stringify({
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        prClasses: {},
        rules: [],
      }), "utf8");

      await assert.rejects(
        collectInteractiveAnalyzeGithubOptions({
          interactive: true,
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir: join(directory, "interactive-invalid-profile-out"),
          dryRun: true,
          excludedPrClasses: [],
          csv: false,
          json: true,
        }, {
          isInteractiveTerminal: true,
          promptAdapter: createScriptedPromptAdapter({}),
        }),
        /Invalid repository profile at .*malformed-pr-classes\.json: invalid repository profile: prClasses must be an array when provided.*Fix the named field or rule.*interactive setup with --interactive --dry-run/s,
      );
    });
  });

  it("rejects malformed interactive workflow context with a validation error", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "malformed-workflow.json");
      await writeFile(profilePath, JSON.stringify({
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        workflow: {},
        rules: [],
      }), "utf8");

      await assert.rejects(
        collectInteractiveAnalyzeGithubOptions({
          interactive: true,
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir: join(directory, "interactive-invalid-workflow-out"),
          dryRun: true,
          excludedPrClasses: [],
          csv: false,
          json: true,
        }, {
          isInteractiveTerminal: true,
          promptAdapter: createScriptedPromptAdapter({}),
        }),
        /Invalid repository profile at .*malformed-workflow\.json: invalid repository profile: workflow must include at least one field when provided.*Fix the named field or rule.*interactive setup with --interactive --dry-run/s,
      );
    });
  });

  it("does not prompt or wait when required options are missing without --interactive", async () => {
    const provider = createProvider();
    let prompted = false;

    await assert.rejects(
      runAnalyzeGithubCli([], {
        provider,
        promptAdapter: async () => {
          prompted = true;
          return "";
        },
        isInteractiveTerminal: true,
      }),
      /Missing required option\(s\): --repo, --limit, --profile, --out/,
    );

    assert.equal(prompted, false);
    assert.deepEqual(provider.calls, []);
  });

  it("rejects --interactive in non-TTY contexts before provider calls", async () => {
    const provider = createProvider();

    await assert.rejects(
      runAnalyzeGithubCli(["--interactive"], {
        provider,
        isInteractiveTerminal: false,
        promptAdapter: createScriptedPromptAdapter({}),
      }),
      /interactive mode requires a terminal/,
    );

    assert.deepEqual(provider.calls, []);
  });

  it("parses --no-csv as a CSV export opt-out", () => {
    assert.equal(parseAnalyzeGithubArgs([
      "--repo",
      "example/example-repo",
      "--limit",
      "1",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
      "--no-csv",
    ]).csv, false);
  });

  it("parses inverse boolean flags with deterministic last-one-wins conflicts", () => {
    const disabled = parseAnalyzeGithubArgs([
      "--repo",
      "example/example-repo",
      "--limit",
      "1",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
      "--dry-run",
      "--no-dry-run",
      "--validation-target",
      "--no-validation-target",
      "--no-csv",
      "--csv",
      "--json",
      "--no-json",
    ]);

    assert.equal(disabled.dryRun, false);
    assert.equal(disabled.isValidationTarget, false);
    assert.equal(disabled.csv, true);
    assert.equal(disabled.json, false);

    const enabled = parseAnalyzeGithubArgs([
      "--repo",
      "example/example-repo",
      "--limit",
      "1",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
      "--no-dry-run",
      "--metadata-only",
      "--no-validation-target",
      "--validation-target",
      "--csv",
      "--no-csv",
      "--no-json",
      "--json",
    ]);

    assert.equal(enabled.dryRun, true);
    assert.equal(enabled.isValidationTarget, true);
    assert.equal(enabled.csv, false);
    assert.equal(enabled.json, true);
  });

  it("parses repeated and comma-separated PR class exclusions", () => {
    assert.deepEqual(parseAnalyzeGithubArgs([
      "--repo",
      "example/example-repo",
      "--limit",
      "10",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
      "--exclude-pr-class",
      "release,dependency",
      "--exclude-pr-class",
      "release",
    ]).excludedPrClasses, ["release", "dependency"]);
  });

  it("parses run preset load and save paths", () => {
    const parsed = parseAnalyzeGithubArgs([
      "--preset",
      "presets/local-run.json",
      "--save-preset",
      "presets/updated-run.json",
      "--repo",
      "example/example-repo",
      "--limit",
      "1",
      "--profile",
      "profile.json",
      "--out",
      "reports/live",
    ]);

    assert.equal(parsed.presetPath, "presets/local-run.json");
    assert.equal(parsed.savePresetPath, "presets/updated-run.json");
  });

  it("saves an interactive run preset with only reusable run settings", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "interactive-preset-out");
      const presetPath = join(directory, "presets", "example-run.json");
      const prompts = [];
      let stdout = "";

      const result = await runAnalyzeGithubCli([
        "--interactive",
        "--repo",
        "example/example-repo",
        "--limit",
        "2",
        "--profile",
        profilePath,
        "--out",
        outDir,
        "--dry-run",
        "--no-csv",
      ], {
        provider: createProvider(),
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          configureWorkflow: "no",
          addConventionalCommitPrClasses: "no",
          json: "no",
          saveRunPreset: "yes",
          runPresetPath: presetPath,
        }, prompts),
        stdout: { write: chunk => { stdout += chunk; } },
        stderr: { write() {} },
      });

      assert.equal(result.savedRunPresetPath, presetPath);
      assert.match(stdout, new RegExp(`Run preset saved: ${presetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`));
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "configureWorkflow",
        "addConventionalCommitPrClasses",
        "json",
        "saveRunPreset",
        "runPresetPath",
      ]);
      assert.deepEqual(await readJson(presetPath), {
        schemaVersion: "analyze-github-run-preset.v1",
        run: {
          repository: "example/example-repo",
          limit: 2,
          profilePath,
          outDir,
          dryRun: true,
          isValidationTarget: false,
          csv: false,
          json: false,
          excludedPrClasses: [],
        },
      });
    });
  });

  it("rejects symlinked run preset save paths without modifying the target", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const targetPath = join(directory, "target.json");
      const presetPath = join(directory, "symlink-preset.json");
      const originalTarget = "{\"doNot\":\"overwrite\"}\n";
      const provider = createProvider();
      await writeFile(targetPath, originalTarget, "utf8");
      await symlink(targetPath, presetPath);

      await assert.rejects(
        runAnalyzeGithubCli([
          "--repo",
          "example/example-repo",
          "--limit",
          "1",
          "--profile",
          profilePath,
          "--out",
          join(directory, "out"),
          "--save-preset",
          presetPath,
        ], {
          provider,
          stdout: { write() {} },
          stderr: { write() {} },
        }),
        /preset path must be a JSON file path, not a directory or special file/,
      );

      assert.equal(await readFile(targetPath, "utf8"), originalTarget);
      assert((await lstat(presetPath)).isSymbolicLink());
      assert.deepEqual(provider.calls, []);
    });
  });

  it("loads saved run presets and lets explicit CLI flags override preset values", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const presetOutDir = join(directory, "preset-out");
      const presetPath = join(directory, "run-preset.json");
      await writeFile(presetPath, `${JSON.stringify({
        schemaVersion: "analyze-github-run-preset.v1",
        run: {
          repository: "example/example-repo",
          limit: 2,
          profilePath,
          outDir: presetOutDir,
          dryRun: true,
          isValidationTarget: false,
          csv: true,
          json: false,
          excludedPrClasses: [],
        },
      }, null, 2)}\n`, "utf8");
      let stdout = "";

      const result = await runAnalyzeGithubCli([
        "--preset",
        presetPath,
        "--limit",
        "1",
        "--no-csv",
        "--save-preset",
        presetPath,
      ], {
        provider: createProvider(),
        stdout: { write: chunk => { stdout += chunk; } },
        stderr: { write() {} },
      });

      assert.equal(result.requestedLimit, 1);
      assert.equal(result.sampledLimit, 1);
      assert.equal(result.csvArtifactsEnabled, false);
      assert.equal(result.outputDirectory, presetOutDir);
      assert.equal(result.savedRunPresetPath, presetPath);
      assert.match(stdout, /Dry run complete for example\/example-repo\./);
      assert.match(stdout, /Run preset saved: .*run-preset\.json\./);
      assert.deepEqual((await readJson(presetPath)).run, {
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir: presetOutDir,
        dryRun: true,
        isValidationTarget: false,
        csv: false,
        json: false,
        excludedPrClasses: [],
      });
    });
  });

  it("lets explicit inverse boolean CLI flags override true or false preset values", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const presetOutDir = join(directory, "preset-boolean-out");
      const presetPath = join(directory, "boolean-run-preset.json");
      await writeFile(presetPath, `${JSON.stringify({
        schemaVersion: "analyze-github-run-preset.v1",
        run: {
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir: presetOutDir,
          dryRun: true,
          isValidationTarget: true,
          csv: false,
          json: true,
          excludedPrClasses: [],
        },
      }, null, 2)}\n`, "utf8");
      let stdout = "";

      const result = await runAnalyzeGithubCli([
        "--preset",
        presetPath,
        "--no-dry-run",
        "--no-validation-target",
        "--csv",
        "--no-json",
      ], {
        provider: createProvider(),
        stdout: { write: chunk => { stdout += chunk; } },
        stderr: { write() {} },
      });

      assert.equal(result.dryRun, false);
      assert.equal(result.targetRepository.isValidationTarget, false);
      assert.equal(result.csvArtifactsEnabled, true);
      assert.equal(result.outputDirectory, presetOutDir);
      assert.match(stdout, /Analysis complete for example\/example-repo\./);
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
    });
  });

  it("rejects wrong-type preset JSON values before CLI-style normalization", async () => {
    await withTempDirectory(async directory => {
      const malformedPresets = [
        {
          name: "boolean-limit.json",
          run: { limit: true },
          message: /preset run\.limit must be a number/,
        },
        {
          name: "array-limit.json",
          run: { limit: [1] },
          message: /preset run\.limit must be a number/,
        },
        {
          name: "numeric-excluded-class.json",
          run: { excludedPrClasses: [1] },
          message: /preset run\.excludedPrClasses must contain only strings/,
        },
      ];

      for (const malformedPreset of malformedPresets) {
        const presetPath = join(directory, malformedPreset.name);
        await writeFile(presetPath, `${JSON.stringify({
          schemaVersion: "analyze-github-run-preset.v1",
          run: {
            repository: "example/example-repo",
            limit: 1,
            profilePath: "profile.json",
            outDir: "reports/live",
            dryRun: true,
            isValidationTarget: false,
            csv: true,
            json: false,
            excludedPrClasses: [],
            ...malformedPreset.run,
          },
        }, null, 2)}\n`, "utf8");
        const provider = createProvider();

        await assert.rejects(
          runAnalyzeGithubCli(["--preset", presetPath], {
            provider,
            stdout: { write() {} },
            stderr: { write() {} },
          }),
          malformedPreset.message,
        );
        assert.deepEqual(provider.calls, []);
      }
    });
  });

  it("rejects malformed PR class exclusion identifiers with matching guidance", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir: join(directory, "out"),
          excludedPrClasses: ["Release PR"],
        }, { provider }),
        /exclude-pr-class must be a lowercase PR class identifier using letters, digits, "-" or "_" separators: Release PR/,
      );
      assert.deepEqual(provider.calls, []);
    });
  });

  it("runs live collection through reports and writes expected artifacts", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "out");
      const provider = createProvider();
      const progressMessages = [];

      const result = await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
        isValidationTarget: true,
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
        onProgress: message => progressMessages.push(message),
      });

      assert.equal(result.dryRun, false);
      assert.equal(result.selection.collectedCount, 1);
      assert.equal(result.targetRepository.isValidationTarget, true);
      assert.deepEqual((await readdir(outDir)).sort(), Object.values(ANALYZE_GITHUB_ARTIFACTS).sort());

      const [
        sourceBundle,
        normalized,
        metricsSummary,
        reportJson,
        reportMarkdown,
        methodology,
        prMetricsCsv,
        bottleneckExamplesCsv,
        commentSourcesCsv,
        collectionCoverageCsv,
      ] = await Promise.all([
        readJson(join(outDir, "source-bundle.json")),
        readJson(join(outDir, "normalized.json")),
        readJson(join(outDir, "metrics-summary.json")),
        readJson(join(outDir, "friction-report.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
        readFile(join(outDir, "methodology.md"), "utf8"),
        readFile(join(outDir, "pr-metrics.csv"), "utf8"),
        readFile(join(outDir, "bottleneck-examples.csv"), "utf8"),
        readFile(join(outDir, "comment-sources.csv"), "utf8"),
        readFile(join(outDir, "collection-coverage.csv"), "utf8"),
      ]);

      assert.equal(sourceBundle.schemaVersion, "source-bundle.v1");
      assert.equal(normalized.schemaVersion, "normalized-fixture.v1");
      assert.equal(metricsSummary.metricVersion, "friction-metrics.v1");
      assert.equal(reportJson.reportVersion, "friction-report.v1");
      assert.deepEqual(sourceBundle.source, {
        kind: "github",
        label: "GitHub live collection",
      });
      assert.deepEqual(reportJson.source, sourceBundle.source);
      assert.equal(reportJson.configuredWorkflow, undefined);
      assert.equal(reportJson.collectionCoverage.status, "partial");
      assert.equal(result.csvArtifactsEnabled, true);
      assert.equal(result.artifactPaths.methodology, join(outDir, "methodology.md"));
      assert.equal(result.artifactPaths.prMetricsCsv, join(outDir, "pr-metrics.csv"));
      assert.deepEqual(progressMessages, [
        "Validating profile and output directory.",
        "Collecting latest 1 merged pull request(s) from example/example-repo.",
        "Normalizing source bundle and computing metrics.",
        "Writing local artifacts.",
      ]);
      assert(reportMarkdown.includes("# Repository Friction Report: example/example-repo"));
      assert(reportMarkdown.includes("Source: GitHub live collection (github)"));
      assert(reportMarkdown.includes("`methodology.md`"));
      assert(reportMarkdown.includes("## Collection Coverage"));
      assert(reportMarkdown.includes("Source: GitHub live collection (github)"));
      assert(reportMarkdown.includes("pr_open_diff: unavailable"));
      assert(!reportMarkdown.includes("## Configured Workflow Context"));
      assert(methodology.includes("# Methodology: example/example-repo"));
      assert(methodology.includes("Source: GitHub live collection (github)"));
      assert(methodology.includes("- PR metrics CSV: `pr-metrics.csv`"));
      assert(!methodology.includes("## Configured Workflow Context"));
      assert(prMetricsCsv.includes("pr_number,title,url,pr_class,pr_classification_source,pr_class_rule_id,changed_lines"));
      assert(prMetricsCsv.includes("7,feat: live analyze,https://github.com/example/example-repo/pull/7,unknown,fallback_rule,,25"));
      for (const csvArtifact of [prMetricsCsv, bottleneckExamplesCsv, commentSourcesCsv, collectionCoverageCsv]) {
        assert(!csvArtifact.includes("analysis_filter_excluded_pr_classes"));
      }

      const completion = formatAnalyzeGithubCompletion(result);
      assert(completion.startsWith(`Markdown report: ${join(outDir, "friction-report.md")}\n`));
      assert(completion.includes("Analysis complete for example/example-repo."));
      assert(completion.includes(`Methodology: ${join(outDir, "methodology.md")}`));
      assert(completion.includes(`JSON report: ${join(outDir, "friction-report.json")}`));
      assert(completion.includes("CSV evidence:\n"));
      assert(completion.includes(`- PR metrics: ${join(outDir, "pr-metrics.csv")}`));
      assert(completion.includes("Collection coverage: partial."));
      assert(completion.includes("Coverage caveats:\n"));
      assert(completion.includes("pr_open_diff"));
      assert(!completion.includes("- repository_metadata: status=available"));
      assert(completion.includes("Top bottlenecks:"));
    });
  });

  it("surfaces configured workflow context in live report artifacts without changing metrics or CSV", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeWorkflowProfile(directory);
      const outDir = join(directory, "workflow-context-out");

      await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
      }, {
        provider: createProvider(),
        now: () => "2026-06-09T00:00:00Z",
      });

      const [
        normalized,
        metricsSummary,
        reportJson,
        reportMarkdown,
        methodology,
        prMetricsCsv,
      ] = await Promise.all([
        readJson(join(outDir, "normalized.json")),
        readJson(join(outDir, "metrics-summary.json")),
        readJson(join(outDir, "friction-report.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
        readFile(join(outDir, "methodology.md"), "utf8"),
        readFile(join(outDir, "pr-metrics.csv"), "utf8"),
      ]);

      assert.deepEqual(reportJson.configuredWorkflow, {
        source: "repository_profile",
        note: "Configured workflow context comes from the repository profile. It is user-configured context, not observed GitHub evidence, and it does not change scores, rankings, CSV exports, or PR class matching.",
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "main_plus_release_branches",
      });
      assert.equal(metricsSummary.totals.pullRequests, 1);
      assert.equal(metricsSummary.totals.changedLines, 25);
      assert.equal(metricsSummary.configuredWorkflow, undefined);
      assert.equal(normalized.workflow, undefined);
      assert.equal(normalized.pullRequests[0].prClass.class, "unknown");
      assert(reportMarkdown.includes("## Configured Workflow Context"));
      assert(reportMarkdown.includes("| Primary merge method | Squash merge |"));
      assert(reportMarkdown.includes("| Release strategy | Release PRs |"));
      assert(reportMarkdown.includes("| Branch strategy | Main plus release branches |"));
      assert(reportMarkdown.includes("not observed GitHub evidence"));
      assert(methodology.includes("## Configured Workflow Context"));
      assert(methodology.includes("- Primary merge method: Squash merge"));
      assert(methodology.includes("does not change scores, rankings, CSV exports, or PR class matching"));
      assert(prMetricsCsv.startsWith("pr_number,title,url,pr_class,pr_classification_source,pr_class_rule_id,changed_lines"));
      assert(!prMetricsCsv.includes("squash_merge"));
      assert(!prMetricsCsv.includes("release_prs"));
      assert(!prMetricsCsv.includes("main_plus_release_branches"));
    });
  });

  it("uses configured all-contributors hints for comment-source metadata without person-ranking output", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeContributorProfile(directory);
      const outDir = join(directory, "contributor-source-out");
      const provider = createProvider({
        async getReviewThreads(input) {
          this.calls.push(["getReviewThreads", input]);
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
                      author: { login: "known-reviewer" },
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

      const [
        sourceBundle,
        normalized,
        metricsSummary,
        reportJson,
        reportMarkdown,
        methodology,
        prMetricsCsv,
        bottleneckExamplesCsv,
        commentSourcesCsv,
        collectionCoverageCsv,
      ] = await Promise.all([
        readJson(join(outDir, "source-bundle.json")),
        readJson(join(outDir, "normalized.json")),
        readJson(join(outDir, "metrics-summary.json")),
        readJson(join(outDir, "friction-report.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
        readFile(join(outDir, "methodology.md"), "utf8"),
        readFile(join(outDir, "pr-metrics.csv"), "utf8"),
        readFile(join(outDir, "bottleneck-examples.csv"), "utf8"),
        readFile(join(outDir, "comment-sources.csv"), "utf8"),
        readFile(join(outDir, "collection-coverage.csv"), "utf8"),
      ]);

      assert.equal(sourceBundle.contributorSource.hintCount, 1);
      assert.equal(sourceBundle.contributorSource.hints, undefined);
      assert.equal(normalized.contributorSource.hintCount, 1);
      assert.equal(normalized.contributorSource.hints, undefined);
      assert.equal(normalized.pullRequests[0].reviewComments.bySource.human_reviewer, 1);
      assert.equal(normalized.pullRequests[0].reviewComments.bySource.unknown, 0);
      assert.deepEqual(normalized.pullRequests[0].reviewDecision, {
        state: "none",
        humanApproved: false,
        humanChangesRequested: false,
        humanReviewerCount: 0,
        source: "reviews",
      });
      assert.equal(metricsSummary.pullRequests[0].review.comments.bySource.human_reviewer, 1);
      assert.deepEqual(metricsSummary.pullRequests[0].review.decision, normalized.pullRequests[0].reviewDecision);
      assert.equal(metricsSummary.pullRequests[0].components.commentSourceDensity.value, 1);
      assert.equal(reportJson.contributorSource.status, "available");
      assert.equal(reportJson.contributorSource.hintCount, 1);
      assert.equal(reportJson.guardrails.avoidsIndividualRanking, true);
      assert(reportMarkdown.includes("## Contributor Source Context"));
      assert(reportMarkdown.includes("| Coverage status | available |"));
      assert(methodology.includes("## Contributor Source Context"));
      assert(methodology.includes("- Parsed hint count: 1"));
      assert(collectionCoverageCsv.includes("contributor_source,available"));
      assert(commentSourcesCsv.includes("human_reviewer,1"));

      const serializedArtifacts = [
        JSON.stringify(sourceBundle),
        JSON.stringify(normalized),
        JSON.stringify(metricsSummary),
        JSON.stringify(reportJson),
        reportMarkdown,
        methodology,
        prMetricsCsv,
        bottleneckExamplesCsv,
        commentSourcesCsv,
        collectionCoverageCsv,
      ].join("\n");
      assert(!serializedArtifacts.includes("Known Reviewer"));
      assert(!serializedArtifacts.includes("contributors\":["));
      assert(!serializedArtifacts.includes("\"logins\""));
      assert(!JSON.stringify(sourceBundle.contributorSource).includes("known-reviewer"));
      assert(!JSON.stringify(normalized.contributorSource).includes("known-reviewer"));
      assert(serializedArtifacts.includes("individual contributor rankings are not emitted"));
      assert(!commentSourcesCsv.includes("known-reviewer"));
    });
  });

  it("carries zero-thread human approvals through live analysis artifacts", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "approved-out");
      const provider = createProvider({
        async getPullRequest(input) {
          this.calls.push(["getPullRequest", input]);
          return pullRequestDetails({
            reviews: [
              {
                id: "review-human-approval",
                author: { login: "reviewer", type: "User" },
                submittedAt: "2026-06-01T10:30:00Z",
                state: "APPROVED",
                commitOid: "abc123",
              },
            ],
          });
        },
        async getReviewThreads(input) {
          this.calls.push(["getReviewThreads", input]);
          return { totalCount: 0, nodes: [] };
        },
      });

      await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
        isValidationTarget: true,
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
      });

      const [normalized, metricsSummary, reportMarkdown, prMetricsCsv] = await Promise.all([
        readJson(join(outDir, "normalized.json")),
        readJson(join(outDir, "metrics-summary.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
        readFile(join(outDir, "pr-metrics.csv"), "utf8"),
      ]);

      assert.deepEqual(normalized.pullRequests[0].reviewDecision, {
        state: "approved",
        humanApproved: true,
        humanChangesRequested: false,
        humanReviewerCount: 1,
        source: "reviews",
      });
      assert.deepEqual(metricsSummary.pullRequests[0].review.decision, normalized.pullRequests[0].reviewDecision);
      assert.equal(metricsSummary.pullRequests[0].review.threads.totalCount, 0);
      assert(reportMarkdown.includes("\\[observed\\] approved from reviews; human reviewers: 1; approved: yes; changes requested: no; \\[healthy\\] human approval observed"));
      assert(prMetricsCsv.includes(",0,approved,1,true,false,"));
    });
  });

  it("filters excluded PR classes after collection and labels downstream artifacts", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "filtered-out");
      const releasePr = pullRequestDetails({
        number: 7,
        title: "Release 2026.06.14",
        url: "https://github.com/example/example-repo/pull/7",
        additions: 100,
        deletions: 20,
        changedFiles: 2,
      });
      const developmentPr = pullRequestDetails({
        number: 8,
        title: "feature: filtered analysis",
        url: "https://github.com/example/example-repo/pull/8",
        additions: 10,
        deletions: 5,
        changedFiles: 2,
      });
      const prsByNumber = new Map([
        [7, releasePr],
        [8, developmentPr],
      ]);
      const provider = createProvider({
        async listMergedPullRequests(input) {
          this.calls.push(["listMergedPullRequests", input]);
          return [
            { number: 7, mergedAt: "2026-06-02T12:00:00Z" },
            { number: 8, mergedAt: "2026-06-01T12:00:00Z" },
          ];
        },
        async getPullRequest(input) {
          this.calls.push(["getPullRequest", input]);
          return prsByNumber.get(input.number);
        },
      });

      const result = await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 2,
        profilePath,
        outDir,
        excludedPrClasses: ["release"],
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
      });

      const [
        sourceBundle,
        normalized,
        metricsSummary,
        reportJson,
        reportMarkdown,
        methodology,
        prMetricsCsv,
        bottleneckExamplesCsv,
        commentSourcesCsv,
        collectionCoverageCsv,
      ] = await Promise.all([
        readJson(join(outDir, "source-bundle.json")),
        readJson(join(outDir, "normalized.json")),
        readJson(join(outDir, "metrics-summary.json")),
        readJson(join(outDir, "friction-report.json")),
        readFile(join(outDir, "friction-report.md"), "utf8"),
        readFile(join(outDir, "methodology.md"), "utf8"),
        readFile(join(outDir, "pr-metrics.csv"), "utf8"),
        readFile(join(outDir, "bottleneck-examples.csv"), "utf8"),
        readFile(join(outDir, "comment-sources.csv"), "utf8"),
        readFile(join(outDir, "collection-coverage.csv"), "utf8"),
      ]);

      assert.equal(sourceBundle.pullRequests.length, 2);
      assert.deepEqual(sourceBundle.pullRequests.map(pr => pr.number), [7, 8]);
      assert.deepEqual(normalized.analysisFilter, {
        excludedPrClasses: ["release"],
        originalPullRequests: 2,
        filteredPullRequests: 1,
      });
      assert.deepEqual(normalized.pullRequests.map(pr => pr.number), [8]);
      assert.deepEqual(metricsSummary.analysisFilter, normalized.analysisFilter);
      assert.equal(metricsSummary.totals.pullRequests, 1);
      assert.equal(metricsSummary.totals.changedLines, 15);
      assert.deepEqual(metricsSummary.rankings.reviewChurn.map(entry => entry.number), [8]);
      assert.deepEqual(reportJson.analysisFilter, normalized.analysisFilter);
      assert.equal(reportJson.summary.pullRequests, 1);
      assert.equal(
        reportJson.prClasses.note,
        "PR class filtering was explicitly applied before metrics and ranking; this distribution describes the filtered sample.",
      );
      assert(reportMarkdown.includes("Analysis filter: excluded PR class(es): release."));
      assert(reportMarkdown.includes("Filtered sample: 1 of 2 collected pull request(s)."));
      assert(reportMarkdown.includes("PR class filtering was explicitly applied before metrics and ranking; this distribution describes the filtered sample."));
      assert(reportMarkdown.includes("PR class filtering was explicitly applied before metrics and ranking"));
      assert(!reportMarkdown.includes("do not change rankings or exclude PRs"));
      assert(methodology.includes("Analysis filter: Excluded PR class(es): release."));
      assert(methodology.includes("source-bundle.json` preserves the full collected sample"));
      assert(prMetricsCsv.includes("analysis_filter_excluded_pr_classes,analysis_filter_original_pull_requests,analysis_filter_filtered_pull_requests"));
      assert(bottleneckExamplesCsv.includes("analysis_filter_excluded_pr_classes,analysis_filter_original_pull_requests,analysis_filter_filtered_pull_requests"));
      assert(commentSourcesCsv.includes("analysis_filter_excluded_pr_classes,analysis_filter_original_pull_requests,analysis_filter_filtered_pull_requests"));
      assert(collectionCoverageCsv.includes("analysis_filter_excluded_pr_classes,analysis_filter_original_pull_requests,analysis_filter_filtered_pull_requests"));
      assert(prMetricsCsv.includes("release,2,1"));
      assert(bottleneckExamplesCsv.includes("release,2,1"));
      assert(commentSourcesCsv.includes("release,2,1"));
      assert(collectionCoverageCsv.includes("release,2,1"));
      assert(prMetricsCsv.includes("8,feature: filtered analysis"));
      assert(!prMetricsCsv.includes("7,Release 2026.06.14"));
      assert.deepEqual(result.analysisFilter, normalized.analysisFilter);

      const completion = formatAnalyzeGithubCompletion(result);
      assert(completion.includes("Analysis filter: excluded PR class(es): release."));
      assert(completion.includes("Filtered sample: 1 of 2 collected pull request(s)."));
    });
  });

  it("rejects excluded PR classes that are not configured by the profile", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "unconfigured-filter");
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir,
          excludedPrClasses: ["dependency"],
        }, {
          provider,
          now: () => "2026-06-09T00:00:00Z",
        }),
        /exclude-pr-class must name configured PR class\(es\): dependency\. Configured PR class\(es\): development, release\./,
      );
      assert.deepEqual(provider.calls, []);
      assert.deepEqual(await readdir(outDir), []);
    });
  });

  it("reports a clear error when a filtered run collects no pull requests", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "filtered-empty-sample");
      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir,
          excludedPrClasses: ["release"],
        }, {
          provider: createProvider({
            async listMergedPullRequests(input) {
              this.calls.push(["listMergedPullRequests", input]);
              return [];
            },
          }),
          now: () => "2026-06-09T00:00:00Z",
        }),
        /exclude-pr-class cannot filter because no merged pull requests were collected\./,
      );
      assert.deepEqual(await readdir(outDir), []);
    });
  });

  it("fails when PR class filtering removes every collected pull request", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "all-filtered-out");
      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir,
          excludedPrClasses: ["development"],
        }, {
          provider: createProvider({
            async getPullRequest(input) {
              this.calls.push(["getPullRequest", input]);
              return pullRequestDetails({
                title: "feature: all filtered",
              });
            },
          }),
          now: () => "2026-06-09T00:00:00Z",
        }),
        /exclude-pr-class removed all 1 collected pull request/,
      );
      assert.deepEqual(await readdir(outDir), []);
    });
  });

  it("writes parseable JSON completion output only when --json is requested", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "json-out");
      const result = await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
      }, {
        provider: createProvider(),
        now: () => "2026-06-09T00:00:00Z",
      });

      let output = "";
      writeAnalyzeGithubCompletion(result, {
        json: true,
        stdout: { write: chunk => { output += chunk; } },
      });

      const parsed = JSON.parse(output);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.targetRepository.owner, "example");
      assert.equal(parsed.artifactPaths.reportMarkdown, join(outDir, "friction-report.md"));
      assert(!output.includes("Analysis complete"));
      assert(!output.includes("Validating profile"));
    });
  });

  it("keeps --json --interactive stdout machine-readable while prompts and progress use injected channels", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "interactive-json-out");
      let stdout = "";
      let stderr = "";
      const prompts = [];

      await runAnalyzeGithubCli(["--interactive", "--json"], {
        provider: createProvider(),
        now: () => "2026-06-09T00:00:00Z",
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath,
          configureWorkflow: "no",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "yes",
        }, prompts),
        stdout: { write: chunk => { stdout += chunk; } },
        stderr: { write: chunk => { stderr += chunk; } },
      });

      const parsed = JSON.parse(stdout);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.dryRun, true);
      assert.equal(parsed.csvArtifactsEnabled, false);
      assert.equal(parsed.targetRepository.owner, "example");
      assert(!stdout.includes("Target GitHub repository"));
      assert(!stdout.includes("Validating profile"));
      assert(stderr.includes("Validating profile and output directory."));
      assert.deepEqual(prompts.map(prompt => prompt.id), [
        "repository",
        "limit",
        "profilePath",
        "configureWorkflow",
        "addConventionalCommitPrClasses",
        "outDir",
        "dryRun",
        "saveRunPreset",
      ]);
      assert.deepEqual(await readdir(outDir), []);
    });
  });

  it("prints generated profile paths in interactive completion output", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "interactive-generated-profile.json");
      const outDir = join(directory, "interactive-generated-profile-out");
      let stdout = "";

      await runAnalyzeGithubCli(["--interactive"], {
        provider: createProvider(),
        now: () => "2026-06-09T00:00:00Z",
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath,
          createProfile: "yes",
          primaryMergeMethod: "squash_merge",
          releaseStrategy: "release_prs",
          branchStrategy: "main_plus_release_branches",
          releasePrTitleIncludes: "Release",
          outDir,
          dryRun: "yes",
          json: "no",
          excludedPrClasses: "",
        }),
        stdout: { write: chunk => { stdout += chunk; } },
        stderr: { write() {} },
      });

      assert(stdout.includes(`Repository profile saved: ${profilePath}.`));
      assert.deepEqual((await readJson(profilePath)).workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "main_plus_release_branches",
      });
    });
  });

  it("writes opt-in Conventional Commit PR class preset and reports it in completion output", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "interactive-conventional-profile.json");
      const outDir = join(directory, "interactive-conventional-profile-out");
      let stdout = "";

      await runAnalyzeGithubCli(["--interactive"], {
        provider: createProvider(),
        now: () => "2026-06-09T00:00:00Z",
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath,
          createProfile: "yes",
          primaryMergeMethod: "squash_merge",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
          addConventionalCommitPrClasses: "yes",
          outDir,
          dryRun: "yes",
          json: "no",
          excludedPrClasses: "",
        }),
        stdout: { write: chunk => { stdout += chunk; } },
        stderr: { write() {} },
      });

      const profile = await readJson(profilePath);
      assert.deepEqual(profile.prClasses.map(rule => rule.class), [
        "dependency",
        "feature",
        "fix",
        "docs",
        "test",
        "maintenance",
      ]);
      assert(profile.prClasses.every(rule => typeof rule.match.titleRegex === "string"));
      assert(stdout.includes(`Repository profile saved: ${profilePath}.`));
      assert(stdout.includes("PR class rules written: Conventional Commit preset or release title rule."));
    });
  });

  it("preserves existing custom PR class rules unless the preset update is confirmed", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeCanonicalProfile(directory, "custom-pr-classes.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        prClasses: [
          {
            id: "custom-feature",
            class: "custom_feature",
            match: { titleIncludes: "Feature" },
          },
        ],
        rules: [],
      });
      const outDir = join(directory, "custom-pr-classes-out");

      await runAnalyzeGithubCli(["--interactive"], {
        provider: createProvider(),
        now: () => "2026-06-09T00:00:00Z",
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "1",
          profilePath,
          configureWorkflow: "yes",
          primaryMergeMethod: "merge_commit",
          releaseStrategy: "direct_tags",
          branchStrategy: "trunk_based",
          addConventionalCommitPrClasses: "no",
          outDir,
          dryRun: "yes",
          json: "no",
          excludedPrClasses: "",
        }),
        stdout: { write() {} },
        stderr: { write() {} },
      });

      assert.deepEqual((await readJson(profilePath)).prClasses, [
        {
          id: "custom-feature",
          class: "custom_feature",
          match: { titleIncludes: "Feature" },
        },
      ]);
    });
  });

  it("can add the Conventional Commit preset to an existing profile without changing workflow fields", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeCanonicalProfile(directory, "existing-profile-pr-preset.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        workflow: {
          primaryMergeMethod: "unknown",
          releaseStrategy: "unknown",
          branchStrategy: "unknown",
        },
        rules: [],
      });
      const outDir = join(directory, "existing-profile-pr-preset-out");

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
        dryRun: true,
        excludedPrClasses: [],
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          configureWorkflow: "no",
          addConventionalCommitPrClasses: "yes",
          json: "no",
        }),
      });

      const profile = await readJson(profilePath);
      assert.equal(options.savedProfilePath, profilePath);
      assert.equal(options.prClassRulesWritten, true);
      assert.deepEqual(profile.workflow, {
        primaryMergeMethod: "unknown",
        releaseStrategy: "unknown",
        branchStrategy: "unknown",
      });
      assert.deepEqual(profile.prClasses.map(rule => rule.class), [
        "dependency",
        "feature",
        "fix",
        "docs",
        "test",
        "maintenance",
      ]);
    });
  });

  it("prints a saved profile path when later interactive analysis fails", async () => {
    await withTempDirectory(async directory => {
      const profilePath = join(directory, "interactive-failure-profile.json");
      const outDir = join(directory, "interactive-failure-out");
      let stderr = "";

      await assert.rejects(
        runAnalyzeGithubCli(["--interactive"], {
          provider: createProvider({
            async getRepository() {
              throw new Error("mock provider failure");
            },
          }),
          isInteractiveTerminal: true,
          promptAdapter: createScriptedPromptAdapter({
            repository: "example/example-repo",
            limit: "1",
            profilePath,
            createProfile: "yes",
            primaryMergeMethod: "squash_merge",
            releaseStrategy: "direct_tags",
            branchStrategy: "trunk_based",
            outDir,
            dryRun: "no",
            csv: "no",
            json: "no",
          }),
          stdout: { write() {} },
          stderr: { write: chunk => { stderr += chunk; } },
        }),
        /mock provider failure/,
      );

      assert(stderr.includes(`Repository profile saved before failure: ${profilePath}.`));
      assert.deepEqual((await readJson(profilePath)).workflow, {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "direct_tags",
        branchStrategy: "trunk_based",
      });
    });
  });

  it("suppresses CSV exports when --no-csv is requested", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "out");
      const provider = createProvider();

      await writeFile(join(outDir, "pr-metrics.csv"), "stale csv\n").catch(async error => {
        if (error.code !== "ENOENT") throw error;
        await mkdir(outDir, { recursive: true });
        await writeFile(join(outDir, "pr-metrics.csv"), "stale csv\n");
      });

      const result = await runAnalyzeGithub({
        repository: "example/example-repo",
        limit: 1,
        profilePath,
        outDir,
        csv: false,
      }, {
        provider,
        now: () => "2026-06-09T00:00:00Z",
      });

      assert.equal(result.csvArtifactsEnabled, false);
      assert(!("prMetricsCsv" in result.artifactPaths));
      assert(formatAnalyzeGithubCompletion(result).includes("CSV evidence: disabled by --no-csv."));
      assert.deepEqual((await readdir(outDir)).sort(), [
        "friction-report.json",
        "friction-report.md",
        "methodology.md",
        "metrics-summary.json",
        "normalized.json",
        "source-bundle.json",
      ]);
      const methodology = await readFile(join(outDir, "methodology.md"), "utf8");
      assert(methodology.includes("CSV export generation was disabled for this run."));
    });
  });

  it("restores disabled CSV artifacts when artifact promotion rolls back", async () => {
    await withTempDirectory(async directory => {
      const outDir = join(directory, "out");
      await mkdir(outDir, { recursive: true });

      const paths = Object.fromEntries(
        Object.entries(ANALYZE_GITHUB_ARTIFACTS)
          .filter(([key]) => !key.endsWith("Csv"))
          .map(([key, fileName]) => [key, join(outDir, fileName)]),
      );
      const disabledPaths = {
        prMetricsCsv: join(outDir, ANALYZE_GITHUB_ARTIFACTS.prMetricsCsv),
      };
      const brokenPaths = {
        ...paths,
        reportJson: join(outDir, "missing-parent", ANALYZE_GITHUB_ARTIFACTS.reportJson),
      };

      await writeFile(paths.sourceBundle, "old source\n");
      await writeFile(paths.normalized, "old normalized\n");
      await writeFile(disabledPaths.prMetricsCsv, "stale csv\n");

      await assert.rejects(() => writeAnalysisArtifacts(outDir, brokenPaths, {
        sourceBundle: { ok: true },
        normalized: { ok: true },
        metricsSummary: { ok: true },
        reportJson: { ok: true },
        reportMarkdown: "new report\n",
        methodology: "new methodology\n",
        csv: {},
      }), /ENOENT/);

      assert.equal(await readFile(paths.sourceBundle, "utf8"), "old source\n");
      assert.equal(await readFile(paths.normalized, "utf8"), "old normalized\n");
      assert.equal(await readFile(disabledPaths.prMetricsCsv, "utf8"), "stale csv\n");
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

      const workflowCoverage = reportJson.collectionCoverage.sourceFamilies.find(entry => entry.family === "workflow_runs");
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

  it("rejects the configured product repository before provider calls", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "hannasdev/delivery-friction-analyzer",
          limit: 1,
          profilePath,
          outDir: join(directory, "out"),
        }, { provider }),
        /Cannot analyze hannasdev\/delivery-friction-analyzer because it is this tool's product repository.*guard prevents accidental self-analysis during normal live runs.*not a data-security boundary.*Choose a different repository with --repo owner\/name.*No GitHub data was collected/s,
      );
      assert.deepEqual(provider.calls, []);
    });
  });

  it("rejects invalid explicit repository profiles before provider calls", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeCanonicalProfile(directory, "invalid-profile.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "example", name: "example-repo" },
        rules: [
          {
            id: "runtime",
            match: { prefix: "src/" },
            category: "code",
            role: "core_product_code",
          },
          {
            id: "runtime",
            match: { regex: "[" },
            category: "source",
            role: "core_product_code",
          },
        ],
        unsupported: true,
      });
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithub({
          repository: "example/example-repo",
          limit: 1,
          profilePath,
          outDir: join(directory, "out"),
        }, { provider }),
        /Invalid repository profile at .*invalid-profile\.json: invalid repository profile: profile\.unsupported is not supported.*rules rule id "runtime" is duplicated.*rules\[1\] "runtime" match\.regex is not a valid JavaScript regex.*rules\[1\] "runtime" category must be one of.*Fix the named field or rule/s,
      );
      assert.deepEqual(provider.calls, []);
    });
  });

  it("validates preset-sourced repository profiles before provider calls during dry run", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeCanonicalProfile(directory, "preset-invalid-profile.json", {
        schemaVersion: "repository-profile.v1",
        repository: { owner: "bad owner", name: "example-repo" },
        rules: [],
      });
      const presetPath = join(directory, "run-preset.json");
      await writeFile(presetPath, `${JSON.stringify({
        schemaVersion: "analyze-github-run-preset.v1",
        run: {
          repository: "example/example-repo",
          limit: 10,
          profilePath,
          outDir: join(directory, "out"),
          dryRun: true,
          csv: false,
          json: true,
          excludedPrClasses: [],
        },
      })}\n`, "utf8");
      const provider = createProvider();

      await assert.rejects(
        runAnalyzeGithubCli(["--preset", presetPath], {
          provider,
          stdout: { write() {} },
          stderr: { write() {} },
        }),
        /Invalid repository profile at .*preset-invalid-profile\.json: invalid repository profile: repository\.owner must be a GitHub owner\/name segment/s,
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

  it("reports a clear error when the output directory is not writable", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "readonly-out");
      await mkdir(outDir, { recursive: true });
      await chmod(outDir, 0o555);
      const provider = createProvider();

      try {
        await assert.rejects(
          runAnalyzeGithub({
            repository: "example/example-repo",
            limit: 1,
            profilePath,
            outDir,
          }, { provider }),
          /out must be a writable directory path/,
        );
      } finally {
        await chmod(outDir, 0o755);
      }

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

  it("waits for staging writes to settle before cleaning up failed staging output", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writeProfile(directory);
      const outDir = join(directory, "staging-failure-out");
      const provider = createProvider();
      provider.kind = { name: "mock-gh" };
      provider.kind.self = provider.kind;

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
        /circular/i,
      );

      const entries = await readdir(outDir);
      assert.deepEqual(entries.filter(entry => entry.startsWith(".analyze-github-")), []);
    });
  });
});

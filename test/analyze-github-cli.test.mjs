import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
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
    });
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
        csv: true,
        json: false,
      }, {
        isInteractiveTerminal: true,
        promptAdapter: createScriptedPromptAdapter({
          repository: "example/example-repo",
          limit: "2",
          profilePath,
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
        "outDir",
        "dryRun",
        "csv",
        "json",
        "excludedPrClasses",
      ]);
    });
  });

  it("re-prompts invalid interactive answers until valid", async () => {
    await withTempDirectory(async directory => {
      const profilePath = await writePrClassProfile(directory);
      const outDir = join(directory, "interactive-retry-out");
      const prompts = [];
      let errorOutput = "";

      const options = await collectInteractiveAnalyzeGithubOptions({
        interactive: true,
        excludedPrClasses: [],
        csv: true,
        json: false,
      }, {
        isInteractiveTerminal: true,
        output: { write: chunk => { errorOutput += chunk; } },
        promptAdapter: createScriptedPromptAdapter({
          repository: ["not-a-repo", "example/example-repo"],
          limit: ["0", "2"],
          profilePath: [join(directory, "missing-profile.json"), profilePath],
          outDir,
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
        "profilePath",
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
      assert.match(errorOutput, /profile could not be read/);
      assert.match(errorOutput, /Answer yes or no/);
      assert.match(errorOutput, /exclude-pr-class must be a lowercase PR class identifier/);
      assert.match(errorOutput, /exclude-pr-class must name configured PR class\(es\): dependency/);
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
        /profile is invalid: invalid PR class profile rules: prClasses must be an array when provided/,
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

      assert.equal(sourceBundle.schemaVersion, "github-source-bundle.v1");
      assert.equal(normalized.schemaVersion, "normalized-fixture.v1");
      assert.equal(metricsSummary.metricVersion, "friction-metrics.v1");
      assert.equal(reportJson.reportVersion, "friction-report.v1");
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
      assert(reportMarkdown.includes("`methodology.md`"));
      assert(reportMarkdown.includes("## Collection Coverage"));
      assert(reportMarkdown.includes("pr_open_diff: unavailable"));
      assert(methodology.includes("# Methodology: example/example-repo"));
      assert(methodology.includes("- PR metrics CSV: `pr-metrics.csv`"));
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
      assert(reportMarkdown.includes("- Review decision: approved (source: reviews)"));
      assert(reportMarkdown.includes("- Human approved: yes"));
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
        "outDir",
        "dryRun",
      ]);
      assert.deepEqual(await readdir(outDir), []);
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

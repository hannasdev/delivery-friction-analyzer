import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGhCliProvider } from "../src/collect/gh-provider.js";
import { buildCoverageSummary, collectGitHubSourceBundle } from "../src/collect/github-source-bundle.js";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";

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
    title: "feat: collect live source",
    author: { login: "maintainer", type: "User" },
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
    commits: [
      {
        oid: "abc123",
        authoredDate: "2026-06-01T09:55:00Z",
        committedDate: "2026-06-01T09:56:00Z",
        messageHeadline: "feat: collect live source",
      },
    ],
    files: [
      { path: "src/collect/github-source-bundle.js", additions: 8, deletions: 1, changeType: "ADDED" },
      { path: "test/github-collector.test.mjs", additions: 2, deletions: 1, changeType: "ADDED" },
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
        path: "src/collect/github-source-bundle.js",
        line: 42,
        comments: {
          nodes: [
            {
              databaseId: 1001,
              author: { login: "copilot-pull-request-reviewer", type: "Bot" },
              path: "src/collect/github-source-bundle.js",
              line: 42,
              originalLine: 42,
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
    total_count: 2,
    workflow_runs: [
      {
        id: 501,
        name: "CI",
        workflow_name: "CI",
        head_sha: "abc123",
        head_branch: "feat/live-source",
        event: "pull_request",
        status: "completed",
        conclusion: "success",
        created_at: "2026-06-01T10:01:00Z",
        updated_at: "2026-06-01T10:07:00Z",
        run_started_at: "2026-06-01T10:05:00Z",
        html_url: "https://github.com/example/example-repo/actions/runs/501",
      },
      {
        id: 502,
        name: "PR Template Check",
        workflow_name: "PR Template Check",
        head_sha: "abc123",
        head_branch: "feat/live-source",
        event: "pull_request",
        status: "completed",
        conclusion: "failure",
      },
    ],
  };
}

function createProvider(overrides = {}) {
  const calls = [];
  const provider = {
    kind: "mock-gh",
    calls,
    async getRepository(input) {
      calls.push(["getRepository", input]);
      return repositoryMetadata();
    },
    async getLanguages(input) {
      calls.push(["getLanguages", input]);
      return { JavaScript: 1200, Shell: 20 };
    },
    async getRepositoryContent(input) {
      calls.push(["getRepositoryContent", input]);
      return {
        encoding: "base64",
        content: Buffer.from(JSON.stringify({
          contributors: [
            { login: "maintainer", name: "Maintainer" },
            { login: "reviewer" },
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
  return provider;
}

function coverageFor(bundle, family) {
  return bundle.coverage.apiFamilies.find(entry => entry.family === family);
}

describe("GitHub source collector", () => {
  it("summarizes coverage statuses without losing all-unavailable state", () => {
    assert.equal(buildCoverageSummary([
      { status: "available" },
      { status: "available" },
    ]), "available");
    assert.equal(buildCoverageSummary([
      { status: "unavailable" },
      { status: "unavailable" },
    ]), "unavailable");
    assert.equal(buildCoverageSummary([
      { status: "available" },
      { status: "unavailable" },
    ]), "partial");
    assert.equal(buildCoverageSummary([
      { status: "partial" },
      { status: "available" },
    ]), "partial");
    assert.equal(buildCoverageSummary([
      { status: "rate_limited" },
      { status: "unavailable" },
    ]), "rate_limited");
  });

  it("maps gh-backed provider responses into a versioned source bundle", async () => {
    const provider = createProvider();

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.schemaVersion, "github-source-bundle.v1");
    assert.equal(bundle.collector.provider, "mock-gh");
    assert.equal(bundle.targetRepository.owner, "example");
    assert.equal(bundle.targetRepository.name, "example-repo");
    assert.equal(bundle.targetRepository.defaultBranch, "main");
    assert.equal(bundle.selection.requestedLimit, 1);
    assert.equal(bundle.languageDistribution.bytesByLanguage.JavaScript, 1200);
    assert.equal(bundle.pullRequests.length, 1);

    const pr = bundle.pullRequests[0];
    assert.equal(pr.number, 7);
    assert.equal(pr.files[0].path, "src/collect/github-source-bundle.js");
    assert.equal(pr.commits[0].oid, "abc123");
    assert.equal(pr.reviews[0].generatedCommentCount, 1);
    assert.equal(pr.reviewThreads.totalCount, 1);
    assert.equal(pr.statusCheckRollup[0].conclusion, "SUCCESS");
    assert.equal(pr.workflowRuns.totalCount, 2);
    assert.deepEqual(pr.workflowRuns.conclusions, { success: 1, failure: 1 });
    assert.deepEqual(pr.prOpenDiff, {
      source: "unavailable",
      confidence: "unavailable",
      reason: "Historical PR-open diff data is not available from the M1 live collector.",
    });
    assert.equal(coverageFor(bundle, "review_threads").status, "available");
    assert.equal(coverageFor(bundle, "workflow_runs").status, "available");
    assert.equal(coverageFor(bundle, "pr_open_diff").status, "unavailable");
    assert.equal(coverageFor(bundle, "contributor_source"), undefined);

    const normalized = normalizeFixtureBundle(bundle);
    assert.equal(normalized.pullRequests[0].prOpenDiff.source, "unavailable");
    assert.equal(normalized.pullRequests[0].reviewThreads.resolvedCount, 1);
  });

  it("collects configured all-contributors hints without raw file contents", async () => {
    const provider = createProvider();

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      contributors: { sourceType: "all_contributors", path: ".all-contributorsrc" },
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.contributorSource.sourceType, "all_contributors");
    assert.equal(bundle.contributorSource.path, ".all-contributorsrc");
    assert.equal(bundle.contributorSource.coverage.status, "available");
    assert.deepEqual(bundle.contributorSource.hints.logins, ["maintainer", "reviewer"]);
    assert.equal(coverageFor(bundle, "contributor_source").status, "available");
    assert(provider.calls.some(([method]) => method === "getRepositoryContent"));
    const serialized = JSON.stringify(bundle);
    assert(!serialized.includes("Maintainer"));
    assert(!serialized.includes("contributors\":["));
  });

  it("marks all-contributors source partial when some entries cannot provide hints", async () => {
    const provider = createProvider({
      async getRepositoryContent(input) {
        this.calls.push(["getRepositoryContent", input]);
        return JSON.stringify({
          contributors: [
            { login: "maintainer" },
            { name: "No Login" },
          ],
        });
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      contributors: { sourceType: "all_contributors", path: ".all-contributorsrc" },
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.contributorSource.coverage.status, "partial");
    assert.deepEqual(bundle.contributorSource.hints.logins, ["maintainer"]);
    assert.equal(coverageFor(bundle, "contributor_source").status, "partial");
  });

  it("marks malformed all-contributors content without failing collection", async () => {
    const provider = createProvider({
      async getRepositoryContent(input) {
        this.calls.push(["getRepositoryContent", input]);
        return "{not json";
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      contributors: { sourceType: "all_contributors", path: ".all-contributorsrc" },
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.contributorSource.coverage.status, "malformed");
    assert.deepEqual(bundle.contributorSource.hints.logins, []);
    assert.equal(coverageFor(bundle, "contributor_source").status, "malformed");
  });

  it("marks missing or inaccessible contributor sources unavailable", async () => {
    const provider = createProvider({
      async getRepositoryContent(input) {
        this.calls.push(["getRepositoryContent", input]);
        throw new Error("HTTP 404: Not Found");
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      contributors: { sourceType: "all_contributors", path: ".all-contributorsrc" },
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.contributorSource.coverage.status, "unavailable");
    assert.deepEqual(bundle.contributorSource.hints.logins, []);
    assert(coverageFor(bundle, "contributor_source").diagnostics.some(diagnostic => diagnostic.includes("404")));
  });

  it("records Markdown contributor sources as unsupported and does not parse them", async () => {
    const provider = createProvider();

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      contributors: { sourceType: "all_contributors", path: "CONTRIBUTORS.md" },
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.contributorSource.coverage.status, "unsupported");
    assert.deepEqual(bundle.contributorSource.hints.logins, []);
    assert.equal(coverageFor(bundle, "contributor_source").status, "unsupported");
    assert(coverageFor(bundle, "contributor_source").diagnostics.some(diagnostic => (
      diagnostic.includes("CONTRIBUTORS.md") && diagnostic.includes("Markdown contributor files")
    )));
    assert(!provider.calls.some(([method]) => method === "getRepositoryContent"));
  });

  it("rejects invalid contributor source paths before repository content collection", async () => {
    for (const path of ["../contributors.json", "docs/../contributors.json", "/contributors.json", "   "]) {
      const provider = createProvider();

      await assert.rejects(
        collectGitHubSourceBundle({
          repository: "example/example-repo",
          limit: 1,
          provider,
          contributors: { sourceType: "all_contributors", path },
          collectedAt: "2026-06-09T00:00:00Z",
        }),
        /invalid contributor source profile context: contributors\.path/,
      );

      assert(!provider.calls.some(([method]) => method === "getRepositoryContent"), `content fetched for ${path}`);
    }
  });

  it("enforces latest-merged ordering and limit when a provider returns extra inventory", async () => {
    const provider = createProvider({
      async listMergedPullRequests(input) {
        this.calls.push(["listMergedPullRequests", input]);
        return [
          { number: 9, mergedAt: "2026-06-01T12:00:00Z" },
          { number: 11, mergedAt: "2026-06-03T12:00:00Z" },
          { number: 10, mergedAt: "2026-06-02T12:00:00Z" },
        ];
      },
      async getPullRequest(input) {
        this.calls.push(["getPullRequest", input]);
        return pullRequestDetails({
          number: input.number,
          title: `PR ${input.number}`,
          url: `https://github.com/example/example-repo/pull/${input.number}`,
        });
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 2,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.selection.requestedLimit, 2);
    assert.equal(bundle.selection.collectedCount, 2);
    assert.deepEqual(bundle.pullRequests.map(pr => pr.number), [11, 10]);
    assert.deepEqual(
      provider.calls
        .filter(([method]) => method === "getPullRequest")
        .map(([, input]) => input.number),
      [11, 10],
    );
  });

  it("keeps target metadata aligned with the effective PR sample limit", async () => {
    const provider = createProvider({
      async listMergedPullRequests(input) {
        this.calls.push(["listMergedPullRequests", input]);
        return [
          { number: 9, mergedAt: "2026-06-01T12:00:00Z" },
          { number: 11, mergedAt: "2026-06-03T12:00:00Z" },
          { number: 10, mergedAt: "2026-06-02T12:00:00Z" },
        ];
      },
      async getPullRequest(input) {
        this.calls.push(["getPullRequest", input]);
        return pullRequestDetails({
          number: input.number,
          title: `PR ${input.number}`,
          url: `https://github.com/example/example-repo/pull/${input.number}`,
        });
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      analysisPullRequestLimit: 2,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.targetRepository.analysisPullRequestLimit, 2);
    assert.equal(bundle.selection.requestedLimit, 2);
    assert.equal(bundle.selection.collectedCount, 2);
    assert.equal(
      provider.calls.find(([method]) => method === "listMergedPullRequests")[1].limit,
      2,
    );
    assert.deepEqual(bundle.pullRequests.map(pr => pr.number), [11, 10]);
  });

  it("reports invalid effective PR sample limits with a clear error", async () => {
    await assert.rejects(
      collectGitHubSourceBundle({
        repository: "example/example-repo",
        limit: 1,
        analysisPullRequestLimit: 101,
        provider: createProvider(),
        collectedAt: "2026-06-09T00:00:00Z",
      }),
      /PR sample limit must be an integer between 1 and 100\./,
    );

    await assert.rejects(
      collectGitHubSourceBundle({
        repository: "example/example-repo",
        provider: createProvider(),
        collectedAt: "2026-06-09T00:00:00Z",
      }),
      /PR sample limit must be an integer between 1 and 100\./,
    );
  });

  it("degrades review-thread coverage when GraphQL access is unavailable and redacts diagnostics", async () => {
    const fakeClassicToken = ["ghp", "abcdef1234567890"].join("_");
    const fakeFineGrainedToken = ["github", "pat", "ABC123", "def456", "GHI789"].join("_");
    const fakeEnvToken = ["super", "secret"].join("");
    const fakeAuthorizationToken = ["very", "secret", "value"].join("");
    const fakeWindowsCredentialPath = String.raw`C:\Users\Hanna\AppData\Roaming\GitHub CLI\hosts.yml`;
    const envTokenLabel = ["GITHUB", "TOKEN"].join("_");
    const authorizationLabel = ["Author", "ization"].join("");
    const provider = createProvider({
      async getReviewThreads(input) {
        this.calls.push(["getReviewThreads", input]);
        throw new Error(
          `GraphQL: Resource not accessible by integration ${envTokenLabel}=${fakeEnvToken} ${fakeClassicToken} ${fakeFineGrainedToken} /Users/hanna/.config/gh/hosts.yml ${fakeWindowsCredentialPath} ${authorizationLabel}: token ${fakeAuthorizationToken}`,
        );
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].reviewThreads.source, "unavailable");
    assert.equal(bundle.pullRequests[0].coverage.reviewThreads.status, "unavailable");
    assert.equal(coverageFor(bundle, "review_threads").status, "unavailable");

    const serialized = JSON.stringify(bundle);
    assert(!serialized.includes(fakeEnvToken));
    assert(!serialized.includes(fakeClassicToken));
    assert(!serialized.includes(fakeFineGrainedToken));
    assert(!serialized.includes(fakeAuthorizationToken));
    assert(!serialized.includes("/Users/hanna/.config/gh/hosts.yml"));
    assert(!serialized.includes(fakeWindowsCredentialPath));
    assert(serialized.includes("[REDACTED]"));
    assert(serialized.includes("[local credential path]"));
  });

  it("preserves a missing review id as null", async () => {
    const provider = createProvider({
      async getPullRequest(input) {
        this.calls.push(["getPullRequest", input]);
        return pullRequestDetails({
          reviews: [
            {
              author: { login: "reviewer", type: "User" },
              submittedAt: "2026-06-01T10:30:00Z",
              state: "COMMENTED",
            },
          ],
        });
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].reviews[0].id, null);
  });

  it("normalizes live human approval separately from zero review threads", async () => {
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

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });
    const normalized = normalizeFixtureBundle(bundle);

    assert.equal(bundle.pullRequests[0].reviewThreads.totalCount, 0);
    assert.deepEqual(normalized.pullRequests[0].reviewDecision, {
      state: "approved",
      humanApproved: true,
      humanChangesRequested: false,
      humanReviewerCount: 1,
      source: "reviews",
    });
    assert.equal(normalized.pullRequests[0].reviewThreads.totalCount, 0);
  });

  it("degrades workflow-run coverage when Actions access is unavailable", async () => {
    const provider = createProvider({
      async getWorkflowRuns(input) {
        this.calls.push(["getWorkflowRuns", input]);
        throw new Error("HTTP 403: actions access denied for this token");
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].workflowRuns.source, "unavailable");
    assert.equal(bundle.pullRequests[0].workflowRuns.totalCount, null);
    assert.equal(bundle.pullRequests[0].coverage.workflowRuns.status, "unavailable");
    assert.equal(coverageFor(bundle, "workflow_runs").status, "unavailable");
    assert(coverageFor(bundle, "workflow_runs").diagnostics.some(diagnostic => diagnostic.includes("403")));
  });

  it("marks workflow-run coverage partial when a provider returns fewer runs than total_count", async () => {
    const provider = createProvider({
      async getWorkflowRuns(input) {
        this.calls.push(["getWorkflowRuns", input]);
        return {
          total_count: 101,
          workflow_runs: [
            {
              id: 501,
              name: "CI",
              workflow_name: "CI",
              head_sha: "abc123",
              head_branch: "feat/live-source",
              event: "pull_request",
              status: "completed",
              conclusion: "success",
            },
          ],
        };
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].workflowRuns.totalCount, 101);
    assert.equal(bundle.pullRequests[0].workflowRuns.runs.length, 1);
    assert.equal(bundle.pullRequests[0].coverage.workflowRuns.status, "partial");
    assert.equal(coverageFor(bundle, "workflow_runs").status, "partial");
    assert(
      bundle.pullRequests[0].coverage.workflowRuns.diagnostics.some(diagnostic => (
        diagnostic.includes("collected 1 of 101 workflow run")
      )),
    );
  });

  it("degrades workflow branch history without calling Actions when headRefName is missing", async () => {
    const provider = createProvider({
      async getPullRequest(input) {
        this.calls.push(["getPullRequest", input]);
        return pullRequestDetails({ headRefName: null });
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].workflowRuns.source, "unavailable");
    assert.equal(bundle.pullRequests[0].coverage.workflowRuns.status, "unavailable");
    assert(bundle.pullRequests[0].coverage.workflowRuns.diagnostics[0].includes("no accessible headRefName"));
    assert(!provider.calls.some(([name]) => name === "getWorkflowRuns"));
  });

  it("labels rate-limited optional families without exposing invented values", async () => {
    const provider = createProvider({
      async getReviewThreads(input) {
        this.calls.push(["getReviewThreads", input]);
        throw new Error("API rate limit exceeded for graphql");
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].coverage.reviewThreads.status, "rate_limited");
    assert.equal(coverageFor(bundle, "review_threads").status, "rate_limited");
    assert.equal(bundle.pullRequests[0].prOpenDiff.source, "unavailable");
    assert.equal(bundle.pullRequests[0].prOpenDiff.additions, undefined);
  });

  it("marks review-thread coverage partial when nested comments are truncated", async () => {
    const provider = createProvider({
      async getReviewThreads(input) {
        this.calls.push(["getReviewThreads", input]);
        return {
          totalCount: 1,
          nodes: [
            {
              id: "thread-with-many-comments",
              isResolved: false,
              isOutdated: false,
              path: "src/collect/github-source-bundle.js",
              line: 42,
              comments: {
                totalCount: 101,
                pageInfo: {
                  hasNextPage: true,
                  endCursor: "comment-cursor",
                },
                nodes: [
                  {
                    databaseId: 1001,
                    author: { login: "reviewer", type: "User" },
                    path: "src/collect/github-source-bundle.js",
                    line: 42,
                  },
                ],
              },
            },
          ],
        };
      },
    });

    const bundle = await collectGitHubSourceBundle({
      repository: "example/example-repo",
      limit: 1,
      provider,
      collectedAt: "2026-06-09T00:00:00Z",
    });

    assert.equal(bundle.pullRequests[0].reviewThreads.totalCount, 1);
    assert.equal(bundle.pullRequests[0].reviewThreads.nodes[0].comments.length, 1);
    assert.equal(bundle.pullRequests[0].coverage.reviewThreads.status, "partial");
    assert.equal(coverageFor(bundle, "review_threads").status, "partial");
    assert(
      bundle.pullRequests[0].coverage.reviewThreads.diagnostics.some(diagnostic => (
        diagnostic.includes("more than 100 comments")
      )),
    );
  });
});

describe("gh CLI provider", () => {
  it("requests merged PRs with an explicit merged-date search and sorts returned data defensively", async () => {
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.deepEqual(args.slice(0, 8), [
          "pr",
          "list",
          "--repo",
          "example/example-repo",
          "--state",
          "merged",
          "--search",
          "is:merged sort:merged-desc",
        ]);
        return JSON.stringify([
          { number: 1, mergedAt: "2026-06-01T10:00:00Z" },
          { number: 3, mergedAt: "2026-06-03T10:00:00Z" },
          { number: 2, mergedAt: "2026-06-02T10:00:00Z" },
        ]);
      },
    });

    const prs = await provider.listMergedPullRequests({
      owner: "example",
      name: "example-repo",
      limit: 2,
    });

    assert.deepEqual(prs.map(pr => pr.number), [3, 2]);
  });

  it("fails JSON commands when gh returns empty stdout", async () => {
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.equal(args[0], "api");
        assert.equal(args[1], "repos/example/example-repo");
        return "";
      },
    });

    await assert.rejects(
      provider.getRepository({
        owner: "example",
        name: "example-repo",
      }),
      /gh returned empty JSON output for api repos\/example\/example-repo/,
    );
  });

  it("requests repository content with an encoded repository-relative path", async () => {
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.deepEqual(args, ["api", "repos/example/example-repo/contents/docs/Contributor%20List.json"]);
        return JSON.stringify({ encoding: "base64", content: "e30=" });
      },
    });

    assert.deepEqual(await provider.getRepositoryContent({
      owner: "example",
      name: "example-repo",
      path: "docs/Contributor List.json",
    }), { encoding: "base64", content: "e30=" });
  });

  it("retries transient GraphQL authentication failures from gh pr view", async () => {
    const requestedArgs = [];
    const delays = [];
    const provider = createGhCliProvider({
      retryDelaysMs: [2000, 5000],
      async sleep(ms) {
        delays.push(ms);
      },
      async runCommand(args) {
        requestedArgs.push(args);
        if (requestedArgs.length < 3) {
          const error = new Error("HTTP 401: Requires authentication (https://api.github.com/graphql)");
          error.stderr = "HTTP 401: Requires authentication (https://api.github.com/graphql)";
          throw error;
        }
        return JSON.stringify(pullRequestDetails({ number: 42 }));
      },
    });

    const pr = await provider.getPullRequest({
      owner: "example",
      name: "example-repo",
      number: 42,
    });

    assert.equal(pr.number, 42);
    assert.equal(requestedArgs.length, 3);
    assert.deepEqual(delays, [2000, 5000]);
    assert.deepEqual(requestedArgs[0].slice(0, 5), [
      "pr",
      "view",
      "42",
      "--repo",
      "example/example-repo",
    ]);
  });

  it("does not retry non-transient gh pr view failures", async () => {
    const requestedArgs = [];
    const provider = createGhCliProvider({
      async sleep() {
        throw new Error("sleep should not be called");
      },
      async runCommand(args) {
        requestedArgs.push(args);
        const error = new Error("HTTP 404: Not Found");
        error.stderr = "HTTP 404: Not Found";
        throw error;
      },
    });

    await assert.rejects(
      provider.getPullRequest({
        owner: "example",
        name: "example-repo",
        number: 42,
      }),
      /HTTP 404: Not Found/,
    );
    assert.equal(requestedArgs.length, 1);
  });

  it("unwraps GraphQL response data when collecting review threads", async () => {
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.equal(args[0], "api");
        assert.equal(args[1], "graphql");
        return JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  totalCount: 1,
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: "thread-1",
                      isResolved: true,
                      isOutdated: false,
                      path: "src/example.js",
                      line: 12,
                      comments: {
                        nodes: [
                          {
                            databaseId: 1001,
                            author: {
                              login: "copilot-pull-request-reviewer",
                              __typename: "Bot",
                            },
                            path: "src/example.js",
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
                },
              },
            },
          },
        });
      },
    });

    const threads = await provider.getReviewThreads({
      owner: "example",
      name: "example-repo",
      number: 7,
    });

    assert.equal(threads.totalCount, 1);
    assert.equal(threads.nodes.length, 1);
    assert.equal(threads.nodes[0].comments.nodes[0].databaseId, 1001);
  });

  it("paginates workflow runs until GitHub total_count is collected", async () => {
    const requestedPages = [];
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.equal(args[0], "api");
        assert.equal(args[1], "repos/example/example-repo/actions/runs");
        const pageArg = args.find(arg => arg.startsWith("page="));
        const page = Number(pageArg?.split("=")[1] ?? 1);
        requestedPages.push(page);
        return JSON.stringify({
          total_count: 101,
          workflow_runs: Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({
            id: page === 1 ? index + 1 : 101,
            name: "CI",
            workflow_name: "CI",
            head_sha: "abc123",
            head_branch: "feat/live-source",
            event: "pull_request",
            status: "completed",
            conclusion: "success",
          })),
        });
      },
    });

    const runs = await provider.getWorkflowRuns({
      owner: "example",
      name: "example-repo",
      branch: "feat/live-source",
    });

    assert.deepEqual(requestedPages, [1, 2]);
    assert.equal(runs.total_count, 101);
    assert.equal(runs.workflow_runs.length, 101);
    assert.equal(runs.workflow_runs[100].id, 101);
  });

  it("fails review-thread collection when GraphQL returns errors", async () => {
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.equal(args[0], "api");
        assert.equal(args[1], "graphql");
        return JSON.stringify({
          data: {
            repository: null,
          },
          errors: [
            { message: "Resource not accessible by integration" },
          ],
        });
      },
    });

    await assert.rejects(
      provider.getReviewThreads({
        owner: "example",
        name: "example-repo",
        number: 7,
      }),
      /GitHub GraphQL returned errors: Resource not accessible by integration/,
    );
  });

  it("fails review-thread collection when GraphQL omits the expected payload", async () => {
    const provider = createGhCliProvider({
      async runCommand(args) {
        assert.equal(args[0], "api");
        assert.equal(args[1], "graphql");
        return JSON.stringify({
          data: {
            repository: {
              pullRequest: null,
            },
          },
        });
      },
    });

    await assert.rejects(
      provider.getReviewThreads({
        owner: "example",
        name: "example-repo",
        number: 7,
      }),
      /GitHub GraphQL response did not include repository\.pullRequest\.reviewThreads/,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGhCliProvider } from "../src/collect/gh-provider.js";
import { collectGitHubSourceBundle } from "../src/collect/github-source-bundle.js";
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

    const normalized = normalizeFixtureBundle(bundle);
    assert.equal(normalized.pullRequests[0].prOpenDiff.source, "unavailable");
    assert.equal(normalized.pullRequests[0].reviewThreads.resolvedCount, 1);
  });

  it("degrades review-thread coverage when GraphQL access is unavailable and redacts diagnostics", async () => {
    const fakeClassicToken = ["ghp", "abcdef1234567890"].join("_");
    const fakeEnvToken = ["super", "secret"].join("");
    const fakeAuthorizationToken = ["very", "secret", "value"].join("");
    const envTokenLabel = ["GITHUB", "TOKEN"].join("_");
    const authorizationLabel = ["Author", "ization"].join("");
    const provider = createProvider({
      async getReviewThreads(input) {
        this.calls.push(["getReviewThreads", input]);
        throw new Error(
          `GraphQL: Resource not accessible by integration ${envTokenLabel}=${fakeEnvToken} ${fakeClassicToken} /Users/hanna/.config/gh/hosts.yml ${authorizationLabel}: token ${fakeAuthorizationToken}`,
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
    assert(!serialized.includes(fakeAuthorizationToken));
    assert(!serialized.includes("/Users/hanna/.config/gh/hosts.yml"));
    assert(serialized.includes("[REDACTED]"));
    assert(serialized.includes("[local credential path]"));
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
});

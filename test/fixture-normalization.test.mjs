import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { computeRepositoryMetrics } from "../src/metrics/friction.js";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

describe("mcp-writing compact fixture normalization", () => {
  it("contains all required Milestone 1 target scenarios", async () => {
    const bundle = await readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json");
    const scenarios = new Map(bundle.scenarios.map(scenario => [scenario.id, scenario.pullRequestNumber]));

    assert.equal(scenarios.get("low-friction-pr"), 223);
    assert.equal(scenarios.get("high-review-churn-pr"), 239);
    assert.equal(scenarios.get("high-ci-churn-pr"), 239);
    assert.equal(scenarios.get("broad-file-spread-pr"), 221);
  });

  it("preserves repository language distribution as context", async () => {
    const bundle = await readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json");

    assert.equal(bundle.languageDistribution.source, "rest:/repos/{owner}/{repo}/languages");
    assert.equal(bundle.languageDistribution.bytesByLanguage.JavaScript, 2059415);
    assert.equal(bundle.languageDistribution.bytesByLanguage.HTML, 671230);
  });

  it("normalizes PR lifecycle, source grouping, file roles, and workflow coverage", async () => {
    const [bundle, profile] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    const pr239 = normalized.pullRequests.find(pr => pr.number === 239);
    const pr221 = normalized.pullRequests.find(pr => pr.number === 221);

    assert.equal(normalized.targetRepository.owner, "hannasdev");
    assert.equal(pr239.authorLogin, "hannasdev");
    assert.deepEqual(pr239.prClass, {
      class: "unknown",
      classificationSource: "fallback_rule",
      ruleId: null,
    });
    assert.equal(pr239.lifecycle.firstCommitAt, "2026-06-07T13:31:13Z");
    assert.equal(pr239.commits.length, 7);
    assert.deepEqual(pr239.commits[0], {
      oid: "e47e9fb828cf3de3093383bb8adbe15ade75c34a",
      authoredDate: "2026-06-07T13:31:13Z",
      committedDate: null,
      messageHeadline: "feat(search): resolve scene vocabulary variants",
    });
    assert.equal(pr239.reviewThreads.totalCount, 15);
    assert.equal(pr239.reviewThreads.resolvedCount, 15);
    assert.equal(pr239.reviewComments.bySource.copilot, 15);
    assert.equal(pr239.reviewComments.bySource.author_reply, 15);
    assert.equal(pr239.reviewComments.bySource.human_reviewer, 0);
    assert.equal(pr239.workflowRuns.totalCount, 9);
    assert.equal(pr239.workflowRuns.conclusions.cancelled, 1);
    assert.equal(pr239.prOpenDiff.source, "unavailable");

    const generatedDocs = pr239.files.find(file => file.path === "docs/agents/tools.md");
    assert.equal(generatedDocs.role, "generated_docs");
    assert.equal(generatedDocs.generated, true);

    const coreFile = pr221.files.find(file => file.path === "src/structure/project-backup-restore.js");
    assert.equal(coreFile.role, "core_product_code");

    const releaseLog = pr221.files.find(file => file.path === "release-log.md");
    assert.equal(releaseLog.role, "release_notes");
  });

  it("normalizes release PR class evidence from profile title rules", async () => {
    const [bundle, profile] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
    ]);
    const releaseBundle = structuredClone(bundle);
    releaseBundle.pullRequests[0].title = "Release 2026.06.14";

    const normalized = normalizeFixtureBundle(releaseBundle, { repositoryProfile: profile });

    assert.deepEqual(normalized.pullRequests[0].prClass, {
      class: "release",
      classificationSource: "repository_profile",
      ruleId: "release-title",
    });
  });

  it("treats a null repository profile as omitted", async () => {
    const bundle = await readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json");

    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: null });

    assert.deepEqual(normalized.pullRequests[0].prClass, {
      class: "unknown",
      classificationSource: "fallback_rule",
      ruleId: null,
    });
    assert.equal(normalized.pullRequests[0].files[0].classificationSource, "fallback_rule");
  });

  it("keeps review attempts separate from review comments", async () => {
    const [bundle, profile] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    const pr221 = normalized.pullRequests.find(pr => pr.number === 221);

    assert.equal(pr221.reviews.filter(review => review.source === "copilot").length, 6);
    assert.equal(pr221.reviews.filter(review => review.failedAttempt).length, 1);
    assert.equal(pr221.reviews.reduce((sum, review) => sum + review.generatedCommentCount, 0), 10);
  });

  it("derives human review decision without treating missing reviews as observed absence", async () => {
    const [bundle, profile] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
    ]);
    const decisionBundle = structuredClone(bundle);
    decisionBundle.pullRequests = [
      {
        ...decisionBundle.pullRequests[0],
        number: 301,
        reviews: [
          {
            id: "changes-requested",
            author: { login: "reviewer", type: "User" },
            submittedAt: "2026-06-01T10:00:00Z",
            state: "CHANGES_REQUESTED",
          },
          {
            id: "approved",
            author: { login: "reviewer", type: "User" },
            submittedAt: "2026-06-01T11:00:00Z",
            state: "APPROVED",
          },
        ],
      },
      {
        ...decisionBundle.pullRequests[0],
        number: 302,
        reviews: [
          {
            id: "copilot-only",
            author: { login: "copilot-pull-request-reviewer", type: "Bot" },
            submittedAt: "2026-06-01T10:00:00Z",
            state: "COMMENTED",
          },
        ],
      },
      {
        ...decisionBundle.pullRequests[0],
        number: 303,
      },
      {
        ...decisionBundle.pullRequests[0],
        number: 304,
        reviews: [
          {
            id: "untimed-approved",
            author: { login: "reviewer", type: "User" },
            submittedAt: null,
            state: "APPROVED",
          },
          {
            id: "untimed-changes-requested",
            author: { login: "reviewer", type: "User" },
            submittedAt: null,
            state: "CHANGES_REQUESTED",
          },
        ],
      },
      {
        ...decisionBundle.pullRequests[0],
        number: 305,
        reviews: [
          {
            id: "human-commented",
            author: { login: "reviewer", type: "User" },
            submittedAt: "2026-06-01T10:00:00Z",
            state: "COMMENTED",
          },
        ],
      },
      {
        ...decisionBundle.pullRequests[0],
        number: 306,
        reviews: [
          {
            id: "bare-login-approved",
            author: { login: "reviewer" },
            submittedAt: "2026-06-01T10:00:00Z",
            state: "APPROVED",
          },
        ],
      },
    ];
    delete decisionBundle.pullRequests[2].reviews;

    const normalized = normalizeFixtureBundle(decisionBundle, { repositoryProfile: profile });
    const approved = normalized.pullRequests.find(pr => pr.number === 301);
    const botOnly = normalized.pullRequests.find(pr => pr.number === 302);
    const unavailable = normalized.pullRequests.find(pr => pr.number === 303);
    const conflictingUntimed = normalized.pullRequests.find(pr => pr.number === 304);
    const commented = normalized.pullRequests.find(pr => pr.number === 305);
    const bareLoginApproved = normalized.pullRequests.find(pr => pr.number === 306);

    assert.deepEqual(approved.reviewDecision, {
      state: "approved",
      humanApproved: true,
      humanChangesRequested: true,
      humanReviewerCount: 1,
      source: "reviews",
    });
    assert.deepEqual(botOnly.reviewDecision, {
      state: "none",
      humanApproved: false,
      humanChangesRequested: false,
      humanReviewerCount: 0,
      source: "reviews",
    });
    assert.deepEqual(unavailable.reviewDecision, {
      state: "unavailable",
      humanApproved: false,
      humanChangesRequested: false,
      humanReviewerCount: 0,
      source: "unavailable",
    });
    assert.deepEqual(conflictingUntimed.reviewDecision, {
      state: "changes_requested",
      humanApproved: true,
      humanChangesRequested: true,
      humanReviewerCount: 1,
      source: "reviews",
    });
    assert.deepEqual(commented.reviewDecision, {
      state: "commented",
      humanApproved: false,
      humanChangesRequested: false,
      humanReviewerCount: 1,
      source: "reviews",
    });
    assert.deepEqual(bareLoginApproved.reviewDecision, {
      state: "approved",
      humanApproved: true,
      humanChangesRequested: false,
      humanReviewerCount: 1,
      source: "reviews",
    });
    assert.equal(bareLoginApproved.reviews[0].source, "human_reviewer");
  });

  it("normalizes missing check-run names to null", async () => {
    const [bundle, profile] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
    ]);
    const bundleWithUnnamedCheck = structuredClone(bundle);
    bundleWithUnnamedCheck.pullRequests[0].statusCheckRollup = [{ __typename: "CheckRun", status: "COMPLETED" }];

    const normalized = normalizeFixtureBundle(bundleWithUnnamedCheck, { repositoryProfile: profile });

    assert.equal(normalized.pullRequests[0].checkRuns[0].name, null);
  });

  it("normalizes the tutorial sample bundle into representative metrics", async () => {
    const [bundle, profile] = await Promise.all([
      readJson("../examples/tutorial/source-bundle.json"),
      readJson("../examples/tutorial/profile.json"),
    ]);

    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });
    const metrics = computeRepositoryMetrics(normalized);
    const broadPr = metrics.pullRequests.find(pr => pr.number === 104);
    const partialCoveragePr = metrics.pullRequests.find(pr => pr.number === 103);

    assert.equal(normalized.targetRepository.owner, "example-org");
    assert.equal(normalized.pullRequests.length, 4);
    assert.deepEqual(normalized.pullRequests.map(pr => pr.prClass.class), [
      "feature",
      "fix",
      "test",
      "feature",
    ]);
    assert.equal(broadPr.files.byFunctionalSurface.dashboard_ui, 550);
    assert.equal(broadPr.files.byFunctionalSurface.delivery_api, 278);
    assert.equal(broadPr.files.byFunctionalSurface.background_jobs, 214);
    assert.equal(broadPr.files.functionalSurfaces, 6);
    assert.equal(broadPr.review.threads.totalCount, 12);
    assert.equal(broadPr.ci.workflowRuns.failedCount, 2);
    assert.equal(broadPr.ci.workflowRuns.cancelledCount, 1);
    assert.equal(broadPr.components.diffGrowthRatio.value, 4);
    assert.equal(partialCoveragePr.coverage.prOpenDiff.status, "unavailable");
    assert.equal(partialCoveragePr.coverage.workflowRuns.status, "unavailable");
    assert(metrics.rankings.reviewChurn[0].number, 104);
    assert(metrics.rankings.changedFileSpread[0].number, 104);
    assert(metrics.rankings.validationGap[0].number, 104);
  });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  computePullRequestMetrics,
  computeRepositoryMetrics,
  FRICTION_METRIC_CONSTANTS,
  FRICTION_METRICS_VERSION,
} from "../src/metrics/friction.js";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

function buildSyntheticPr(overrides = {}) {
  return {
    number: 1,
    title: "feat: synthetic metrics fixture",
    url: "https://example.test/pr/1",
    state: "MERGED",
    lifecycle: {
      createdAt: "2026-06-01T00:00:00Z",
      mergedAt: "2026-06-01T06:00:00Z",
      firstCommitAt: "2026-06-01T00:00:00Z",
      firstReviewAt: "2026-06-01T02:00:00Z",
      lastReviewAt: "2026-06-01T05:00:00Z",
    },
    commits: [
      { oid: "a", authoredDate: "2026-06-01T00:00:00Z", committedDate: null, messageHeadline: "start" },
      { oid: "b", authoredDate: "2026-06-01T03:00:00Z", committedDate: null, messageHeadline: "respond" },
    ],
    diffAtMerge: { additions: 180, deletions: 20, changedFiles: 5 },
    prOpenDiff: { source: "reconstructed", confidence: "medium", additions: 90, deletions: 10, changedFiles: 2 },
    files: [
      {
        path: "src/a.js",
        category: "code",
        role: "core_product_code",
        functionalSurface: "runtime",
        generated: false,
        classificationSource: "repository_profile",
        ruleId: "runtime",
        additions: 20,
        deletions: 10,
        changeType: "modified",
      },
      {
        path: "src/b.js",
        category: "code",
        role: "core_product_code",
        functionalSurface: "runtime",
        generated: false,
        classificationSource: "repository_profile",
        ruleId: "runtime",
        additions: 20,
        deletions: 10,
        changeType: "modified",
      },
      {
        path: "src/c.js",
        category: "code",
        role: "core_product_code",
        functionalSurface: "runtime",
        generated: false,
        classificationSource: "repository_profile",
        ruleId: "runtime",
        additions: 20,
        deletions: 10,
        changeType: "modified",
      },
      {
        path: "site/index.html",
        category: "docs",
        role: "marketing_site",
        functionalSurface: "marketing",
        generated: false,
        classificationSource: "repository_profile",
        ruleId: "marketing",
        additions: 80,
        deletions: 0,
        changeType: "added",
      },
      {
        path: "docs/generated.md",
        category: "generated",
        role: "generated_docs",
        functionalSurface: "generated_docs",
        generated: true,
        classificationSource: "repository_profile",
        ruleId: "generated",
        additions: 50,
        deletions: 0,
        changeType: "modified",
      },
    ],
    reviews: [{ id: "r1", submittedAt: "2026-06-01T02:00:00Z", state: "COMMENTED", commitOid: "a", source: "copilot", generatedCommentCount: 2, failedAttempt: true }],
    reviewThreads: { source: "graphql", totalCount: 2, resolvedCount: 1, outdatedCount: 1 },
    reviewComments: {
      totalCount: 5,
      bySource: {
        copilot: 2,
        human_reviewer: 1,
        author_reply: 1,
        github_actions_bot: 0,
        dependency_bot: 0,
        code_scanning: 1,
        unknown_bot: 0,
        unknown: 0,
      },
    },
    checkRuns: [
      { source: "check_run", name: "test", workflowName: "ci", status: "COMPLETED", conclusion: "FAILURE", startedAt: null, completedAt: null },
      { source: "check_run", name: "lint", workflowName: "ci", status: "COMPLETED", conclusion: "SUCCESS", startedAt: null, completedAt: null },
    ],
    workflowRuns: { source: "rest", totalCount: 2, conclusions: { failure: 1, cancelled: 1 } },
    ...overrides,
  };
}

describe("friction metric formulas", () => {
  it("computes transparent PR component metrics from normalized input", () => {
    const metrics = computePullRequestMetrics(buildSyntheticPr());

    assert.equal(metrics.metricVersion, FRICTION_METRICS_VERSION);
    assert.equal(metrics.files.nonGeneratedFiles, 4);
    assert.equal(metrics.files.coreFiles, 3);
    assert.equal(metrics.files.lowSignalFiles, 2);
    assert.equal(metrics.files.smallDiffWideSpread, true);
    assert.equal(metrics.files.byRole.marketing_site, 80);
    assert.deepEqual(metrics.files.classificationSources, { repository_profile: 5 });
    assert.deepEqual(metrics.files.formulaInputs.smallDiffWideSpread, FRICTION_METRIC_CONSTANTS.smallDiffWideSpread);
    assert.equal(metrics.files.formulaInputs.lowSignalRoleWeight, FRICTION_METRIC_CONSTANTS.lowSignalRoleWeight);
    assert.equal(metrics.review.comments.densityPer100ChangedLines.copilot, 1);
    assert.equal(metrics.ci.checkRuns.failedCount, 1);
    assert.equal(metrics.ci.workflowRuns.cancelledCount, 1);
    assert.equal(metrics.lifecycle.timeToFirstReviewHours, 2);
    assert.equal(metrics.iteration.commitsAfterFirstReview, 1);
    assert.equal(metrics.components.diffGrowthRatio.value, 2);
    assert.equal(metrics.components.validationGapScore.value, 3);
    assert.deepEqual(metrics.components.validationGapScore.inputs, {
      failedCheckRuns: 1,
      failedWorkflowRuns: 1,
      cancelledWorkflowRuns: 1,
      workflowCoverage: "observed",
    });
  });

  it("marks diff growth unavailable when PR-open data is unavailable", () => {
    const metrics = computePullRequestMetrics(buildSyntheticPr({
      prOpenDiff: { source: "unavailable", confidence: "unavailable" },
    }));

    assert.equal(metrics.coverage.prOpenDiff.status, "unavailable");
    assert.equal(metrics.components.diffGrowthRatio.value, null);
    assert.equal(metrics.components.fixAmplification.inputs.diffGrowthStatus, "unavailable");
  });

  it("returns null diff-growth ratios when PR-open line and file counts are zero", () => {
    const metrics = computePullRequestMetrics(buildSyntheticPr({
      prOpenDiff: { source: "direct", confidence: "high", additions: 0, deletions: 0, changedFiles: 0 },
    }));

    assert.equal(metrics.coverage.prOpenDiff.status, "computed");
    assert.equal(metrics.components.diffGrowthRatio.value, null);
    assert.deepEqual(metrics.components.diffGrowthRatio.inputs, {
      status: "computed",
      source: "direct",
      confidence: "high",
      changedLineGrowthRatio: null,
      changedFileGrowthRatio: null,
    });
  });

  it("counts GitHub failure-like check and workflow tokens", () => {
    const metrics = computePullRequestMetrics(buildSyntheticPr({
      checkRuns: [
        { source: "check_run", name: "timeout", workflowName: "ci", status: "COMPLETED", conclusion: "TIMED_OUT", startedAt: null, completedAt: null },
        { source: "check_run", name: "cancelled", workflowName: "ci", status: "COMPLETED", conclusion: "CANCELLED", startedAt: null, completedAt: null },
        { source: "check_run", name: "stale", workflowName: "ci", status: "COMPLETED", conclusion: "STALE", startedAt: null, completedAt: null },
        { source: "status_context", name: "deploy", workflowName: null, status: "ERROR", conclusion: "ERROR", startedAt: null, completedAt: null },
        { source: "check_run", name: "ok", workflowName: "ci", status: "COMPLETED", conclusion: "SUCCESS", startedAt: null, completedAt: null },
      ],
      workflowRuns: { source: "rest", totalCount: 5, conclusions: { timed_out: 1, error: 1, cancelled: 1, canceled: 1, success: 1 } },
    }));

    assert.equal(metrics.ci.checkRuns.failedCount, 4);
    assert.equal(metrics.ci.workflowRuns.failedCount, 2);
    assert.equal(metrics.ci.workflowRuns.cancelledCount, 2);
    assert.equal(metrics.components.validationGapScore.value, 8);
  });

  it("keeps unavailable workflow coverage explicit in validation inputs", () => {
    const metrics = computePullRequestMetrics(buildSyntheticPr({
      workflowRuns: { source: "unavailable", totalCount: null, conclusions: {} },
    }));

    assert.equal(metrics.coverage.workflowRuns.status, "unavailable");
    assert.equal(metrics.ci.workflowRuns.coverage, "unavailable");
    assert.equal(metrics.components.validationGapScore.inputs.workflowCoverage, "unavailable");
  });

  it("keeps omitted workflow run data unavailable", () => {
    const pr = buildSyntheticPr();
    delete pr.workflowRuns;

    const metrics = computePullRequestMetrics(pr);

    assert.equal(metrics.coverage.workflowRuns.source, "unavailable");
    assert.equal(metrics.coverage.workflowRuns.status, "unavailable");
    assert.equal(metrics.ci.workflowRuns.totalCount, null);
    assert.equal(metrics.ci.workflowRuns.coverage, "unavailable");
  });

  it("carries normalized review decision evidence without changing review churn counts", () => {
    const metrics = computePullRequestMetrics(buildSyntheticPr({
      reviewThreads: { source: "graphql", totalCount: 0, resolvedCount: 0, outdatedCount: 0 },
      reviewDecision: {
        state: "approved",
        humanApproved: true,
        humanChangesRequested: false,
        humanReviewerCount: 2,
        source: "reviews",
      },
    }));

    assert.deepEqual(metrics.review.decision, {
      state: "approved",
      humanApproved: true,
      humanChangesRequested: false,
      humanReviewerCount: 2,
      source: "reviews",
    });
    assert.equal(metrics.review.threads.totalCount, 0);
    assert.equal(metrics.components.iterationDrag.inputs.reviewThreads, 0);
  });

  it("proves planning gap score is live for repository-profile planning docs", () => {
    const planningDocPr = buildSyntheticPr({
      number: 10,
      title: "docs: update initiative plan",
      files: [
        {
          path: "docs/initiatives/example/prd.md",
          category: "docs",
          role: "planning_docs",
          functionalSurface: "planning",
          generated: false,
          classificationSource: "repository_profile",
          ruleId: "planning-docs",
          additions: 8,
          deletions: 4,
          changeType: "modified",
        },
      ],
    });
    const implementationOnlyPr = buildSyntheticPr({
      number: 11,
      title: "feat: implementation only",
      files: [
        {
          path: "src/feature.js",
          category: "code",
          role: "core_product_code",
          functionalSurface: "runtime",
          generated: false,
          classificationSource: "repository_profile",
          ruleId: "runtime",
          additions: 8,
          deletions: 4,
          changeType: "modified",
        },
      ],
    });
    const metrics = computePullRequestMetrics(planningDocPr);
    const repositoryMetrics = computeRepositoryMetrics({
      targetRepository: { owner: "example", name: "repo" },
      pullRequests: [implementationOnlyPr, planningDocPr],
    });

    assert.equal(metrics.components.planningGapScore.value, 1);
    assert.deepEqual(metrics.components.planningGapScore.inputs, {
      planningChangedLines: 12,
      source: "repository_profile",
    });
    assert.equal(metrics.files.byRole.planning_docs, 12);
    assert.equal(metrics.files.byFunctionalSurface.planning, 12);
    assert.deepEqual(repositoryMetrics.rankings.planningGap.map(entry => [entry.number, entry.value]), [
      [10, 1],
      [11, 0],
    ]);
  });

  it("keeps partial PR file and review thread inputs safe and transparent", () => {
    const pr = buildSyntheticPr();
    delete pr.files;
    delete pr.reviewThreads;

    const metrics = computePullRequestMetrics(pr);

    assert.equal(metrics.files.changedLines, 0);
    assert.equal(metrics.review.threads.source, "unavailable");
    assert.equal(metrics.review.threads.totalCount, 0);
    assert.equal(metrics.components.iterationDrag.inputs.reviewThreads, 0);
    assert.equal(metrics.components.commentSourceDensity.inputs.changedLines, 200);
    assert.equal(metrics.review.comments.densityPer100ChangedLines.copilot, 1);
    assert.equal(metrics.components.planningGapScore.inputs.planningChangedLines, 0);
  });

  it("distinguishes no-review iteration from missing review timestamps", () => {
    const noReviewMetrics = computePullRequestMetrics(buildSyntheticPr({
      lifecycle: {
        ...buildSyntheticPr().lifecycle,
        firstReviewAt: null,
        lastReviewAt: null,
      },
      reviews: [],
      reviewThreads: { source: "graphql", totalCount: 0, resolvedCount: 0, outdatedCount: 0 },
    }));
    const missingTimestampMetrics = computePullRequestMetrics(buildSyntheticPr({
      lifecycle: {
        ...buildSyntheticPr().lifecycle,
        firstReviewAt: null,
        lastReviewAt: null,
      },
      reviews: [{ id: "r1", submittedAt: null, state: "COMMENTED", commitOid: "a", source: "copilot", generatedCommentCount: 0, failedAttempt: false }],
    }));

    assert.equal(noReviewMetrics.iteration.commitsAfterFirstReview, 0);
    assert.equal(noReviewMetrics.components.iterationDrag.value, 0);
    assert.equal(noReviewMetrics.components.iterationDrag.inputs.commitsAfterFirstReview, 0);
    assert.equal(noReviewMetrics.components.fixAmplification.value, 0);
    assert.equal(missingTimestampMetrics.iteration.commitsAfterFirstReview, null);
    assert.equal(missingTimestampMetrics.components.iterationDrag.value, null);
    assert.equal(missingTimestampMetrics.components.iterationDrag.inputs.commitsAfterFirstReview, null);
    assert.equal(missingTimestampMetrics.components.fixAmplification.value, null);
  });

  it("keeps unknown component values visible in rankings", () => {
    const repositoryMetrics = computeRepositoryMetrics({
      targetRepository: { owner: "example", name: "repo" },
      pullRequests: [
        buildSyntheticPr({
          number: 1,
          title: "feat: no review",
          lifecycle: {
            ...buildSyntheticPr().lifecycle,
            firstReviewAt: null,
            lastReviewAt: null,
          },
          reviews: [],
          reviewThreads: { source: "graphql", totalCount: 0, resolvedCount: 0, outdatedCount: 0 },
        }),
        buildSyntheticPr({
          number: 2,
          title: "feat: missing review timestamp",
          lifecycle: {
            ...buildSyntheticPr().lifecycle,
            firstReviewAt: null,
            lastReviewAt: null,
          },
          reviews: [{ id: "r1", submittedAt: null, state: "COMMENTED", commitOid: "a", source: "copilot", generatedCommentCount: 0, failedAttempt: false }],
        }),
      ],
    });

    assert.deepEqual(repositoryMetrics.rankings.fixAmplification.map(entry => entry.value), [0, null]);
    assert.deepEqual(repositoryMetrics.rankings.fixAmplification.map(entry => entry.number), [1, 2]);
  });
});

describe("fixture repository metrics", () => {
  it("aggregates and ranks normalized fixture PRs deterministically", async () => {
    const [bundle, profile, golden] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/fixture-bundle.compact.json"),
      readJson("../fixtures/github/mcp-writing/profile.json"),
      readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json"),
    ]);
    const normalized = normalizeFixtureBundle(bundle, { repositoryProfile: profile });

    assert.deepEqual(computeRepositoryMetrics(normalized), golden);
  });
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { computeRepositoryMetrics } from "../src/metrics/friction.js";
import { normalizeFixtureBundle } from "../src/normalize/github-fixture.js";
import {
  generateEvidenceCsvArtifacts,
  renderRepositoryFrictionMethodology,
} from "../src/report/evidence-artifacts.js";
import { writeRepositoryFrictionReport } from "../src/report/generate-report.js";
import {
  generateRepositoryFrictionReport,
  renderRepositoryFrictionMarkdown,
} from "../src/report/friction-report.js";

const execFileAsync = promisify(execFile);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

async function readText(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

function assertOrderedSections(markdown, sectionNames) {
  let previousIndex = -1;
  for (const sectionName of sectionNames) {
    const index = markdown.indexOf(sectionName);
    assert.notEqual(index, -1, `expected ${sectionName} to be rendered`);
    assert(index > previousIndex, `expected ${sectionName} to render after the previous checked section`);
    previousIndex = index;
  }
}

describe("friction report generation", () => {
  it("generates deterministic JSON and Markdown reports from fixture metrics", async () => {
    const [metricsSummary, goldenJson, goldenMarkdown] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json"),
      readJson("../fixtures/github/mcp-writing/reports/friction-report.golden.json"),
      readText("../fixtures/github/mcp-writing/reports/friction-report.golden.md"),
    ]);

    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert.deepEqual(report, goldenJson);
    assert.equal(markdown, goldenMarkdown);
    assert(markdown.includes("Pull requests analyzed: 3"));
    assert(!markdown.includes("PR sample:"));
  });

  it("omits workflow context sections when no workflow profile context is configured", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 3 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "fixtures/github/mcp-writing/profile.json",
      artifactFileNames: {},
      csvEnabled: false,
    });

    assert.equal(report.configuredWorkflow, undefined);
    assert(!markdown.includes("## Configured Workflow Context"));
    assert(!markdown.includes("Configured workflow context"));
    assert(!methodology.includes("## Configured Workflow Context"));
    assert(!methodology.includes("Configured workflow context"));
    assert(markdown.includes("| Workflow context | PR-open diff coverage unavailable for 3 PRs; workflow-run coverage unavailable for 2 PRs."));
    assert(markdown.includes("Configure repository-profile workflow context"));
    assert(methodology.includes("- Workflow context: PR-open diff coverage unavailable for 3 PRs; workflow-run coverage unavailable for 2 PRs."));
  });

  it("omits contributor source sections when no contributor source is configured", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 3 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "fixtures/github/mcp-writing/profile.json",
      artifactFileNames: {},
      csvEnabled: false,
    });

    assert.equal(report.contributorSource, undefined);
    assert(!markdown.includes("## Contributor Source Context"));
    assert(!methodology.includes("## Contributor Source Context"));
  });

  it("accepts null report options as omitted options", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");

    assert.deepEqual(
      generateRepositoryFrictionReport(metricsSummary, null),
      generateRepositoryFrictionReport(metricsSummary),
    );
  });

  it("surfaces configured workflow context separately from observed evidence", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary, {
      workflowContext: {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "main_plus_release_branches",
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 3 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "fixtures/github/mcp-writing/profile.json",
      artifactFileNames: {},
      csvEnabled: false,
    });

    assert.deepEqual(report.configuredWorkflow, {
      source: "repository_profile",
      note: "Configured workflow context comes from the repository profile. It is user-configured context, not observed GitHub evidence, and it does not change scores, rankings, CSV exports, or PR class matching.",
      primaryMergeMethod: "squash_merge",
      releaseStrategy: "release_prs",
      branchStrategy: "main_plus_release_branches",
    });
    assert(markdown.includes("## Configured Workflow Context"));
    assert(markdown.includes("not observed GitHub evidence"));
    assert(markdown.includes("does not change scores, rankings, CSV exports, or PR class matching"));
    assert(markdown.includes("| Primary merge method | Squash merge |"));
    assert(markdown.includes("| Release strategy | Release PRs |"));
    assert(markdown.includes("| Branch strategy | Main plus release branches |"));
    assert(markdown.includes("## Workflow Data Caveats"));
    assert(markdown.includes("Profile context says primary merge method is Squash merge; this is configured profile context, not observed evidence."));
    assert(!markdown.includes("Final PR metadata"));
    assert(markdown.includes("final PR metadata available through GitHub PR data"));
    assert(markdown.includes("PR-open diff growth requires an open-time snapshot or equivalent captured state."));
    assert(markdown.includes("## Evidence Quality And Coverage"));
    assert(methodology.includes("## Configured Workflow Context"));
    assert(methodology.includes("- Primary merge method: Squash merge"));
    assert(methodology.includes("- Release strategy: Release PRs"));
    assert(methodology.includes("- Branch strategy: Main plus release branches"));
    assert(methodology.includes("Workflow data caveats:"));
    assert(methodology.includes("configured profile context, not observed evidence"));
    assert(methodology.includes("not observed GitHub evidence"));
    assert(!markdown.includes("| Workflow context |"));
  });

  it("surfaces contributor source metadata without raw contributor data or ranking output", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary, {
      contributorSource: {
        sourceType: "all_contributors",
        path: ".all-contributorsrc",
        coverage: { status: "partial" },
        hints: { logins: ["secret-login-one", "secret-login-two"] },
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 3 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "fixtures/github/mcp-writing/profile.json",
      artifactFileNames: {},
      csvEnabled: true,
    });
    const csv = generateEvidenceCsvArtifacts({
      metricsSummary,
      report,
      collectionCoverage: {
        sourceFamilies: [
          {
            family: "contributor_source",
            status: "partial",
            attempts: 1,
            source: "rest:/repos/{owner}/{repo}/contents/{path}",
            diagnostics: ["Skipped 1 contributor entry without a supported login hint."],
            downstreamImpact: "Contributor-aware comment-source hints are available; scoring and person-level outputs are unchanged.",
          },
        ],
      },
    });

    assert.deepEqual(report.contributorSource, {
      source: "repository_profile",
      sourceType: "all_contributors",
      path: ".all-contributorsrc",
      status: "partial",
      hintCount: 2,
      note: "Contributor source metadata comes from the configured repository profile source. It may improve comment-source classification coverage, but it does not change scores, PR authorship conclusions, reviewer attribution, CSV export shape, person-level CSV output, or individual ranking guardrails.",
    });
    assert(markdown.includes("## Contributor Source Context"));
    assert(markdown.includes("| Parsed hint count | 2 |"));
    assert(methodology.includes("## Contributor Source Context"));
    assert(methodology.includes("- Coverage status: partial"));
    assert(methodology.includes("Raw contributor file contents and individual contributor rankings are not emitted."));
    assert(csv.collectionCoverageCsv.includes("contributor_source,partial"));
    assert(!markdown.includes("secret-login-one"));
    assert(!methodology.includes("secret-login-one"));
    assert(!csv.prMetricsCsv.includes("secret-login-one"));
    assert(!csv.bottleneckExamplesCsv.includes("secret-login-one"));
    assert(!csv.commentSourcesCsv.includes("secret-login-one"));
  });

  it("labels configured merge methods as profile context when PR-open diff coverage is unavailable", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");

    for (const [method, label, expectedLimit] of [
      ["squash_merge", "Squash merge", "does not preserve the original branch commit topology"],
      ["rebase_merge", "Rebase merge", "do not provide a reliable open-time diff snapshot"],
      ["merge_commit", "Merge commit", "does not reconstruct PR-open size from merge commits or branch history"],
    ]) {
      const report = generateRepositoryFrictionReport(metricsSummary, {
        workflowContext: { primaryMergeMethod: method },
      });
      const markdown = renderRepositoryFrictionMarkdown(report);

      assert(markdown.includes(`| Primary merge method | ${label} |`));
      assert(markdown.includes(`Profile context says primary merge method is ${label}; this is configured profile context, not observed evidence.`));
      assert(markdown.includes(expectedLimit));
      assert(markdown.includes("PR-open diff growth requires an open-time snapshot or equivalent captured state."));
      assert(!markdown.includes("| Workflow context |"));
    }
  });

  it("suggests profile PR class rules when fallback unknown dominates the sample", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 3 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "fixtures/github/mcp-writing/profile.json",
      artifactFileNames: {},
      csvEnabled: false,
    });

    assert(!("profileSuggestions" in report));
    assert(markdown.includes("## Profile Suggestions"));
    assert(markdown.includes("| PR class rules | 3 of 3 analyzed PRs (100%) use fallback unknown PR class evidence."));
    assert(markdown.includes("| Workflow context | PR-open diff coverage unavailable for 3 PRs; workflow-run coverage unavailable for 2 PRs."));
    assert(markdown.includes("Add or refine repository-profile PR class title rules"));
    assert(methodology.includes("## Profile Suggestions"));
    assert(methodology.includes("- PR class rules: 3 of 3 analyzed PRs (100%) use fallback unknown PR class evidence."));
    assert(methodology.includes("- Workflow context: PR-open diff coverage unavailable for 3 PRs; workflow-run coverage unavailable for 2 PRs."));
  });

  it("suggests fallback PR class rules when every analyzed PR is unknown in a small sample", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 1,
        changedLines: 20,
        nonGeneratedChangedLines: 20,
      },
      pullRequests: [
        {
          number: 1,
          title: "one unknown PR",
          url: "https://example.test/pull/1",
          prClass: { class: "unknown", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 20 },
          files: {
            nonGeneratedChangedLines: 20,
            byRole: { core_product_code: 20 },
            byFunctionalSurface: { runtime: 20 },
          },
        },
      ],
      rankings: {},
    }, {
      workflowContext: { primaryMergeMethod: "merge_commit" },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(markdown.includes("| PR class rules | 1 of 1 analyzed PRs (100%) use fallback unknown PR class evidence."));
  });

  it("suggests file path profile rules when unknown file evidence crosses the threshold", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 2,
        changedLines: 100,
        nonGeneratedChangedLines: 100,
      },
      pullRequests: [
        {
          number: 1,
          title: "classified PR",
          url: "https://example.test/pull/1",
          prClass: { class: "feature", classificationSource: "repository_profile", ruleId: "feature-title" },
          diffAtMerge: { changedLines: 60 },
          files: {
            nonGeneratedChangedLines: 60,
            byRole: { unknown: 30, core_product_code: 30 },
            byFunctionalSurface: { unknown: 10, runtime: 50 },
          },
        },
        {
          number: 2,
          title: "another classified PR",
          url: "https://example.test/pull/2",
          prClass: { class: "fix", classificationSource: "repository_profile", ruleId: "fix-title" },
          diffAtMerge: { changedLines: 40 },
          files: {
            nonGeneratedChangedLines: 40,
            byRole: { tests: 40 },
            byFunctionalSurface: { test_suite: 40 },
          },
        },
      ],
      rankings: {},
    }, {
      workflowContext: { primaryMergeMethod: "merge_commit" },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 2 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "profile.json",
      artifactFileNames: {},
      csvEnabled: false,
    });

    assert(markdown.includes("| File/path rules | Unknown role lines: 30 of 100 (30%); unknown functional-surface lines: 10 of 100 (10%)."));
    assert(markdown.includes("Add repository-profile path rules for high-volume unknown roles or functional surfaces"));
    assert(methodology.includes("- File/path rules: Unknown role lines: 30 of 100 (30%); unknown functional-surface lines: 10 of 100 (10%)."));
    assert(!markdown.includes("| PR class rules |"));
  });

  it("suppresses profile suggestions when configured evidence stays below thresholds", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 4,
        changedLines: 100,
        nonGeneratedChangedLines: 100,
      },
      pullRequests: [
        {
          number: 1,
          title: "feature one",
          prClass: { class: "feature", classificationSource: "repository_profile", ruleId: "feature-title" },
          diffAtMerge: { changedLines: 40 },
          files: {
            nonGeneratedChangedLines: 40,
            byRole: { core_product_code: 40 },
            byFunctionalSurface: { runtime: 40 },
          },
        },
        {
          number: 2,
          title: "fix one",
          prClass: { class: "fix", classificationSource: "repository_profile", ruleId: "fix-title" },
          diffAtMerge: { changedLines: 30 },
          files: {
            nonGeneratedChangedLines: 30,
            byRole: { tests: 30 },
            byFunctionalSurface: { test_suite: 30 },
          },
        },
        {
          number: 3,
          title: "unknown one",
          prClass: { class: "unknown", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 20 },
          files: {
            nonGeneratedChangedLines: 20,
            byRole: { unknown: 20 },
            byFunctionalSurface: { runtime: 20 },
          },
        },
        {
          number: 4,
          title: "docs one",
          prClass: { class: "docs", classificationSource: "repository_profile", ruleId: "docs-title" },
          diffAtMerge: { changedLines: 10 },
          files: {
            nonGeneratedChangedLines: 10,
            byRole: { product_docs: 10 },
            byFunctionalSurface: { user_docs: 10 },
          },
        },
      ],
      rankings: {},
    }, {
      workflowContext: { primaryMergeMethod: "merge_commit" },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        selection: { requestedLimit: 30, collectedCount: 4 },
        coverage: { status: "available", sourceFamilies: [] },
      },
      profilePath: "profile.json",
      artifactFileNames: {},
      csvEnabled: false,
    });

    assert(!markdown.includes("## Profile Suggestions"));
    assert(methodology.includes("- No profile suggestion thresholds were triggered by this report's PR class, role, functional-surface, or workflow-coverage evidence."));
  });

  it("suppresses PR class suggestions when unknown class evidence is profile-configured", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 3,
        changedLines: 90,
        nonGeneratedChangedLines: 90,
      },
      pullRequests: [
        {
          number: 1,
          title: "configured unknown one",
          prClass: { class: "unknown", classificationSource: "repository_profile", ruleId: "explicit-unknown" },
          diffAtMerge: { changedLines: 30 },
          files: {
            nonGeneratedChangedLines: 30,
            byRole: { core_product_code: 30 },
            byFunctionalSurface: { runtime: 30 },
          },
        },
        {
          number: 2,
          title: "configured unknown two",
          prClass: { class: "unknown", classificationSource: "repository_profile", ruleId: "explicit-unknown" },
          diffAtMerge: { changedLines: 30 },
          files: {
            nonGeneratedChangedLines: 30,
            byRole: { core_product_code: 30 },
            byFunctionalSurface: { runtime: 30 },
          },
        },
        {
          number: 3,
          title: "configured unknown three",
          prClass: { class: "unknown", classificationSource: "repository_profile", ruleId: "explicit-unknown" },
          diffAtMerge: { changedLines: 30 },
          files: {
            nonGeneratedChangedLines: 30,
            byRole: { tests: 30 },
            byFunctionalSurface: { test_suite: 30 },
          },
        },
      ],
      rankings: {},
    }, {
      workflowContext: { primaryMergeMethod: "merge_commit" },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(!markdown.includes("## Profile Suggestions"));
  });

  it("renders a first-glance opening before detailed bottlenecks", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);

    assertOrderedSections(markdown, [
      "## Executive Summary",
      "## Focus Snapshot",
      "## Recommendation Category Snapshot",
      "## How To Read This Report",
      "## Evidence Quality And Coverage",
      "## Key Findings",
      "## How Bottlenecks Are Prioritized",
      "## Ranked Bottlenecks",
      "## Recommendation Categories",
    ]);
    assert(markdown.includes("| Focus first | Review churn, Repo guidance gap, Change scope |"));
    assert(markdown.includes("| Action categories | Hooks (1), Preflight scripts (1), Repo-specific AI skills (1), PR readiness gates (2), Smaller milestones (2), Planning artifacts (1), Test infrastructure (1) |"));
    assert(markdown.includes("| Evidence reviewed | 3 PRs, 2454 changed lines, 2433 non-generated changed lines, 30 review comments, 25 review threads, 0 failed checks, 1 cancelled workflow run |"));
    assert(markdown.includes("| Confidence caveats | 2 coverage caveats, 4 outlier caveats. Read the evidence and caveat sections before generalizing. |"));
    assert(markdown.includes("Change scope is the internal changed-file-spread signal: core files touched plus directories touched plus functional surfaces touched. It is not a line-count metric."));
  });

  it("keeps observed evidence, diagnosis, and action separate", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(report.guardrails.avoidsIndividualRanking, true);
    assert.equal(report.guardrails.separatesObservedInferredAndSuggested, true);
    assert(Array.isArray(reviewChurn.observedData));
    assert.equal(typeof reviewChurn.inferredDiagnosis, "string");
    assert.equal(reviewChurn.suggestedAction.category, "pr_readiness_gate");
  });

  it("surfaces source evidence and outlier dominance for bottleneck examples", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");
    const topExample = reviewChurn.observedData[0];
    const sharedRankingGroup = report.sharedSignals.groups.find(group => group.type === "ranking_key"
      && group.key === "reviewChurn");

    assert.ok(sharedRankingGroup);
    assert.equal(reviewChurn.dominance.status, "single_pr_dominates");
    assert.equal(reviewChurn.dominance.topPrNumber, 239);
    assert.equal(reviewChurn.dominance.topShare, 0.625);
    assert.equal(
      topExample.validationEvidence.workflowRunSource,
      "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
    );
    assert.deepEqual(topExample.validationEvidence.workflowRunConclusions, [
      { name: "success", value: 8 },
      { name: "cancelled", value: 1 },
    ]);
    assert.equal(topExample.validationEvidence.cancelledWorkflowRuns, 1);
    assert.equal(topExample.reviewEvidence.reviewThreadSource, "graphql:repository.pullRequest.reviewThreads");
    assert.deepEqual(topExample.reviewEvidence.commentSources, [
      { name: "author_reply", value: 15 },
      { name: "copilot", value: 15 },
    ]);
    assert.deepEqual(sharedRankingGroup.bottlenecks.map(bottleneck => bottleneck.id), [
      "review-churn",
      "repo-guidance-gap",
    ]);
  });

  it("adds sensitivity summaries as robustness context without replacing baseline rankings", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);
    const pr239Summary = report.sensitivity.summaries.find(summary => summary.excludedPr.number === 239);

    assert.deepEqual(pr239Summary.baselineTopBottleneckIds, [
      "review-churn",
      "repo-guidance-gap",
      "changed-file-spread",
    ]);
    assert.deepEqual(pr239Summary.topBottleneckIdsWithoutPr, [
      "changed-file-spread",
      "review-churn",
      "repo-guidance-gap",
    ]);
    assert.equal(pr239Summary.changedTopBottlenecks, true);
    assert(pr239Summary.interpretation.includes("outlier-sensitive"));
    assert(markdown.includes("## Outlier And Sensitivity Analysis"));
    assert(markdown.includes("Sensitivity summaries are robustness context only"));
    assert(markdown.includes("| [#239](https://github.com/hannasdev/mcp-writing/pull/239) |"));
  });

  it("reports PR class distribution and class-dominance caveats", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 3,
        changedLines: 700,
        nonGeneratedChangedLines: 700,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "Release 2026.06.14",
          url: "https://example.test/pull/1",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 500 },
          files: { nonGeneratedChangedLines: 500 },
        },
        {
          number: 2,
          title: "Release follow-up",
          url: "https://example.test/pull/2",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 100 },
          files: { nonGeneratedChangedLines: 100 },
        },
        {
          number: 3,
          title: "feature work",
          url: "https://example.test/pull/3",
          prClass: { class: "development", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 100 },
          files: { nonGeneratedChangedLines: 100 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "Release 2026.06.14", value: 10 },
          { number: 2, title: "Release follow-up", value: 8 },
          { number: 3, title: "feature work", value: 2 },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.deepEqual(report.prClasses.distribution.map(entry => ({
      class: entry.class,
      pullRequests: entry.pullRequests,
      changedLines: entry.changedLines,
      share: entry.share,
    })), [
      { class: "release", pullRequests: 2, changedLines: 600, share: 0.667 },
      { class: "development", pullRequests: 1, changedLines: 100, share: 0.333 },
    ]);
    assert.equal(reviewChurn.classDominance.status, "single_class_dominates");
    assert.equal(reviewChurn.classDominance.class, "release");
    assert.equal(reviewChurn.classDominance.topShare, 0.9);
    assert.equal(reviewChurn.classDominance.basis, "score_value");
    assert(reviewChurn.classDominance.note.includes("small-sample caveat"));
    assert.deepEqual(reviewChurn.observedData.map(entry => entry.prClass.class), [
      "release",
      "release",
      "development",
    ]);
    assert(markdown.includes("## PR Class Context"));
    assert(markdown.includes("| release | 2 | 600 | 67% | repository\\_profile=2 |"));
    assert(markdown.includes("| development | 1 | 100 | 33% | fallback\\_rule=1 |"));
    assert(markdown.includes("PR class caveat: Review churn: PR class release contributes 90%"));
    assert(markdown.includes("| [#1](https://example.test/pull/1) | Release 2026.06.14 | 10 | release | unknown | unknown | unknown | 500 |"));
    assert(markdown.includes("\\[configured\\] release (source=repository\\_profile, rule=release-title)"));
  });

  it("keeps filtered empty-state caveats visible before ranked bottlenecks", () => {
    const markdown = renderRepositoryFrictionMarkdown({
      reportVersion: "friction-report.v1",
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      analysisFilter: {
        excludedPrClasses: ["release"],
        originalPullRequests: 5,
        filteredPullRequests: 2,
      },
      summary: {
        pullRequests: 2,
        changedLines: 0,
        nonGeneratedChangedLines: 0,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
        topBottleneckIds: [],
      },
      coverage: {
        prOpenDiff: { unavailable: 2 },
        workflowRuns: { unavailable: 2 },
        reviewThreads: { unavailable: 2 },
        notes: ["Workflow-run coverage is unavailable for this filtered sample."],
      },
      prClasses: {
        totalPullRequests: 0,
        distribution: [],
        note: "No PR class evidence was available.",
      },
      bottlenecks: [],
      recommendationCategories: [
        {
          id: "hooks",
          label: "Hooks",
          triggeredBottlenecks: 0,
          description: "Local hooks for repeated formatting, lint, typecheck, snapshot, or generated-output churn.",
        },
      ],
      commentSources: {
        totalComments: 0,
        botComments: 0,
        humanComments: 0,
        authorReplies: 0,
        bySource: [],
      },
      surfaces: {
        coreChangedLines: 0,
        lowSignalChangedLines: 0,
        lowSignalFiles: 0,
        weightedChangedLines: 0,
        smallDiffWideSpreadCount: 0,
        byFunctionalSurface: [],
        byRole: [],
      },
      guardrails: {
        avoidsIndividualRanking: true,
        separatesObservedInferredAndSuggested: true,
        usesCompositeScore: false,
      },
      followUp: [],
    });

    assertOrderedSections(markdown, [
      "Analysis filter: excluded PR class(es): release.",
      "## Focus Snapshot",
      "## Recommendation Category Snapshot",
      "## Key Findings",
      "## Ranked Bottlenecks",
    ]);
    assert(markdown.includes("| Analysis filter | excluded PR class(es): release; filtered sample 2 of 5 collected PRs |"));
    assert(markdown.includes("| Focus first | No detailed bottleneck evidence was available. |"));
    assert(markdown.includes("| Action categories | none |"));
    assert(markdown.includes("| Confidence caveats | 1 coverage caveat. Read the evidence and caveat sections before generalizing. |"));
    assert(markdown.includes("No recommendation categories were triggered by the displayed bottleneck evidence."));
    assert(markdown.includes("- PR class caveat: PR class context was not available for the analyzed sample."));
    assert(markdown.includes("- Coverage caveat: Workflow-run coverage is unavailable for this filtered sample."));
  });

  it("renders no-caveat focus states without placeholder count syntax", () => {
    const markdown = renderRepositoryFrictionMarkdown({
      reportVersion: "friction-report.v1",
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      summary: {
        pullRequests: 1,
        changedLines: 1,
        nonGeneratedChangedLines: 1,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
        topBottleneckIds: [],
      },
      coverage: {
        prOpenDiff: { observed: 1 },
        workflowRuns: { observed: 1 },
        reviewThreads: { "graphql:repository.pullRequest.reviewThreads": 1 },
        notes: [],
      },
      prClasses: {
        totalPullRequests: 1,
        distribution: [
          {
            class: "development",
            pullRequests: 1,
            changedLines: 1,
            share: 1,
            classificationSources: [{ name: "fallback_rule", value: 1 }],
          },
        ],
        note: "PR class evidence is interpretation context only.",
      },
      bottlenecks: [],
      recommendationCategories: [],
      commentSources: {
        totalComments: 0,
        botComments: 0,
        humanComments: 0,
        authorReplies: 0,
        bySource: [],
      },
      surfaces: {
        coreChangedLines: 1,
        lowSignalChangedLines: 0,
        lowSignalFiles: 0,
        weightedChangedLines: 1,
        smallDiffWideSpreadCount: 0,
        byFunctionalSurface: [],
        byRole: [],
      },
      guardrails: {
        avoidsIndividualRanking: true,
        separatesObservedInferredAndSuggested: true,
        usesCompositeScore: false,
      },
      followUp: [],
    });

    assert(markdown.includes("| Evidence reviewed | 1 PR, 1 changed line, 1 non-generated changed line, 0 review comments, 0 review threads, 0 failed checks, 0 cancelled workflow runs |"));
    assert(markdown.includes("| Confidence caveats | No early confidence caveats were recorded for the displayed evidence. |"));
    assert(!markdown.includes("caveat(s)"));
  });

  it("falls back to displayed example count when displayed ranking scores are unavailable", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 3,
        changedLines: 30,
        nonGeneratedChangedLines: 30,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "Release unavailable one",
          url: "https://example.test/pull/1",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 2,
          title: "Release unavailable two",
          url: "https://example.test/pull/2",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 3,
          title: "Development unavailable",
          url: "https://example.test/pull/3",
          prClass: { class: "development", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "Release unavailable one", value: null },
          { number: 2, title: "Release unavailable two", value: null },
          { number: 3, title: "Development unavailable", value: null },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.classDominance.status, "single_class_dominates");
    assert.equal(reviewChurn.classDominance.class, "release");
    assert.equal(reviewChurn.classDominance.topShare, 0.667);
    assert.equal(reviewChurn.classDominance.basis, "displayed_example_count");
    assert.equal(reviewChurn.classDominance.displayedExamples, 2);
    assert(markdown.includes("PR class release contributes 67% of the displayed example count"));
    assert(markdown.includes("| [#1](https://example.test/pull/1) | Release unavailable one | unknown | release | unknown | unknown | unknown | 10 |"));
  });

  it("falls back to displayed example count when displayed ranking scores are zero", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 3,
        changedLines: 30,
        nonGeneratedChangedLines: 30,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "Release zero one",
          url: "https://example.test/pull/1",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 2,
          title: "Release zero two",
          url: "https://example.test/pull/2",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 3,
          title: "Development zero",
          url: "https://example.test/pull/3",
          prClass: { class: "development", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "Release zero one", value: 0 },
          { number: 2, title: "Release zero two", value: 0 },
          { number: 3, title: "Development zero", value: 0 },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.classDominance.status, "single_class_dominates");
    assert.equal(reviewChurn.classDominance.class, "release");
    assert.equal(reviewChurn.classDominance.topShare, 0.667);
    assert.equal(reviewChurn.classDominance.basis, "displayed_example_count");
    assert.equal(reviewChurn.classDominance.displayedExamples, 2);
    assert(markdown.includes("PR class release contributes 67% of the displayed example count"));
    assert(markdown.includes("| [#1](https://example.test/pull/1) | Release zero one | 0 | release | unknown | unknown | unknown | 10 |"));
  });

  it("keeps class dominance distributed when the rendered share rounds to half", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 2,
        changedLines: 20,
        nonGeneratedChangedLines: 20,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "Release barely over half",
          url: "https://example.test/pull/1",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 2,
          title: "Development nearly half",
          url: "https://example.test/pull/2",
          prClass: { class: "development", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "Release barely over half", value: 5004 },
          { number: 2, title: "Development nearly half", value: 4996 },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.classDominance.status, "distributed");
    assert.equal(reviewChurn.classDominance.topShare, 0.5);
    assert.equal(reviewChurn.classDominance.note, "Displayed examples are not dominated by one PR class.");
    assert(!markdown.includes("PR class release contributes 50%"));
  });

  it("does not render dominant class shares just over half as 50 percent", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 2,
        changedLines: 20,
        nonGeneratedChangedLines: 20,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "Release just over half",
          url: "https://example.test/pull/1",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 2,
          title: "Development just under half",
          url: "https://example.test/pull/2",
          prClass: { class: "development", classificationSource: "fallback_rule", ruleId: null },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "Release just over half", value: 501 },
          { number: 2, title: "Development just under half", value: 499 },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.classDominance.status, "single_class_dominates");
    assert.equal(reviewChurn.classDominance.topShare, 0.501);
    assert(reviewChurn.classDominance.note.includes("PR class release contributes 50.1%"));
    assert(markdown.includes("PR class release contributes 50.1%"));
    assert(!markdown.includes("PR class release contributes 50%"));
  });

  it("does not describe one-class samples as distributed class dominance", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 2,
        changedLines: 20,
        nonGeneratedChangedLines: 20,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "Release one",
          url: "https://example.test/pull/1",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
        {
          number: 2,
          title: "Release two",
          url: "https://example.test/pull/2",
          prClass: { class: "release", classificationSource: "repository_profile", ruleId: "release-title" },
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "Release one", value: 5 },
          { number: 2, title: "Release two", value: 4 },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.classDominance.status, "not_applicable");
    assert.equal(
      reviewChurn.classDominance.note,
      "Only one PR class appears in the analyzed sample; class dominance is not meaningful.",
    );
    assert(markdown.includes("PR class caveat: only one PR class appears in the analyzed sample, so class dominance comparison is not meaningful."));
    assert(!markdown.includes("PR class caveat: displayed bottleneck examples are not dominated by one PR class."));
  });

  it("matches the class-dominance golden report fixture", async () => {
    const [metricsSummary, goldenJson, goldenMarkdown] = await Promise.all([
      readJson("../fixtures/github/mcp-writing/metrics-summary.class-dominance.json"),
      readJson("../fixtures/github/mcp-writing/reports/friction-report.class-dominance.golden.json"),
      readText("../fixtures/github/mcp-writing/reports/friction-report.class-dominance.golden.md"),
    ]);

    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert.deepEqual(report, goldenJson);
    assert.equal(markdown, goldenMarkdown);
    assert(markdown.includes("PR class caveat: Review churn: PR class release contributes 90%"));
  });

  it("counts bot comments even when a bot source is outside displayed source samples", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {},
      pullRequests: [
        {
          number: 8,
          title: "many comment sources",
          url: "https://example.test/pull/8",
          diffAtMerge: { changedLines: 1 },
          review: {
            comments: {
              bySource: {
                author_reply: 10,
                human_reviewer: 9,
                unknown: 8,
                custom_source: 7,
                other_source: 6,
                github_actions_bot: 5,
              },
            },
          },
        },
      ],
      rankings: {
        reviewChurn: [
          {
            number: 8,
            title: "many comment sources",
            value: 2,
          },
        ],
      },
    });
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");
    const topExample = reviewChurn.observedData[0];

    assert.deepEqual(topExample.reviewEvidence.commentSources, [
      { name: "author_reply", value: 10 },
      { name: "human_reviewer", value: 9 },
      { name: "unknown", value: 8 },
      { name: "custom_source", value: 7 },
      { name: "other_source", value: 6 },
    ]);
    assert.equal(topExample.reviewEvidence.botComments, 5);
  });

  it("renders coverage notes, source labels, and caveats in Markdown tables", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(markdown.includes("## Evidence Quality And Coverage"));
    assert(markdown.includes("| PR-open diff | unavailable: 3 |"));
    assert(markdown.includes("#### Review churn Observed Evidence (iteration drag)"));
    assert(markdown.includes("## How Bottlenecks Are Prioritized"));
    assert(markdown.includes("## Shared Signal Interpretation"));
    assert(markdown.includes("- Review churn, Repo guidance gap share the review churn ranking signal"));
    assert(markdown.includes("Recommendation categories remain distinct: PR readiness gates, Repo-specific AI skills."));
    assert(markdown.includes("- Bottlenecks are ordered by their strongest displayed representative score"));
    assert(markdown.includes("## PR Class Context"));
    assert(markdown.includes("| unknown | 3 | 2454 | 100% | fallback\\_rule=3 |"));
    assert(markdown.includes("| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |"));
    assert(
      markdown.includes(
        "| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 20 | unknown | 1168 | 77 | 13 | 1245 |",
      ),
    );
    assert(markdown.includes("| PR | Validation | Review | Source labels |"));
    assert(markdown.includes("\\[observed\\] workflow coverage: observed"));
    assert(markdown.includes("\\[warning\\] 0 failed checks, 0 failed workflows, 1 cancelled workflow runs"));
    assert(markdown.includes("\\[unavailable\\] validation outcome unavailable"));
    assert(markdown.includes("\\[partial\\] threads: 10, resolved: 0, outdated: 0"));
    assert(markdown.includes("\\[observed\\] none from reviews; human reviewers: 0; approved: no; changes requested: no"));
    assert(markdown.includes("comments: \\[observed\\] author\\_reply=15, copilot=15"));
    assert(markdown.includes("comments: \\[partial\\] none in sampled review-thread evidence"));
    assert(markdown.includes("\\[observed\\] unknown (source=fallback\\_rule)"));
    assert(markdown.includes("Review thread source: \\[observed\\] graphql:repository.pullRequest.reviewThreads"));
    assert(markdown.includes("\\[unavailable\\] workflow coverage: unavailable"));
    assert(markdown.includes("\\[unavailable\\] unavailable"));
    assert(markdown.includes("#### Review churn Interpretation And Recommendation"));
    assert(markdown.includes("| Inferred diagnosis | Review loops are concentrated in a small set of PRs. |"));
    assert(
      markdown.includes(
        "| Suggested action | Add or tighten a PR readiness gate for changes that attract repeated review rounds. |",
      ),
    );
    assert(markdown.includes("#### Review churn Confidence And Caveats"));
    assert(markdown.includes("- PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing."));
    assert(
      markdown.includes(
        "- PR-open diff growth is unavailable for PRs without an open-time snapshot or equivalent captured state; final/current PR metadata can still come from GitHub PR data, but open-time size is not reconstructed from merge-time data.",
      ),
    );
    assert(markdown.includes("- Workflow-run coverage is unavailable for some PRs"));
    assert(markdown.includes("- Shares the same representative PR evidence as Repo guidance gap, Review surprise, Fix amplification."));
  });

  it("pins the redacted live-30 calibration sample for source-label regressions", async () => {
    const calibration = await readJson("../fixtures/github/mcp-writing/reports/live-30-calibration.golden.json");
    const coverageByFamily = new Map(calibration.collectionCoverage.sourceFamilies.map(entry => [entry.family, entry]));
    const validationGap = calibration.topBottlenecks.find(bottleneck => bottleneck.id === "validation-gap");
    const reviewChurn = calibration.topBottlenecks.find(bottleneck => bottleneck.id === "review-churn");
    const validationExample = validationGap.observedData[0];
    const reviewExample = reviewChurn.observedData[0];

    assert.equal(calibration.schemaVersion, "github-live-report-calibration.v1");
    assert.equal(calibration.derivedFrom.pullRequests, 30);
    assert.equal(calibration.collectionCoverage.status, "partial");
    assert.equal(coverageByFamily.get("pr_open_diff").status, "unavailable");
    assert.equal(coverageByFamily.get("workflow_runs").attempts, 30);
    assert.equal(
      coverageByFamily.get("workflow_runs").source,
      "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
    );
    assert.equal(coverageByFamily.get("review_threads").source, "graphql:repository.pullRequest.reviewThreads");
    assert.deepEqual(calibration.summary.topBottleneckIds, [
      "validation-gap",
      "local-hook-gap",
      "test-infrastructure-gap",
    ]);
    assert.equal(validationGap.dominance.status, "single_pr_dominates");
    assert.equal(validationGap.dominance.topPrNumber, 214);
    assert.equal(validationGap.dominance.topShare, 0.848);
    assert.deepEqual(validationExample.validationEvidence.workflowRunConclusions, [
      { name: "failure", value: 39 },
      { name: "success", value: 16 },
    ]);
    assert.equal(validationExample.validationEvidence.failedWorkflowRuns, 39);
    assert.equal(reviewExample.reviewEvidence.reviewThreadSource, "graphql:repository.pullRequest.reviewThreads");
    assert.equal(reviewExample.reviewEvidence.reviewThreads, 17);
    assert.deepEqual(reviewExample.reviewEvidence.commentSources, [
      { name: "author_reply", value: 17 },
      { name: "copilot", value: 17 },
    ]);
  });

  it("covers the milestone recommendation categories", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const categories = report.recommendationCategories.map(category => category.id);
    const triggeredCategories = new Set(report.bottlenecks.map(bottleneck => bottleneck.suggestedAction.category));

    assert.deepEqual(categories, [
      "hooks",
      "preflight_scripts",
      "repo_specific_ai_skills",
      "pr_readiness_gate",
      "smaller_milestones",
      "planning_artifacts",
      "test_infrastructure",
    ]);
    for (const category of categories) {
      assert(triggeredCategories.has(category), `expected fixture report to trigger ${category}`);
    }
  });

  it("ranks bottlenecks by strongest observed signal instead of definition order", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {},
      pullRequests: [
        {
          number: 1,
          title: "mild review churn",
          url: "https://example.test/pull/1",
          diffAtMerge: { changedLines: 10 },
        },
        {
          number: 2,
          title: "severe validation gap",
          url: "https://example.test/pull/2",
          diffAtMerge: { changedLines: 20 },
        },
      ],
      rankings: {
        reviewChurn: [{ number: 1, title: "mild review churn", value: 1 }],
        validationGap: [{ number: 2, title: "severe validation gap", value: 99 }],
      },
    });

    assert.equal(report.bottlenecks[0].id, "validation-gap");
    assert.deepEqual(report.summary.topBottleneckIds, [
      "validation-gap",
      "local-hook-gap",
      "test-infrastructure-gap",
    ]);
  });

  it("does not flag exact evidence ties as single-PR dominance", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {},
      pullRequests: [
        {
          number: 1,
          title: "first equal review",
          url: "https://example.test/pull/1",
          diffAtMerge: { changedLines: 10 },
        },
        {
          number: 2,
          title: "second equal review",
          url: "https://example.test/pull/2",
          diffAtMerge: { changedLines: 20 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "first equal review", value: 10 },
          { number: 2, title: "second equal review", value: 10 },
        ],
      },
    });
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.dominance.status, "distributed");
    assert.equal(reviewChurn.dominance.topShare, 0.5);
    assert.equal(reviewChurn.dominance.note, "Displayed examples are not dominated by one PR.");
  });

  it("classifies dominance using the raw share before rounding the display value", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {},
      pullRequests: [
        {
          number: 1,
          title: "bare majority review",
          url: "https://example.test/pull/1",
          diffAtMerge: { changedLines: 10 },
        },
        {
          number: 2,
          title: "near equal review",
          url: "https://example.test/pull/2",
          diffAtMerge: { changedLines: 20 },
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "bare majority review", value: 1251 },
          { number: 2, title: "near equal review", value: 1249 },
        ],
      },
    });
    const reviewChurn = report.bottlenecks.find(bottleneck => bottleneck.id === "review-churn");

    assert.equal(reviewChurn.dominance.status, "single_pr_dominates");
    assert.equal(reviewChurn.dominance.topShare, 0.5);
  });

  it("labels shared representative evidence regardless of PR ordering", () => {
    const markdown = renderRepositoryFrictionMarkdown({
      reportVersion: "friction-report.v1",
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      summary: {
        pullRequests: 2,
        changedLines: 3,
        nonGeneratedChangedLines: 3,
        reviewComments: 0,
        reviewThreads: 0,
        topBottleneckIds: ["review-churn", "repo-guidance-gap"],
      },
      bottlenecks: [
        {
          id: "review-churn",
          title: "Review churn",
          metricLabel: "iteration drag",
          observedData: [
            { number: 7, title: "first PR", value: 2, changedLines: 1 },
            { number: 9, title: "second PR", value: 1, changedLines: 2 },
          ],
          inferredDiagnosis: "Review loops are concentrated in a small set of PRs.",
          suggestedAction: {
            category: "pr_readiness_gate",
            action: "Add or tighten a PR readiness gate.",
          },
        },
        {
          id: "repo-guidance-gap",
          title: "Repo guidance gap",
          metricLabel: "iteration drag",
          observedData: [
            { number: 9, title: "second PR", value: 1, changedLines: 2 },
            { number: 7, title: "first PR", value: 2, changedLines: 1 },
          ],
          inferredDiagnosis: "Repeated review loops suggest missing repository guidance.",
          suggestedAction: {
            category: "repo_specific_ai_skills",
            action: "Add repo-specific AI skills.",
          },
        },
      ],
      recommendationCategories: [],
      commentSources: {
        totalComments: 0,
        botComments: 0,
        humanComments: 0,
        authorReplies: 0,
        bySource: [],
      },
      surfaces: {
        coreChangedLines: 3,
        lowSignalChangedLines: 0,
        lowSignalFiles: 0,
        weightedChangedLines: 3,
        smallDiffWideSpreadCount: 0,
        byFunctionalSurface: [],
        byRole: [],
      },
      coverage: {
        prOpenDiff: { unavailable: 2 },
        workflowRuns: { unavailable: 2 },
        reviewThreads: { unavailable: 2 },
        notes: [],
      },
      guardrails: {
        avoidsIndividualRanking: true,
        separatesObservedInferredAndSuggested: true,
        usesCompositeScore: false,
      },
      followUp: [],
    });

    assert(markdown.includes("- Shares the same representative PR evidence as Repo guidance gap."));
    assert(markdown.includes("- Shares the same representative PR evidence as Review churn."));
    assert(markdown.includes("## Shared Signal Interpretation"));
    assert(
      markdown.includes(
        "- Review churn, Repo guidance gap display the same representative PR evidence (#7, #9); keep recommendation actions distinct while reading the shared evidence as one underlying signal. Recommendation categories remain distinct: PR readiness gates, Repo-specific AI skills.",
      ),
    );
  });

  it("renders legacy observed examples without nested evidence fields", () => {
    const markdown = renderRepositoryFrictionMarkdown({
      reportVersion: "friction-report.v1",
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      summary: {
        pullRequests: 1,
        changedLines: 1,
        nonGeneratedChangedLines: 1,
        reviewComments: 0,
        reviewThreads: 0,
        topBottleneckIds: ["review-churn"],
      },
      bottlenecks: [
        {
          id: "review-churn",
          title: "Review churn",
          metricLabel: "iteration drag",
          observedData: [
            {
              number: 7,
              title: "legacy evidence shape",
              value: 2,
              changedLines: 1,
            },
          ],
          inferredDiagnosis: "Review loops are concentrated in a small set of PRs.",
          suggestedAction: {
            action: "Add or tighten a PR readiness gate.",
          },
        },
      ],
      recommendationCategories: [],
      commentSources: {
        totalComments: 0,
        botComments: 0,
        humanComments: 0,
        authorReplies: 0,
        bySource: [],
      },
      surfaces: {
        coreChangedLines: 1,
        lowSignalChangedLines: 0,
        lowSignalFiles: 0,
        weightedChangedLines: 1,
        smallDiffWideSpreadCount: 0,
        byFunctionalSurface: [],
        byRole: [],
      },
      coverage: {
        prOpenDiff: { unavailable: 1 },
        workflowRuns: { unavailable: 1 },
        reviewThreads: { unavailable: 1 },
        notes: [],
      },
      guardrails: {
        avoidsIndividualRanking: true,
        separatesObservedInferredAndSuggested: true,
        usesCompositeScore: false,
      },
      followUp: [],
    });

    assert(markdown.includes("| #7 | legacy evidence shape | 2 | unknown | unknown | unknown | unknown | 1 |"));
    assert(markdown.includes("Recommendation category: unspecified"));
    assert(!markdown.includes("Recommendation category: undefined"));
    assert(markdown.includes("| #7 | \\[unavailable\\] workflow coverage: unavailable; \\[unavailable\\] validation outcome unavailable; conclusions: none |"));
    assert(markdown.includes("\\[unavailable\\] threads: 0, resolved: 0, outdated: 0"));
    assert(markdown.includes("\\[unavailable\\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable"));
    assert(markdown.includes("comments: \\[unavailable\\] comment sources unavailable"));
    assert(markdown.includes("\\[observed\\] unknown (source=fallback\\_rule)"));
    assert(!markdown.includes("- Review source: unavailable"));
    assert(markdown.includes("- Not enough positive examples to evaluate outlier dominance."));
  });

  it("escapes Markdown metacharacters in representative PR titles", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {},
      pullRequests: [
        {
          number: 7,
          title: "fix *markdown* [link](https://example.test) `code`",
          url: "https://example.test/pull/7",
          diffAtMerge: { changedLines: 1 },
        },
      ],
      rankings: {
        reviewChurn: [
          {
            number: 7,
            title: "fix *markdown* [link](https://example.test) `code`",
            value: 2,
          },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(
      markdown.includes(
        "| [#7](https://example.test/pull/7) | fix \\*markdown\\* \\[link\\](https://example.test) \\`code\\` | 2 | unknown | unknown | unknown | unknown | 1 |",
      ),
    );
  });

  it("escapes backslashes before Markdown metacharacters in PR titles", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {},
      pullRequests: [
        {
          number: 7,
          title: String.raw`fix \*literal\* [link] and ` + "`code`",
          url: "https://example.test/pull/7",
          diffAtMerge: { changedLines: 1 },
        },
      ],
      rankings: {
        reviewChurn: [
          {
            number: 7,
            title: String.raw`fix \*literal\* [link] and ` + "`code`",
            value: 2,
          },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(
      markdown.includes(
        String.raw`| [#7](https://example.test/pull/7) | fix \\\*literal\\\* \[link\] and \`code\` | 2 | unknown | unknown | unknown | unknown | 1 |`,
      ),
    );
  });

  it("renders methodology with run-specific facts and artifact names", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = {
      ...generateRepositoryFrictionReport(metricsSummary),
      collectionCoverage: {
        status: "partial",
        sourceFamilies: [
          {
            family: "workflow_runs",
            status: "available",
            attempts: 3,
            source: "rest:actions",
            diagnostics: [],
            downstreamImpact: "validation evidence populated",
          },
        ],
      },
    };

    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle: {
        source: {
          kind: "sample",
          label: "Bundled synthetic sample, not live GitHub data",
        },
        selection: { requestedLimit: 30, collectedCount: 3 },
        coverage: report.collectionCoverage,
      },
      profilePath: "fixtures/github/mcp-writing/profile.json",
      artifactFileNames: {
        reportMarkdown: "friction-report.md",
        reportJson: "friction-report.json",
        methodology: "methodology.md",
        sourceBundle: "source-bundle.json",
        normalized: "normalized.json",
        metricsSummary: "metrics-summary.json",
        prMetricsCsv: "pr-metrics.csv",
        bottleneckExamplesCsv: "bottleneck-examples.csv",
        commentSourcesCsv: "comment-sources.csv",
        collectionCoverageCsv: "collection-coverage.csv",
      },
      csvEnabled: true,
    });
    const markdown = renderRepositoryFrictionMarkdown({
      ...report,
      source: {
        kind: "sample",
        label: "Bundled synthetic sample, not live GitHub data",
      },
    });

    assert(methodology.includes("# Methodology: hannasdev/mcp-writing"));
    assert(methodology.includes("Source: Bundled synthetic sample, not live GitHub data (sample)"));
    assert(markdown.includes("Source: Bundled synthetic sample, not live GitHub data (sample)"));
    assert(markdown.includes("- Observed evidence is measured from source-bundle evidence and repository-profile classifications."));
    assert(markdown.includes("- Missing or partial source evidence remains visible in coverage tables rather than being inferred from unrelated fields."));
    assert(!markdown.includes("Observed evidence is measured from GitHub data"));
    assert(!markdown.includes("Missing or partial GitHub data"));
    assert(methodology.includes("Profile path: fixtures/github/mcp-writing/profile.json"));
    assert(methodology.includes("Requested pull requests: 30"));
    assert(methodology.includes("The analyzer normalizes source-bundle pull request evidence"));
    assert(methodology.includes("- workflow_runs: available; attempts=3; source=rest:actions."));
    assert(methodology.includes("- PR metrics CSV: `pr-metrics.csv`"));
    assert(methodology.includes("PR #239"));
  });

  it("generates curated deterministic CSV exports without raw comment text", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const csvArtifacts = generateEvidenceCsvArtifacts({
      metricsSummary,
      report,
      collectionCoverage: {
        sourceFamilies: [
          {
            family: "workflow_runs",
            status: "available",
            attempts: 3,
            source: "rest:actions",
            diagnostics: ["sampled"],
            downstreamImpact: "validation evidence populated",
          },
        ],
      },
    });

    assert(csvArtifacts.prMetricsCsv.startsWith([
      "pr_number",
      "title",
      "url",
      "pr_class",
      "pr_classification_source",
      "pr_class_rule_id",
      "changed_lines",
      "non_generated_changed_lines",
      "review_comments",
      "review_threads",
      "review_decision",
      "human_reviewer_count",
      "human_approved",
      "human_changes_requested",
      "failed_checks",
      "failed_workflow_runs",
      "cancelled_workflow_runs",
      "post_review_commits",
    ].join(",")));
    assert(csvArtifacts.prMetricsCsv.includes("239,feat: resolve scene vocabulary variants,https://github.com/hannasdev/mcp-writing/pull/239,unknown,fallback_rule,,1245"));
    assert(csvArtifacts.bottleneckExamplesCsv.includes("review-churn,Review churn,pr_readiness_gate,239"));
    assert(csvArtifacts.bottleneckExamplesCsv.includes(",rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request,observed,graphql:repository.pullRequest.reviewThreads,"));
    assert(csvArtifacts.commentSourcesCsv.includes("copilot,15,true,false,0.5"));
    assert(csvArtifacts.collectionCoverageCsv.startsWith("source_family,status,attempts,source,diagnostics,downstream_impact"));
    assert(csvArtifacts.collectionCoverageCsv.includes("workflow_runs,available,3,rest:actions,sampled,validation evidence populated"));
    assert(!csvArtifacts.bottleneckExamplesCsv.includes("raw comment"));
  });

  it("renders the tutorial sample report with synthetic labels, caveats, and CSV evidence", async () => {
    const [sourceBundle, profile, excerpt] = await Promise.all([
      readJson("../examples/tutorial/source-bundle.json"),
      readJson("../examples/tutorial/profile.json"),
      readText("../examples/tutorial/report-excerpt.md"),
    ]);
    const normalized = normalizeFixtureBundle(sourceBundle, { repositoryProfile: profile });
    const metricsSummary = computeRepositoryMetrics(normalized);
    const report = {
      ...generateRepositoryFrictionReport(metricsSummary, {
        workflowContext: profile.workflow,
        contributorSource: normalized.contributorSource,
      }),
      source: sourceBundle.source,
      collectionCoverage: sourceBundle.coverage,
    };
    const markdown = renderRepositoryFrictionMarkdown(report);
    const methodology = renderRepositoryFrictionMethodology({
      report,
      sourceBundle,
      profilePath: "examples/tutorial/profile.json",
      artifactFileNames: {
        reportMarkdown: "friction-report.md",
        reportJson: "friction-report.json",
        methodology: "methodology.md",
        sourceBundle: "source-bundle.json",
        normalized: "normalized.json",
        metricsSummary: "metrics-summary.json",
        prMetricsCsv: "pr-metrics.csv",
        bottleneckExamplesCsv: "bottleneck-examples.csv",
        commentSourcesCsv: "comment-sources.csv",
        collectionCoverageCsv: "collection-coverage.csv",
      },
      csvEnabled: true,
    });
    const csvArtifacts = generateEvidenceCsvArtifacts({
      metricsSummary,
      report,
      collectionCoverage: sourceBundle.coverage,
    });

    assert(markdown.startsWith("# Repository Friction Report: example-org/delivery-dashboard"));
    assert(markdown.includes("Source: Bundled synthetic sample, not live GitHub data (sample)"));
    assert(markdown.includes("## Executive Summary"));
    assert(markdown.includes("| Top findings | Review churn, Repo guidance gap, Change scope |"));
    assert(markdown.includes("## Focus Snapshot"));
    assert(markdown.includes("| Focus first | Review churn, Repo guidance gap, Change scope |"));
    assert(markdown.includes("Change scope"));
    assert(markdown.includes("Validation gap"));
    assert(markdown.includes("Review churn"));
    assert(markdown.includes("Outlier caveat:"));
    assert(markdown.includes("PR #104 contributes"));
    assert(markdown.includes("## Outlier And Sensitivity Analysis"));
    assert(markdown.includes("## Workflow Data Caveats"));
    assert(markdown.includes("Workflow-run coverage is unavailable for some PRs"));
    assert(markdown.includes("| PR-open diff | computed: 3, unavailable: 1 |"));
    assert(markdown.includes("| feature | 2 |"));
    assert(markdown.includes("| Primary merge method | Squash merge |"));
    assert(markdown.includes("| delivery\\_api |"));
    assert(markdown.includes("https://example.com/pull/104"));
    assert(methodology.includes("Source: Bundled synthetic sample, not live GitHub data (sample)"));
    assert(methodology.includes("Collection coverage: partial"));
    assert(methodology.includes("- workflow_runs: partial; attempts=1; source=bundled tutorial sample."));
    assert(methodology.includes("Profile path: examples/tutorial/profile.json"));
    assert(csvArtifacts.prMetricsCsv.includes("104,feat: consolidate dispatch settings,https://example.com/pull/104,feature,repository_profile,feature-title,1400"));
    assert(csvArtifacts.collectionCoverageCsv.includes("workflow_runs,partial,1,bundled tutorial sample"));
    assert(excerpt.includes("Bundled synthetic sample, not live GitHub data"));
    assert(excerpt.includes("Review churn, Repo guidance gap, and Change scope"));
    assert(!excerpt.includes("change scope, validation gap, and review churn"));
    assert(excerpt.includes("PR #104 is intentionally broad and outlier-sensitive"));
  });

  it("renders review decision evidence for zero-thread human approvals", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 1,
        changedLines: 10,
        nonGeneratedChangedLines: 10,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 9,
          title: "clean approval",
          url: "https://example.test/pull/9",
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
          review: {
            decision: {
              state: "approved",
              humanApproved: true,
              humanChangesRequested: false,
              humanReviewerCount: 1,
              source: "reviews",
            },
            comments: { totalCount: 0, bySource: {} },
            threads: {
              source: "graphql:repository.pullRequest.reviewThreads",
              totalCount: 0,
              resolvedCount: 0,
              outdatedCount: 0,
            },
          },
          ci: {
            checkRuns: { failedCount: 0 },
            workflowRuns: {
              source: "unavailable",
              coverage: "unavailable",
              failedCount: 0,
              cancelledCount: 0,
              conclusions: {},
            },
          },
          iteration: { commitsAfterFirstReview: 1 },
          components: {},
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 9, title: "clean approval", value: 1 },
        ],
      },
    });
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(markdown.includes("\\[observed\\] threads: 0, resolved: 0, outdated: 0"));
    assert(markdown.includes("Review thread source: \\[observed\\] graphql:repository.pullRequest.reviewThreads"));
    assert(markdown.includes("\\[observed\\] approved from reviews; human reviewers: 1; approved: yes; changes requested: no; \\[healthy\\] human approval observed"));
    assert(markdown.includes("comments: \\[observed\\] none"));
  });

  it("leaves unavailable CSV counts empty while preserving source labels", () => {
    const metricsSummary = {
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisPullRequestLimit: 30,
      },
      totals: {
        pullRequests: 2,
        changedLines: 20,
        nonGeneratedChangedLines: 20,
        reviewComments: 0,
        reviewThreads: 0,
        failedChecks: 0,
        cancelledWorkflowRuns: 0,
      },
      pullRequests: [
        {
          number: 1,
          title: "unavailable coverage",
          url: "https://example.test/pull/1",
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
          review: {
            decision: {
              state: "unavailable",
              humanApproved: false,
              humanChangesRequested: false,
              humanReviewerCount: 0,
              source: "unavailable",
            },
            comments: { totalCount: 0, bySource: {} },
            threads: {
              source: "unavailable",
              totalCount: 0,
              resolvedCount: 0,
              outdatedCount: 0,
            },
          },
          ci: {
            checkRuns: { failedCount: 0 },
            workflowRuns: {
              source: "unavailable",
              coverage: "unavailable",
              failedCount: 0,
              cancelledCount: 0,
              conclusions: {},
            },
          },
          iteration: { commitsAfterFirstReview: null },
          components: {},
        },
        {
          number: 2,
          title: "observed zero coverage",
          url: "https://example.test/pull/2",
          diffAtMerge: { changedLines: 10 },
          files: { nonGeneratedChangedLines: 10 },
          review: {
            decision: {
              state: "none",
              humanApproved: false,
              humanChangesRequested: false,
              humanReviewerCount: 0,
              source: "reviews",
            },
            comments: { totalCount: 0, bySource: {} },
            threads: {
              source: "graphql:repository.pullRequest.reviewThreads",
              totalCount: 0,
              resolvedCount: 0,
              outdatedCount: 0,
            },
          },
          ci: {
            checkRuns: { failedCount: 0 },
            workflowRuns: {
              source: "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
              coverage: "observed",
              failedCount: 0,
              cancelledCount: 0,
              conclusions: {},
            },
          },
          iteration: { commitsAfterFirstReview: 0 },
          components: {},
        },
      ],
      rankings: {
        reviewChurn: [
          { number: 1, title: "unavailable coverage", value: 1 },
          { number: 2, title: "observed zero coverage", value: 1 },
        ],
      },
    };
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);
    const csvArtifacts = generateEvidenceCsvArtifacts({
      metricsSummary,
      report,
      collectionCoverage: { sourceFamilies: [] },
    });

    assert(markdown.includes("\\[unavailable\\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable"));
    assert(markdown.includes("\\[observed\\] none from reviews; human reviewers: 0; approved: no; changes requested: no"));
    assert(csvArtifacts.prMetricsCsv.includes(
      "1,unavailable coverage,https://example.test/pull/1,unknown,fallback_rule,,10,10,0,,unavailable,,,,0,,,,unavailable,unavailable,unavailable",
    ));
    assert(csvArtifacts.prMetricsCsv.includes(
      "2,observed zero coverage,https://example.test/pull/2,unknown,fallback_rule,,10,10,0,0,none,0,false,false,0,0,0,0,graphql:repository.pullRequest.reviewThreads,rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request,observed",
    ));
    assert(csvArtifacts.bottleneckExamplesCsv.includes(
      "review-churn,Review churn,pr_readiness_gate,1,unavailable coverage,https://example.test/pull/1,1,10,0,,,",
    ));
    assert(csvArtifacts.bottleneckExamplesCsv.includes(
      "review-churn,Review churn,pr_readiness_gate,2,observed zero coverage,https://example.test/pull/2,1,10,0,0,0,0,0,0",
    ));
  });

  it("escapes CSV fields containing commas, quotes, and newlines", () => {
    const csvArtifacts = generateEvidenceCsvArtifacts({
      metricsSummary: {
        rankings: {},
        pullRequests: [
          {
            number: 7,
            title: "fix \"quoted\", multiline\nvalue",
            url: "https://example.test/pull/7",
            diffAtMerge: { changedLines: 1 },
            files: { nonGeneratedChangedLines: 1 },
            review: { comments: { totalCount: 0 }, threads: { source: "unavailable" } },
            ci: {
              checkRuns: { failedCount: 0 },
              workflowRuns: { source: "unavailable", coverage: "unavailable" },
            },
            iteration: { commitsAfterFirstReview: null },
          },
        ],
      },
      report: {
        commentSources: { totalComments: 0, bySource: [] },
        bottlenecks: [],
      },
      collectionCoverage: {
        sourceFamilies: [
          {
            family: "workflow_runs",
            status: "partial",
            attempts: 1,
            source: "rest:actions",
            diagnostics: ["warning, \"quoted\"\nline"],
            downstreamImpact: "partial evidence",
          },
        ],
      },
    });

    assert(csvArtifacts.prMetricsCsv.includes("\"fix \"\"quoted\"\", multiline\nvalue\""));
    assert(csvArtifacts.collectionCoverageCsv.includes("\"warning, \"\"quoted\"\"\nline\""));
  });

  it("mitigates spreadsheet formula injection in CSV text fields", () => {
    const csvArtifacts = generateEvidenceCsvArtifacts({
      metricsSummary: {
        rankings: {},
        pullRequests: [
          {
            number: 7,
            title: " =IMPORTXML(\"https://example.test\")",
            url: "+https://example.test/pull/7",
            diffAtMerge: { changedLines: -1 },
            files: { nonGeneratedChangedLines: 1 },
            review: { comments: { totalCount: 0 }, threads: { source: "unavailable" } },
            ci: {
              checkRuns: { failedCount: 0 },
              workflowRuns: { source: "unavailable", coverage: "unavailable" },
            },
            iteration: { commitsAfterFirstReview: null },
          },
        ],
      },
      report: {
        commentSources: {
          totalComments: 1,
          bySource: [
            { name: "@scanner", value: 1 },
          ],
        },
        bottlenecks: [],
      },
      collectionCoverage: {
        sourceFamilies: [
          {
            family: "workflow_runs",
            status: "partial",
            attempts: 1,
            source: "\tgraphql",
            diagnostics: ["-looks like formula"],
            downstreamImpact: "partial evidence",
          },
        ],
      },
    });

    assert(csvArtifacts.prMetricsCsv.includes("7,\"' =IMPORTXML(\"\"https://example.test\"\")\",'+https://example.test/pull/7,unknown,fallback_rule,,-1"));
    assert(csvArtifacts.commentSourcesCsv.includes("'@scanner,1,false,false,1"));
    assert(csvArtifacts.collectionCoverageCsv.includes("'\tgraphql,'-looks like formula,partial evidence"));
  });

  it("writes local JSON and Markdown report artifacts from a metrics summary", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "friction-report-"));
    try {
      const jsonOutPath = join(tempDirectory, "report.json");
      const markdownOutPath = join(tempDirectory, "report.md");

      await writeRepositoryFrictionReport({
        metricsSummaryPath: new URL("../fixtures/github/mcp-writing/metrics-summary.golden.json", import.meta.url),
        jsonOutPath,
        markdownOutPath,
      });

      const [writtenJson, writtenMarkdown, goldenJson, goldenMarkdown] = await Promise.all([
        readFile(jsonOutPath, "utf8"),
        readFile(markdownOutPath, "utf8"),
        readText("../fixtures/github/mcp-writing/reports/friction-report.golden.json"),
        readText("../fixtures/github/mcp-writing/reports/friction-report.golden.md"),
      ]);

      assert.equal(writtenJson, goldenJson);
      assert.equal(writtenMarkdown, goldenMarkdown);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("rejects unknown CLI flags without writing report artifacts", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "friction-report-"));
    try {
      const jsonOutPath = join(tempDirectory, "report.json");
      const markdownOutPath = join(tempDirectory, "report.md");

      await assert.rejects(
        execFileAsync("node", [
          fileURLToPath(new URL("../src/report/generate-report.js", import.meta.url)),
          "--unknown",
          "value",
          "--metrics-summary",
          fileURLToPath(new URL("../fixtures/github/mcp-writing/metrics-summary.golden.json", import.meta.url)),
          "--json-out",
          jsonOutPath,
          "--markdown-out",
          markdownOutPath,
        ]),
        error => {
          assert.match(String(error.stderr), /Unknown option: --unknown/);
          return true;
        },
      );

      await assert.rejects(readFile(jsonOutPath, "utf8"), { code: "ENOENT" });
      await assert.rejects(readFile(markdownOutPath, "utf8"), { code: "ENOENT" });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});

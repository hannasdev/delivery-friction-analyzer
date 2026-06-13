import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
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

  it("counts bot comments even when a bot source is outside displayed source samples", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisWindowDays: 30,
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
    assert(markdown.includes("| PR | Title | Score | Additions | Deletions | Files changed | Changed lines |"));
    assert(
      markdown.includes(
        "| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 20 | 1168 | 77 | 13 | 1245 |",
      ),
    );
    assert(markdown.includes("Evidence details for PR #239:"));
    assert(markdown.includes("- Workflow coverage: observed"));
    assert(markdown.includes("- Workflow conclusions: success=8, cancelled=1"));
    assert(markdown.includes("- Review thread source: graphql:repository.pullRequest.reviewThreads"));
    assert(markdown.includes("- Threads: 15\n- Resolved threads: 15\n- Outdated threads: 10"));
    assert(markdown.includes("- Review decision: none (source: reviews)"));
    assert(markdown.includes("- Human reviewers: 0"));
    assert(markdown.includes("- Comment sources: author\\_reply=15, copilot=15"));
    assert(markdown.includes("- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\\_request"));
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
        "- PR-open diff growth is unavailable for PRs without captured or reconstructed open-time snapshots; it is not inferred from merge-time data.",
      ),
    );
    assert(markdown.includes("- Workflow-run coverage is unavailable for some PRs"));
    assert(markdown.includes("- Shares the same representative PR evidence as Repo guidance gap, Review surprise, Fix amplification."));
  });

  it("pins the redacted live-30 calibration sample for source-label regressions", async () => {
    const calibration = await readJson("../fixtures/github/mcp-writing/reports/live-30-calibration.golden.json");
    const coverageByFamily = new Map(calibration.collectionCoverage.apiFamilies.map(entry => [entry.family, entry]));
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
        analysisWindowDays: 30,
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
        analysisWindowDays: 30,
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
        analysisWindowDays: 30,
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
        analysisWindowDays: 30,
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
        analysisWindowDays: 30,
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

    assert(markdown.includes("| #7 | legacy evidence shape | 2 | unknown | unknown | unknown | 1 |"));
    assert(markdown.includes("Recommendation category: unspecified"));
    assert(!markdown.includes("Recommendation category: undefined"));
    assert(markdown.includes("- Workflow coverage: unavailable"));
    assert(markdown.includes("- Workflow conclusions: none"));
    assert(markdown.includes("- Failed checks: 0"));
    assert(markdown.includes("- Failed workflows: 0"));
    assert(markdown.includes("- Cancelled workflows: 0"));
    assert(markdown.includes("- Threads: 0"));
    assert(markdown.includes("- Resolved threads: 0"));
    assert(markdown.includes("- Outdated threads: 0"));
    assert(markdown.includes("- Comment sources: none"));
    assert(markdown.includes("- Workflow source: unavailable"));
    assert(!markdown.includes("- Review source: unavailable"));
    assert(markdown.includes("- Not enough positive examples to evaluate outlier dominance."));
  });

  it("escapes Markdown metacharacters in representative PR titles", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisWindowDays: 30,
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
        "| [#7](https://example.test/pull/7) | fix \\*markdown\\* \\[link\\](https://example.test) \\`code\\` | 2 | unknown | unknown | unknown | 1 |",
      ),
    );
  });

  it("renders methodology with run-specific facts and artifact names", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = {
      ...generateRepositoryFrictionReport(metricsSummary),
      collectionCoverage: {
        status: "partial",
        apiFamilies: [
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

    assert(methodology.includes("# Methodology: hannasdev/mcp-writing"));
    assert(methodology.includes("Profile path: fixtures/github/mcp-writing/profile.json"));
    assert(methodology.includes("Requested pull requests: 30"));
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
        apiFamilies: [
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
    assert(csvArtifacts.prMetricsCsv.includes("239,feat: resolve scene vocabulary variants,https://github.com/hannasdev/mcp-writing/pull/239,1245"));
    assert(csvArtifacts.bottleneckExamplesCsv.includes("review-churn,Review churn,pr_readiness_gate,239"));
    assert(csvArtifacts.bottleneckExamplesCsv.includes(",rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request,observed,graphql:repository.pullRequest.reviewThreads,"));
    assert(csvArtifacts.commentSourcesCsv.includes("copilot,15,true,false,0.5"));
    assert(csvArtifacts.collectionCoverageCsv.includes("workflow_runs,available,3,rest:actions,sampled,validation evidence populated"));
    assert(!csvArtifacts.bottleneckExamplesCsv.includes("raw comment"));
  });

  it("renders review decision evidence for zero-thread human approvals", () => {
    const report = generateRepositoryFrictionReport({
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisWindowDays: 30,
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

    assert(markdown.includes("- Threads: 0"));
    assert(markdown.includes("- Review decision: approved (source: reviews)"));
    assert(markdown.includes("- Human reviewers: 1"));
    assert(markdown.includes("- Human approved: yes"));
    assert(markdown.includes("- Human changes requested: no"));
  });

  it("leaves unavailable CSV counts empty while preserving source labels", () => {
    const metricsSummary = {
      metricVersion: "friction-metrics.v1",
      targetRepository: {
        owner: "example",
        name: "target",
        analysisWindowDays: 30,
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
      collectionCoverage: { apiFamilies: [] },
    });

    assert(markdown.includes("- Review decision: unavailable (source: unavailable)"));
    assert(markdown.includes("- Human reviewers: unavailable"));
    assert(markdown.includes("- Human approved: unavailable"));
    assert(markdown.includes("- Human changes requested: unavailable"));
    assert(markdown.includes("- Review decision: none (source: reviews)"));
    assert(markdown.includes("- Human reviewers: 0"));
    assert(markdown.includes("- Human approved: no"));
    assert(markdown.includes("- Human changes requested: no"));
    assert(csvArtifacts.prMetricsCsv.includes(
      "1,unavailable coverage,https://example.test/pull/1,10,10,0,,unavailable,,,,0,,,,unavailable,unavailable,unavailable",
    ));
    assert(csvArtifacts.prMetricsCsv.includes(
      "2,observed zero coverage,https://example.test/pull/2,10,10,0,0,none,0,false,false,0,0,0,0,graphql:repository.pullRequest.reviewThreads,rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request,observed",
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
        apiFamilies: [
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
        apiFamilies: [
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

    assert(csvArtifacts.prMetricsCsv.includes("7,\"' =IMPORTXML(\"\"https://example.test\"\")\",'+https://example.test/pull/7,-1"));
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

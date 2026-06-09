import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
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
  });

  it("renders coverage notes, source labels, and dominance notes in Markdown", async () => {
    const metricsSummary = await readJson("../fixtures/github/mcp-writing/metrics-summary.golden.json");
    const report = generateRepositoryFrictionReport(metricsSummary);
    const markdown = renderRepositoryFrictionMarkdown(report);

    assert(markdown.includes("Dominance note: PR #239 contributes 63% of the displayed signal"));
    assert(
      markdown.includes(
        "Validation: workflow source rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request; coverage observed; conclusions success=8, cancelled=1",
      ),
    );
    assert(
      markdown.includes(
        "Review: thread source graphql:repository.pullRequest.reviewThreads; threads 15; resolved 15; outdated 10; comments author_reply=15, copilot=15",
      ),
    );
    assert(
      markdown.includes(
        "- PR-open diff growth is unavailable for some PRs and is not inferred from merge-time data.",
      ),
    );
    assert(markdown.includes("- Workflow-run coverage is unavailable for some PRs"));
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
      markdown.includes("- PR #7: fix \\*markdown\\* \\[link\\](https://example.test) \\`code\\` (2; 1 changed lines)"),
    );
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

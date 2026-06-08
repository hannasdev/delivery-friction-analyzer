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

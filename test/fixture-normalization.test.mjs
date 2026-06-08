import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
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
    assert.equal(pr239.reviewComments.bySource.human_reviewer, 15);
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
});

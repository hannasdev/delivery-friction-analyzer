import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { classifyFilePath } from "../src/profile/file-role.js";
import {
  assertValidContributorSource,
  contributorHintsFromSource,
  parseAllContributorsHints,
  validateContributorSource,
} from "../src/profile/contributor-source.js";
import { assertValidPrClassRules, classifyPullRequest, validatePrClassRules } from "../src/profile/pr-class.js";
import { conventionalCommitPrClassRules } from "../src/profile/pr-class-presets.js";
import {
  assertValidRepositoryProfile,
  validateFileRoleRules,
  validateRepositoryProfile,
} from "../src/profile/repository-profile.js";
import { assertValidWorkflowContext, validateWorkflowContext } from "../src/profile/workflow.js";
import { classifyCommentSource } from "../src/github/comment-source.js";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

describe("repository profile classification", () => {
  it("classifies validation-target paths through profile rules", () => {
    const profile = {
      rules: [
        { id: "ui", match: { prefix: "src/ui/" }, category: "code", role: "product_ui", functionalSurface: "web_app" },
        { id: "docs", match: { prefix: "docs/" }, category: "docs", role: "planning_docs", functionalSurface: "planning" },
      ],
    };

    assert.deepEqual(classifyFilePath("src/ui/App.tsx", profile), {
      path: "src/ui/App.tsx",
      category: "code",
      role: "product_ui",
      functionalSurface: "web_app",
      generated: false,
      classificationSource: "repository_profile",
      ruleId: "ui",
    });

    assert.deepEqual(classifyFilePath("docs/initiatives/example/prd.md", profile), {
      path: "docs/initiatives/example/prd.md",
      category: "docs",
      role: "planning_docs",
      functionalSurface: "planning",
      generated: false,
      classificationSource: "repository_profile",
      ruleId: "docs",
    });
  });

  it("does not hardcode language or extension into product role", () => {
    const marketingProfile = {
      rules: [
        { id: "marketing-html", match: { suffix: ".html" }, category: "docs", role: "marketing_site" },
      ],
    };
    const productProfile = {
      rules: [
        { id: "product-html", match: { suffix: ".html" }, category: "code", role: "product_ui" },
      ],
    };

    assert.equal(classifyFilePath("public/index.html", marketingProfile).role, "marketing_site");
    assert.equal(classifyFilePath("public/index.html", productProfile).role, "product_ui");
  });

  it("ignores invalid profile regex rules instead of throwing", () => {
    const profile = {
      rules: [
        { id: "broken-regex", match: { regex: "[" }, category: "code", role: "core_product_code" },
        { id: "docs", match: { prefix: "docs/" }, category: "docs", role: "planning_docs" },
      ],
    };

    assert.doesNotThrow(() => classifyFilePath("src/app.js", profile));
    assert.equal(classifyFilePath("src/app.js", profile).classificationSource, "fallback_rule");
    assert.equal(classifyFilePath("docs/readme.md", profile).role, "planning_docs");
  });

  it("classifies this repository's normal development paths through its self-profile", async () => {
    const profile = await readJson("../profiles/delivery-friction-analyzer.json");

    assert.deepEqual(classifyFilePath("src/report/generate-report.js", profile), {
      path: "src/report/generate-report.js",
      category: "code",
      role: "core_product_code",
      functionalSurface: "report_generation",
      generated: false,
      classificationSource: "repository_profile",
      ruleId: "report-runtime",
    });
    assert.deepEqual(classifyFilePath("fixtures/github/mcp-writing/reports/friction-report.golden.md", profile), {
      path: "fixtures/github/mcp-writing/reports/friction-report.golden.md",
      category: "generated",
      role: "fixtures",
      functionalSurface: "report_generation",
      generated: true,
      classificationSource: "repository_profile",
      ruleId: "golden-report-fixtures",
    });

    const examples = new Map([
      ["src/profile/file-role.js", "profile_classification"],
      ["test/profile.test.mjs", "profile_classification"],
      ["schemas/repository-profile.schema.json", "contracts"],
      ["docs/contracts/friction-report.md", "contracts"],
      ["src/collect/gh-provider.js", "github_collection"],
      ["src/normalize/github-fixture.js", "metrics_normalization"],
      ["src/cli/analyze-github.js", "cli"],
      ["scripts/release-versioning.mjs", "release_automation"],
      ["package.json", "package_metadata"],
      [".github/workflows/test.yml", "ci_workflows"],
      ["docs/initiatives/done/maintainer-review-readiness/prd.md", "planning"],
      ["docs/reference/repository-profile.md", "maintainer_docs"],
      ["AGENTS.md", "maintainer_docs"],
      ["README.md", "user_docs"],
    ]);

    for (const [path, expectedSurface] of examples) {
      const classification = classifyFilePath(path, profile);
      assert.equal(classification.classificationSource, "repository_profile", path);
      assert.equal(classification.functionalSurface, expectedSurface, path);
    }

    assert.equal(classifyFilePath("future-area/new-format.xyz", profile).functionalSurface, "unknown");
  });
});

describe("repository profile validation", () => {
  it("accepts complete profile shape with optional runtime contexts", () => {
    const profile = {
      schemaVersion: "repository-profile.v1",
      repository: { owner: "example", name: "example-repo" },
      rules: [
        {
          id: "runtime",
          match: { prefix: "src/" },
          category: "code",
          role: "core_product_code",
          functionalSurface: "runtime",
          generated: false,
        },
      ],
      prClasses: [
        { id: "feature-title", class: "feature", match: { titleRegex: "^feat:" } },
      ],
      workflow: {
        primaryMergeMethod: "squash_merge",
      },
      contributors: {
        sourceType: "all_contributors",
        path: ".all-contributorsrc",
      },
    };

    assert.deepEqual(validateRepositoryProfile(profile), []);
    assert.doesNotThrow(() => assertValidRepositoryProfile(profile));
  });

  it("rejects malformed top-level profile and repository identity fields", () => {
    const errors = validateRepositoryProfile({
      schemaVersion: "repository-profile.v0",
      repository: { owner: "bad owner", name: "", host: "github.com" },
      rules: [],
      unsupported: true,
    });

    assert(errors.some(error => error.includes("profile.unsupported is not supported")));
    assert(errors.some(error => error.includes("schemaVersion must be repository-profile.v1")));
    assert(errors.some(error => error.includes("repository.host is not supported")));
    assert(errors.some(error => error.includes("repository.owner must be a GitHub owner/name segment")));
    assert(errors.some(error => error.includes("repository.name must be a GitHub owner/name segment")));
  });

  it("rejects malformed file-rule fields with rule-specific messages", () => {
    const errors = validateFileRoleRules({
      rules: [
        {
          id: "duplicate",
          match: { prefix: "src/" },
          category: "code",
          role: "core_product_code",
        },
        {
          id: "duplicate",
          match: { regex: "[" },
          category: "source",
          role: "application",
          functionalSurface: "Runtime Surface",
          generated: "false",
          unexpected: true,
        },
        {
          id: "",
          match: {},
          category: "docs",
          role: "planning_docs",
        },
      ],
    });

    assert(errors.some(error => error.includes('rules rule id "duplicate" is duplicated')));
    assert(errors.some(error => error.includes('rules[1] "duplicate".unexpected is not supported')));
    assert(errors.some(error => error.includes('rules[1] "duplicate" match.regex is not a valid JavaScript regex')));
    assert(errors.some(error => error.includes('rules[1] "duplicate" category must be one of')));
    assert(errors.some(error => error.includes('rules[1] "duplicate" role must be one of')));
    assert(errors.some(error => error.includes('rules[1] "duplicate" functionalSurface must be a lowercase identifier')));
    assert(errors.some(error => error.includes('rules[1] "duplicate" generated must be a boolean')));
    assert(errors.some(error => error.includes("rules[2].id must be a non-empty lowercase identifier")));
    assert(errors.some(error => error.includes('rules[2] "index 2" match must include at least one matcher')));
  });
});

describe("pull request class classification", () => {
  it("classifies pull requests through first-match title rules", () => {
    const profile = {
      prClasses: [
        {
          id: "release-with-train",
          class: "release_train",
          match: { titleIncludes: "Release", titleRegex: "^Release \\d{4}" },
        },
        {
          id: "release-generic",
          class: "release",
          match: { titleIncludes: "Release" },
        },
      ],
    };

    assert.deepEqual(classifyPullRequest({ title: "Release 2026.06.14" }, profile), {
      class: "release_train",
      classificationSource: "repository_profile",
      ruleId: "release-with-train",
    });
  });

  it("uses unknown fallback class when no PR class rule matches", () => {
    const profile = {
      prClasses: [
        { id: "release-title", class: "release", match: { titleRegex: "^Release\\b" } },
      ],
    };

    assert.deepEqual(classifyPullRequest({ title: "feat: add search" }, profile), {
      class: "unknown",
      classificationSource: "fallback_rule",
      ruleId: null,
    });
  });

  it("validates PR class rule shape before normalization uses it", () => {
    const errors = validatePrClassRules({
      prClasses: [
        { id: "duplicate", class: "release", match: { titleIncludes: "Release" } },
        { id: "duplicate", class: "release train", match: { branchRegex: "^release/" }, observedFrom: "github", notes: 42 },
        { id: "bad-regex", class: "release", match: { titleRegex: "[" } },
      ],
    });

    assert(errors.some(error => error.includes("duplicated")));
    assert(errors.some(error => error.includes("lower-kebab-case or lower_snake_case")));
    assert(errors.some(error => error.includes("observedFrom is not supported")));
    assert(errors.some(error => error.includes("match.branchRegex is not supported")));
    assert(errors.some(error => error.includes("notes must be a string")));
    assert(errors.some(error => error.includes("must include titleIncludes or titleRegex")));
    assert(errors.some(error => error.includes("titleRegex is invalid")));
  });

  it("reports malformed PR class rule collections without throwing", () => {
    assert.deepEqual(validatePrClassRules({ prClasses: {} }), [
      "prClasses must be an array when provided",
    ]);
  });

  it("rejects explicit null PR class rule collections", () => {
    assert.deepEqual(validatePrClassRules({ prClasses: null }), [
      "prClasses must be an array when provided",
    ]);
    assert.throws(
      () => assertValidPrClassRules({ prClasses: null }),
      /invalid PR class profile rules: prClasses must be an array when provided/,
    );
  });

  it("provides ordered Conventional Commit preset rules with title regex matchers", () => {
    const rules = conventionalCommitPrClassRules();
    const profile = { prClasses: rules };

    assert.deepEqual(rules.map(rule => rule.class), [
      "dependency",
      "feature",
      "fix",
      "docs",
      "test",
      "maintenance",
    ]);
    assert(rules.every(rule => typeof rule.match.titleRegex === "string"));
    assert.doesNotThrow(() => assertValidPrClassRules(profile));
    assert.equal(classifyPullRequest({ title: "chore(deps): update lockfile" }, profile).class, "dependency");
    assert.equal(classifyPullRequest({ title: "feat(cli)!: add setup preset" }, profile).class, "feature");
    assert.equal(classifyPullRequest({ title: "fix(parser): handle title rules" }, profile).class, "fix");
    assert.equal(classifyPullRequest({ title: "docs: explain profiles" }, profile).class, "docs");
    assert.equal(classifyPullRequest({ title: "test(cli): cover prompts" }, profile).class, "test");
    assert.equal(classifyPullRequest({ title: "chore: refresh tooling" }, profile).class, "maintenance");
  });

  it("classifies this repository's Conventional Commit-style PR titles", async () => {
    const profile = await readJson("../profiles/delivery-friction-analyzer.json");

    assert.equal(classifyPullRequest({ title: "chore(deps): update lockfile" }, profile).class, "dependency");
    assert.equal(classifyPullRequest({ title: "feat(report): add PR class context" }, profile).class, "feature");
    assert.equal(classifyPullRequest({ title: "fix: align PR sample metadata contract" }, profile).class, "fix");
    assert.equal(classifyPullRequest({ title: "docs: clarify README onboarding flow" }, profile).class, "docs");
    assert.equal(classifyPullRequest({ title: "test(profile): cover self-profile paths" }, profile).class, "test");
    assert.equal(classifyPullRequest({ title: "chore: refresh generated fixtures" }, profile).class, "maintenance");
    assert.equal(classifyPullRequest({ title: "Investigate self-profile output" }, profile).class, "unknown");
  });
});

describe("workflow context validation", () => {
  it("accepts omitted and valid workflow context", () => {
    assert.deepEqual(validateWorkflowContext({}), []);
    assert.deepEqual(validateWorkflowContext({
      workflow: {
        primaryMergeMethod: "squash_merge",
        releaseStrategy: "release_prs",
        branchStrategy: "main_plus_release_branches",
      },
    }), []);
  });

  it("rejects malformed workflow context values", () => {
    assert.deepEqual(
      validateWorkflowContext({ workflow: {} }),
      ["workflow must include at least one field when provided"],
    );

    const errors = validateWorkflowContext({
      workflow: {
        primaryMergeMethod: "squash merges",
        releaseStrategy: "release-pull-requests",
        branchStrategy: "main",
        observedFrom: "github",
      },
    });

    assert(errors.some(error => error.includes("workflow.primaryMergeMethod must be one of")));
    assert(errors.some(error => error.includes("workflow.releaseStrategy must be one of")));
    assert(errors.some(error => error.includes("workflow.branchStrategy must be one of")));
    assert(errors.some(error => error.includes("workflow.observedFrom is not supported")));
    assert.throws(
      () => assertValidWorkflowContext({ workflow: { primaryMergeMethod: "squash merges" } }),
      /invalid workflow profile context: workflow.primaryMergeMethod must be one of/,
    );
  });
});

describe("contributor source profile validation", () => {
  it("accepts omitted and valid all-contributors source config", () => {
    assert.deepEqual(validateContributorSource({}), []);
    assert.deepEqual(validateContributorSource({
      contributors: {
        sourceType: "all_contributors",
        path: ".all-contributorsrc",
      },
    }), []);
    assert.deepEqual(validateContributorSource({
      contributors: {
        sourceType: "all_contributors",
        path: "docs/contributors..fixture.json",
      },
    }), []);
    assert.deepEqual(validateContributorSource({
      contributors: {
        sourceType: "all_contributors",
      },
    }), []);
  });

  it("rejects unsupported contributor source profile fields and source types", () => {
    const errors = validateContributorSource({
      contributors: {
        sourceType: "markdown",
        path: "../CONTRIBUTORS.md",
        observedFrom: "github",
      },
    });

    assert(errors.some(error => error.includes("contributors.sourceType must be one of")));
    assert(errors.some(error => error.includes("contributors.path must be a trimmed slash-delimited repository-relative path")));
    assert(errors.some(error => error.includes("contributors.observedFrom is not supported")));
    assert.throws(
      () => assertValidContributorSource({ contributors: { sourceType: "markdown" } }),
      /invalid contributor source profile context: contributors.sourceType must be one of/,
    );
  });

  it("aligns contributor source path validation with repository-relative schema rules", () => {
    assert.deepEqual(validateContributorSource({
      contributors: {
        sourceType: "all_contributors",
        path: "docs/contributors..fixture.json",
      },
    }), []);

    for (const path of [
      "../CONTRIBUTORS.md",
      "docs/../CONTRIBUTORS.md",
      "/CONTRIBUTORS.md",
      "docs\\CONTRIBUTORS.md",
      " docs/CONTRIBUTORS.md",
      "docs/CONTRIBUTORS.md ",
      "   ",
    ]) {
      assert(
        validateContributorSource({
          contributors: {
            sourceType: "all_contributors",
            path,
          },
        }).some(error => error.includes("contributors.path")),
        `expected path to be rejected: ${path}`,
      );
    }
  });

  it("parses all-contributors JSON into sanitized login hints", () => {
    const parsed = parseAllContributorsHints(JSON.stringify({
      contributors: [
        { login: "Maintainer", name: "A Maintainer", profile: "https://example.test" },
        { github: "@reviewer" },
      ],
    }));

    assert.equal(parsed.status, "available");
    assert.deepEqual(parsed.hints.logins, ["maintainer", "reviewer"]);
  });

  it("labels malformed and partial all-contributors content", () => {
    assert.equal(parseAllContributorsHints("{").status, "malformed");
    const partial = parseAllContributorsHints(JSON.stringify({
      contributors: [
        { login: "maintainer" },
        { name: "No Login" },
      ],
    }));

    assert.equal(partial.status, "partial");
    assert.deepEqual(partial.hints.logins, ["maintainer"]);
    assert(partial.diagnostics.some(diagnostic => diagnostic.includes("Skipped 1 contributor entry")));
  });

  it("uses contributor hints only from usable coverage states", () => {
    for (const status of ["malformed", "unavailable", "rate_limited", "unsupported"]) {
      assert.equal(
        contributorHintsFromSource({
          coverage: { status },
          hints: { logins: ["known-reviewer"] },
        }).logins.size,
        0,
        `expected ${status} hints to be ignored`,
      );
    }

    assert.deepEqual(
      [...contributorHintsFromSource({
        coverage: { status: "partial" },
        hints: { logins: ["Known-Reviewer"] },
      }).logins],
      ["known-reviewer"],
    );
  });
});

describe("comment source classification", () => {
  it("distinguishes Copilot, Actions, dependency bots, scanners, humans, and unknown bots", () => {
    assert.equal(classifyCommentSource({ login: "copilot-pull-request-reviewer", type: "Bot" }), "copilot");
    assert.equal(classifyCommentSource({ login: "github-actions[bot]", type: "Bot" }), "github_actions_bot");
    assert.equal(classifyCommentSource({ login: "dependabot[bot]", type: "Bot" }), "dependency_bot");
    assert.equal(classifyCommentSource({ login: "github-code-scanning", type: "Bot" }), "code_scanning");
    assert.equal(classifyCommentSource({ login: "reviewer", type: "User" }), "human_reviewer");
    assert.equal(
      classifyCommentSource({ login: "hannasdev", type: "User" }, { pullRequestAuthorLogin: "hannasdev" }),
      "author_reply",
    );
    assert.equal(
      classifyCommentSource({ login: "dependabot[bot]", type: "Bot" }, { pullRequestAuthorLogin: "dependabot[bot]" }),
      "author_reply",
    );
    assert.equal(classifyCommentSource({ login: "some-review-bot", type: "Bot" }), "unknown_bot");
  });

  it("uses configured contributor hints only for comment-source classification", () => {
    const contributorHints = { logins: new Set(["known-reviewer"]) };

    assert.equal(classifyCommentSource({ login: "known-reviewer" }, { contributorHints }), "human_reviewer");
    assert.equal(classifyCommentSource({ login: "unknown-reviewer" }, { contributorHints }), "unknown");
  });
});

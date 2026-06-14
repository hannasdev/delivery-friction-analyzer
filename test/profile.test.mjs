import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFilePath } from "../src/profile/file-role.js";
import { classifyPullRequest, validatePrClassRules } from "../src/profile/pr-class.js";
import { classifyCommentSource } from "../src/github/comment-source.js";

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
        { id: "duplicate", class: "release train", match: {} },
        { id: "bad-regex", class: "release", match: { titleRegex: "[" } },
      ],
    });

    assert(errors.some(error => error.includes("duplicated")));
    assert(errors.some(error => error.includes("lower-kebab-case or lower_snake_case")));
    assert(errors.some(error => error.includes("must include titleIncludes or titleRegex")));
    assert(errors.some(error => error.includes("titleRegex is invalid")));
  });

  it("reports malformed PR class rule collections without throwing", () => {
    assert.deepEqual(validatePrClassRules({ prClasses: {} }), [
      "prClasses must be an array when provided",
    ]);
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
});

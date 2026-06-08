import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFilePath } from "../src/profile/file-role.js";
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

    assert.equal(classifyFilePath("docs/initiatives/example/prd.md", profile).role, "planning_docs");
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
});

describe("comment source classification", () => {
  it("distinguishes Copilot, Actions, dependency bots, scanners, humans, and unknown bots", () => {
    assert.equal(classifyCommentSource({ login: "copilot-pull-request-reviewer", type: "Bot" }), "copilot");
    assert.equal(classifyCommentSource({ login: "github-actions[bot]", type: "Bot" }), "github_actions_bot");
    assert.equal(classifyCommentSource({ login: "dependabot[bot]", type: "Bot" }), "dependency_bot");
    assert.equal(classifyCommentSource({ login: "github-code-scanning", type: "Bot" }), "code_scanning");
    assert.equal(classifyCommentSource({ login: "hannasdev", type: "User" }), "human_reviewer");
    assert.equal(classifyCommentSource({ login: "some-review-bot", type: "Bot" }), "unknown_bot");
  });
});

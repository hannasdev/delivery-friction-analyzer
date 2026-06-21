import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";

const DONE_DOCS_ROOT = "docs/initiatives/done";
const CHECKBOX_RE = /^\s*[-*]\s+\[\s\]\s+(.+?)\s*$/;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const ALLOWED_LABEL_RE = /^(Deferred|Future decision|Intentionally omitted):\s+/i;
const BACKLOG_LINK_RE = /(?:docs\/initiatives\/backlog\/[^\s)]+|\]\(\.\.\/backlog\/[^)]+\)|https?:\/\/github\.com\/[^\s)]+\/(?:issues|pull)\/\d+)/i;
const STATUS_ITEMS = new Set([
  "active",
  "implemented",
  "conformance reviewed",
  "adversarially reviewed",
  "pr opened",
  "merged",
]);
const ALLOWED_CONVENTION = "Use Deferred:, Future decision:, Intentionally omitted:, Backlog-linked:, or link to docs/initiatives/backlog/..., ../backlog/..., or a GitHub issue/PR URL.";

async function listMarkdownFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}

function normalizeHeading(rawHeading) {
  return rawHeading.trim().toLowerCase();
}

function isAllowedHistoricalStatusItem(item, currentHeading) {
  return normalizeHeading(currentHeading) === "status" && STATUS_ITEMS.has(item.trim().toLowerCase());
}

function isAllowedUncheckedItem(item, currentHeading) {
  return ALLOWED_LABEL_RE.test(item)
    || BACKLOG_LINK_RE.test(item)
    || isAllowedHistoricalStatusItem(item, currentHeading);
}

function failureMessage({ file, line, item, heading }) {
  const context = normalizeHeading(heading) === "open questions"
    ? "unchecked Open Questions item"
    : "unchecked checklist item";
  return `${file}:${line} has ${context}: ${item}\n${ALLOWED_CONVENTION}`;
}

function findMarkdownHygieneFailures(content, file) {
  const failures = [];
  let currentHeading = "";
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      currentHeading = headingMatch[1];
      return;
    }

    const checkboxMatch = line.match(CHECKBOX_RE);
    if (!checkboxMatch) {
      return;
    }

    const item = checkboxMatch[1];
    if (!isAllowedUncheckedItem(item, currentHeading)) {
      failures.push(failureMessage({
        file,
        line: index + 1,
        item,
        heading: currentHeading,
      }));
    }
  });

  return failures;
}

async function findDoneDocsHygieneFailures(root = process.cwd()) {
  const doneRoot = join(root, DONE_DOCS_ROOT);
  const files = await listMarkdownFiles(doneRoot);
  const failures = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    failures.push(...findMarkdownHygieneFailures(content, relative(root, file)));
  }

  return failures;
}

async function withTempInitiativeDocs(files, callback) {
  const root = await mkdtemp(join(tmpdir(), "done-docs-hygiene-"));

  try {
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(root, path);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, content, "utf8");
    }

    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("done initiative docs hygiene", () => {
  it("keeps current done initiatives free of stale unchecked items", async () => {
    assert.deepEqual(await findDoneDocsHygieneFailures(), []);
  });

  it("allows documented deferred, future-decision, omitted, backlog-linked, and historical status items", () => {
    const failures = findMarkdownHygieneFailures(`# Status

- [ ] Implemented

## Acceptance Criteria

- [ ] Deferred: Ship model-ready context only if later report usage proves the extra artifact is needed.
- [ ] Future decision: Decide whether branch matchers belong in a later profile contract.
- [ ] Intentionally omitted: Hosted dashboards remain outside this local CLI initiative.
- [ ] Backlog-linked: Continue in docs/initiatives/backlog/future-profile-matchers/prd.md.
- [ ] Track the follow-up in [future profile matchers](../backlog/future-profile-matchers/prd.md).
- [ ] Track the follow-up in https://github.com/hannasdev/delivery-friction-analyzer/issues/123.
`, "docs/initiatives/done/example/prd.md");

    assert.deepEqual(failures, []);
  });

  it("ignores unchecked backlog items because the guard only scans done initiatives", async () => {
    await withTempInitiativeDocs({
      "docs/initiatives/done/example/prd.md": "# Done\n\n- [x] Shipped.\n",
      "docs/initiatives/backlog/example/prd.md": "# Backlog\n\n- [ ] Bare backlog TODO remains allowed.\n",
    }, async root => {
      assert.deepEqual(await findDoneDocsHygieneFailures(root), []);
    });
  });

  it("rejects bare unchecked open questions in done initiatives with correction guidance", () => {
    const failures = findMarkdownHygieneFailures(`# Open Questions

- [ ] Should this unresolved question stay here?
`, "docs/initiatives/done/example/prd.md");

    assert.equal(failures.length, 1);
    assert.match(failures[0], /docs\/initiatives\/done\/example\/prd\.md:3/);
    assert.match(failures[0], /unchecked Open Questions item: Should this unresolved question stay here\?/);
    assert.match(failures[0], /Use Deferred:, Future decision:, Intentionally omitted:, Backlog-linked:/);
    assert.match(failures[0], /docs\/initiatives\/backlog\/\.\.\./);
  });

  it("rejects backlog-labeled unchecked items without a concrete backlog link", () => {
    const failures = findMarkdownHygieneFailures(`# Acceptance Criteria

- [ ] Backlog-linked: follow up later
`, "docs/initiatives/done/example/prd.md");

    assert.equal(failures.length, 1);
    assert.match(failures[0], /docs\/initiatives\/done\/example\/prd\.md:3/);
    assert.match(failures[0], /unchecked checklist item: Backlog-linked: follow up later/);
    assert.match(failures[0], /Use Deferred:, Future decision:, Intentionally omitted:, Backlog-linked:/);
    assert.match(failures[0], /docs\/initiatives\/backlog\/\.\.\./);
    assert.match(failures[0], /GitHub issue\/PR URL/);
  });

  it("does not treat historical status allowance as acceptance criteria cleanup", () => {
    const failures = findMarkdownHygieneFailures(`# Acceptance Criteria

- [ ] Implemented
`, "docs/initiatives/done/example/milestones.md");

    assert.equal(failures.length, 1);
    assert.match(failures[0], /unchecked checklist item: Implemented/);
  });
});

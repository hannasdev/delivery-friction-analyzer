# Repository Guidance

Keep changes narrow, preserve existing patterns, and treat this file as
repo-specific review readiness guidance rather than a second README.

## Review Readiness

Baseline self-analysis found clean CI but recurring Copilot review loops around:

- contract field naming and metadata truthfulness;
- report caveat wording, rounding boundaries, duplicate formatting helpers, and
  initiative bookkeeping;
- release automation SemVer edges, CLI entrypoint behavior, package metadata,
  and package contents;
- docs precision around conditional artifacts, `npx`, interactive prompts, and
  configured versus verified claims.

Before opening a PR or updating one for review, check whether the change is
broad. A change hits a broad-change tripwire when it has 10 or more changed
files, 750 or more non-generated changed lines, or more than one functional
surface. If a tripwire fires, split the work or record why the chosen scope is
still reviewable. For initiative work, keep milestone bookkeeping current when
status changes and prefer adversarial review before activation or PR work on
broad milestones.

Post-merge lifecycle or archive bookkeeping belongs on a review branch unless
the user explicitly asks for a direct local-only main commit. Do not commit
directly to `main` for done-folder moves, lifecycle recording, release-log
corrections, or other follow-up bookkeeping; create a branch from current
`main`, make the scoped change there, and prepare a PR.

Completed initiative docs under `docs/initiatives/done/**` should read as
implementation history, not active TODO lists. Check shipped or otherwise
resolved work. Leave unchecked items only when they are explicitly labeled
`Deferred:`, `Future decision:`, `Backlog-linked:`, or `Intentionally omitted:`.
Backlog-linked items must include a concrete `docs/initiatives/backlog/...`
path, a relative Markdown link into `../backlog/`, or a GitHub issue/PR URL.
Unchecked lifecycle status items such as `Implemented`, `Conformance reviewed`,
`Adversarially reviewed`, `PR opened`, or `Merged` are allowed only under a
`Status` heading for historical milestone records. A bare unchecked open
question such as `- [ ] Should this be handled later?` is not valid in done
docs; mark it as `Future decision: ...`, `Deferred: ...`, or link it to a
backlog follow-up instead.

## Validation Commands

- Ordinary code, tests, fixtures, and small maintainer-doc changes:
  `npm run preflight`.
- Report or contract changes: `npm run preflight`, name exact schema/report
  fields, keep displayed labels aligned with values, and add focused report,
  schema, fixture, or boundary tests when caveats, golden outputs, or generated
  artifacts can diverge.
- Profile changes: `node --test test/profile.test.mjs`,
  `node --test test/schema-validation.test.mjs`, and `npm run preflight`;
  inspect a generated or dry-run self-analysis result when classification
  behavior changes.
- README/reference docs changes: `npm run preflight`; verify
  required versus conditional outputs, `npx` assumptions, prompt conditionality,
  and configured versus verified claims.
- Release automation, package metadata, package contents, or publish workflow
  changes: `npm run preflight:release`.

Do not add mandatory human approval or apply the same checklist to tiny
docs-only or test-only changes. The tripwires are review-burden signals, not
automatic rejection rules.

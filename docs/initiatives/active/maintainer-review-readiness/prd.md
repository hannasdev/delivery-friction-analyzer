# Maintainer Review Readiness

## Status

Status: Active.

- State: Active
- Owner: Hanna
- Created: 2026-06-20
- Current milestone state: M1 implemented and conformance reviewed; pre-PR adversary review findings have been remediated.
- Activation review: Accepted with notes on 2026-06-21; carry surface-taxonomy, tripwire, and self-analysis rerun details into M1 implementation.
- Related issue:
  - None yet.
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Repository Profile Format](../../../reference/repository-profile.md)
  - [Release Automation](../../../reference/release-automation.md)
  - [Setup And Report Usability](../../done/setup-report-usability/prd.md)
- M1 evidence:
  - Local generated report bundle: `reports/delivery-friction-analyzer/` (ignored artifact; not part of this PR)
  - Self-profile path: `profiles/delivery-friction-analyzer.json` (implemented in M1)
  - M1 conformance review completed before pre-PR adversary review.
  - Pre-PR adversary review completed and maintainer-bookkeeping fixes have been applied.

## Problem

The repository's local self-analysis report shows that delivery friction is not coming from failed CI. Across the analyzed 30 merged pull requests, the report and supporting CSV review showed:

- 0 failed checks and 0 cancelled workflow runs;
- 109 review comments, all from Copilot plus author replies;
- 19 PRs with review threads;
- 19 PRs with post-review commits;
- 8 PRs over 1,000 changed lines;
- all PR classes and functional surfaces reported as `unknown` because the local draft repository profile used for planning had no rules.

This means the main workflow issue is late discovery during automated review: review comments repeatedly catch contract wording, release automation edge cases, report caveat consistency, and documentation precision after a PR already exists. The report also cannot classify this repository well enough to make future self-analysis actionable.

## Goals

- Make future self-analysis useful by classifying this repository's paths, PR title conventions, roles, and functional surfaces.
- Reduce preventable Copilot review loops by moving recurring review expectations into local maintainer guidance.
- Add lightweight preflight commands for the recurring validation stories reviewers already ask for.
- Define PR readiness gates for broad or cross-surface changes before review begins.
- Preserve the analyzer's local, evidence-first workflow and avoid adding process that blocks small low-risk changes.
- Keep product-facing report changes separate from this maintainer-only workflow initiative.

## Non-Goals

- Do not change bottleneck scoring, ranking formulas, or recommendation categories.
- Do not make the analyzer depend on this repository's own workflow conventions.
- Do not require human reviewer approvals for every local PR as part of this initiative.
- Do not add hosted services, dashboards, GitHub Apps, webhooks, or persistent workflow state.
- Do not replace the existing initiative lifecycle with a new planning system.
- Do not duplicate active setup-report-usability work around generic profile suggestions.
- Do not add review-theme report artifacts in this initiative. That product-facing idea is deferred until another repository shows the same need or a separate product initiative accepts the artifact contract.

## Product And Design Alignment

Delivery Friction Analyzer is designed to help maintainers inspect workflow evidence before changing process. This initiative applies that product principle to the product repository itself:

- observed evidence stays separate from interpretation and suggestions;
- repository-specific assumptions live in profile data and maintainer guidance, not hidden in analyzer code;
- local checks should be cheap enough to run before PR review;
- broad changes should be split or explicitly justified before they create review churn;
- any future report improvements should make evidence more inspectable without turning comments into individual rankings.

## Baseline Review Theme Evidence

The baseline report preserves comment counts and source labels, but not comment bodies. During planning, representative high-churn PR comments were inspected and summarized into durable, non-raw theme evidence so M3 guidance does not depend on chat history or sensitive comment text.

| PR | Theme category | Guidance/check this should produce |
| --- | --- | --- |
| #23 `fix: align PR sample metadata contract` | Contract field naming and metadata truthfulness | Report/contract changes should name exact schema/report fields, keep displayed labels aligned with actual values, and add focused tests when metadata fields can diverge. |
| #26 `feat(report): add PR class context to friction reports` | Report caveat consistency, rounding boundaries, helper duplication, and initiative bookkeeping | Report changes should test boundary values for displayed caveats, avoid duplicate formatting helpers, update golden fixtures, and keep milestone status checkboxes current. |
| #28 `feat: add npm release automation` | Release automation SemVer edge cases, script entrypoint behavior, package metadata, and package contents | Release/package changes should run release-versioning tests, smoke the script through its CLI entrypoint, validate package metadata, and run `npm pack --dry-run`. |
| #41 `docs: clarify README onboarding flow` | User-facing docs precision around conditional artifacts, `npx`, interactive prompts, and configured versus verified claims | README/reference changes should distinguish required versus conditional outputs, avoid implying prior installation for `npx`, avoid exhaustive prompt lists when prompts are conditional, and avoid saying user-provided workflow context is verified. |

## Proposed Solution

Treat the current report as the baseline and address the friction in three reviewable slices:

1. Add a real self-profile for this repository, including path rules, functional surfaces, and Conventional Commit-style PR classes.
2. Add local preflight commands and maintainer guidance for release automation, report/contract changes, fixtures, generated reports, and documentation wording.
3. Add repo-specific AI/review readiness guidance so agents check the recurring Copilot themes before opening or updating PRs.

Implementation should prefer small docs, profile, script, and test changes over broad automation. The readiness gate should be a tripwire: when a PR touches many files, many lines, or multiple surfaces, it should trigger a deliberate split-or-justify step rather than blocking all work.

## User / Maintainer Workflows

- A maintainer reruns the analyzer against this repository and sees meaningful PR classes and functional surfaces instead of all `unknown`.
- A contributor prepares a release-automation change and runs one command that covers tests, package dry-run validation, and script invocation checks.
- An agent working on report or contract code sees repository guidance that calls out golden fixtures, exact schema field names, caveat wording, and rounding boundary tests.
- A broad initiative milestone is checked against readiness tripwires before PR review, making the split decision explicit.
- A maintainer uses durable guidance derived from the baseline review themes without needing to refetch historical PR comments.

## Acceptance Criteria

- [ ] The self-profile classifies meaningful repository paths, roles, functional surfaces, and Conventional Commit-style PR classes for this repository.
- [ ] A rerun self-analysis no longer reports every PR class and functional surface as `unknown`.
- [ ] Local preflight scripts cover the recurring validation stories for ordinary changes and release/package changes.
- [ ] Repository guidance captures recurring review-readiness expectations for release automation, report/contract changes, docs, fixtures, and broad PRs.
- [ ] PR readiness tripwires are documented with split-or-justify behavior for broad changes.
- [ ] The baseline review theme evidence remains summarized in durable docs without raw review-comment text.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| The self-profile overfits today's repository structure. | Future reports may look precise but classify new surfaces poorly. | Use broad stable path rules, document assumptions, and keep `unknown` visible for genuinely new areas. |
| Readiness guidance becomes too heavy for small changes. | Maintainers may skip the process or slow down low-risk fixes. | Make readiness gates tripwire-based and explicitly allow small docs/tests/fixes to use the ordinary validation path. |
| Preflight scripts duplicate CI and become noisy. | Local checks could cost more than the review churn they prevent. | Keep scripts thin wrappers around existing commands and only add release-specific checks where review evidence showed repeated issues. |
| AI guidance masks product judgment. | Agents could satisfy a checklist without preserving user value. | Keep guidance tied to evidence and acceptance criteria; use adversarial review before activation or implementation. |
| Review-theme evidence becomes too dependent on historical comments. | Guidance could become brittle or sensitive. | Keep only short category summaries in planning docs; defer any raw or product-facing comment artifact to a separate initiative. |
| Existing setup-report-usability work overlaps profile suggestions. | Duplicate report text or repeated recommendations could confuse users. | Keep this initiative's profile work repo-local; leave generic profile-suggestion rendering to setup-report-usability. |

## Testing Strategy

- Profile validation through existing profile/schema tests and a full analyzer rerun against this repository.
- Script validation through `npm test`, `git diff --check`, and package dry-run checks where release/package files are involved.
- Report/contract changes through focused report, schema, and fixture tests plus generated artifact review.
- Documentation and guidance review against actual high-churn PR comment themes from the baseline report.

## Resolved Decisions

- [x] Treat CI as a lower-priority friction source for this initiative because the baseline report shows no failed checks or cancelled workflow runs.
- [x] Treat Copilot review loops as the primary preventable workflow signal because all review comments in the baseline sample came from Copilot plus author replies.
- [x] Start with repository profile quality before making stronger workflow decisions from future self-reports.
- [x] Defer review-theme report artifacts out of this initiative. M1-M3 should fix maintainer workflow first; product-facing comment-theme evidence needs a separate artifact contract and should wait for another repository signal or a dedicated product initiative.
- [x] Keep the initiative in backlog until the plan has had adversarial review.

## Open Questions

- [ ] Should repo-specific AI guidance live only in `AGENTS.md`, or should this repository also get a dedicated Codex skill after the first guidance milestone proves useful?

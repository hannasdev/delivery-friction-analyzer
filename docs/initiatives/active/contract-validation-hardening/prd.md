# Contract Validation Hardening

## Status

Status: Active.

- State: Active
- Owner: Hanna
- Created: 2026-06-13
- Activated: 2026-06-21
- Active milestone: M2 Source Bundle Schema Contract
- Relevance reviewed: 2026-06-21 against `main` at v0.14.2. Still relevant, with baseline updates for completed PR class segmentation, setup/report usability, interactive setup, and maintainer review readiness work.
- Related issue:
  - None yet.
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Target Repository Input Contract](../../../contracts/target-repository.md)
  - [Repository Profile Format](../../../reference/repository-profile.md)
  - [GitHub Access And Coverage Matrix](../../../reference/github-access-coverage.md)
  - [GitHub Data Inventory](../../../reference/github-data-inventory.md)

## Problem

A repository quality review found that the analyzer has useful contracts, but some of them are still too easy to drift from runtime behavior:

- The product repository and target repository are documented as separate concepts. The target contract can reject the product repository when a product identity is supplied, but the live CLI/collector path still does not pass a configured product repository identity before provider calls.
- Repository profiles have a JSON schema and are central to trustworthy file-role, PR class, workflow, and contributor-source classification. Live analysis now validates PR class, workflow, and contributor-source sections when reading profiles, but it still does not validate the full profile contract, core file-rule shape, or invalid file regex matchers before collection.
- `source-bundle.json` is a core traceability artifact for live analysis and is emitted as `github-source-bundle.v1`, but there is still no checked-in source-bundle schema under `schemas/`.
- Completed initiative docs still contain unchecked criteria, future-decision questions, and deferred-status markers from work completed after this backlog item was written. Some are legitimate history, but there is no automated guard that distinguishes shipped, deferred, intentionally omitted, and unresolved work.

The original PR-count selection wording and some completed-initiative bookkeeping were corrected during the quality pass. Later initiatives also delivered PR class segmentation, first-run setup guidance, interactive workflow/contributor profile setup, reusable run presets, report caveat improvements, a maintainer self-profile, and local preflight commands. This initiative remains useful, but its baseline is now the current GitHub-connected analyzer rather than the narrower June 13 state.

## Goals

- Enforce product-repository versus target-repository separation in the live analysis path.
- Validate the complete current repository profile contract before collection or report generation depends on profile rules.
- Add a schema-backed `github-source-bundle.v1` contract for the collector-owned source bundle.
- Keep failures actionable and early, especially before expensive or rate-limited GitHub calls.
- Preserve local/offline testability with mocked GitHub providers and fixture data.
- Add lightweight documentation hygiene so completed initiatives do not keep stale unchecked criteria or unresolved decisions.

## Non-Goals

- Do not add new PR class semantics, branch-based PR class matching, or new PR class report behavior; existing profile-driven PR class segmentation and filtering remain the baseline.
- Do not add date-window collection or `--since`; live analysis remains latest-N merged PRs.
- Do not add hosted services, GitHub Apps, webhooks, dashboards, or persistent server-side state.
- Do not add new contributor-source parsers beyond the existing `.all-contributorsrc` support.
- Do not change run preset schema or persistence behavior except for documenting that presets point to validated profile paths.
- Do not redact source bundles by default in this initiative; artifact sensitivity remains documented and local/private.
- Do not replace all schema validation in the repository with a broad framework unless the small contract set truly requires it.
- Do not make source bundle schema validation so strict that harmless upstream GitHub payload additions break the analyzer.

## Product And Design Alignment

Delivery Friction Analyzer is meant to be repo-source-agnostic and evidence-preserving. That only works if runtime contracts match the documentation users read:

- target repositories must remain explicit user choices;
- repository-specific assumptions must live in profile data and be validated before use;
- raw/source-shaped evidence should be traceable but not silently treated as complete;
- reports should label unavailable, partial, inferred, and configured data clearly.

This initiative strengthens the local analyzer as a trustworthy command-line product rather than adding new analytics features.

## Proposed Solution

Add contract enforcement at the same boundaries where data enters or leaves stable layers:

- Target repository preflight should reject the configured product repository before making GitHub calls.
- Profile preflight should validate the whole current `repository-profile.v1` contract, including repository identity, file-role rules, PR class rules, workflow context, contributor-source config, and invalid regex matchers with clear rule-specific errors.
- Source bundle generation should produce data that validates against a new `github-source-bundle.v1` schema covering collector metadata, target repository, selection, coverage, language context, optional contributor-source metadata, and PR payload fields consumed by normalization.
- Documentation work should audit and reconcile the existing latest-N PR selection, profile validation behavior, run preset/profile ownership, artifact sensitivity, branch-based workflow-run caveat, and deferred source-bundle redaction guidance rather than rewriting already-current reference docs.
- Completed initiative artifacts should stay reconciled: implemented acceptance criteria checked, intentionally deferred scope called out as deferred, and unresolved questions answered or moved into backlog initiatives.

Implementation decisions:

- Product repository identity should use a repo-local default for `hannasdev/delivery-friction-analyzer` plus an injectable module/API override for tests and future packaging. Do not add a public CLI option in M1.
- Repository profile validation should use focused runtime validators for actionable CLI errors plus schema contract tests for fidelity. Existing PR class, workflow, and contributor-source validators should be reused rather than duplicated. Do not add a JSON Schema dependency unless the focused validator proves misleading or too broad to maintain.
- Docs hygiene should be an automated local Node test that runs under the existing `npm test` command. Reviewer guidance can explain the convention, but reviewer practice alone is not sufficient for M3.

## User / Maintainer Workflows

- A maintainer accidentally points the analyzer at this product repository and receives a clear preflight error before GitHub collection begins.
- A maintainer edits a repository profile with a misspelled field, malformed file rule, invalid PR class rule, invalid workflow context, unsupported contributor-source path, or invalid regex and receives a focused profile validation error that names the field or rule.
- A maintainer runs from a saved preset and still gets validation against the referenced profile before collection starts.
- A contributor changes live collection shape and sees a schema test fail before reports silently lose evidence.
- A reviewer inspects a completed initiative and can tell what shipped, what was intentionally deferred, and what belongs to backlog.

## User-Perspective Preview And Approval

For maintainers, the delivered experience should feel like a stricter but clearer local CLI. Invalid targets and profiles should fail before GitHub collection with messages that name the exact repository, profile field, rule ID, or regex matcher to fix. Valid existing profiles, run presets, reports, CSV exports, and fixture workflows should continue to behave the same.

For contributors, source-bundle and done-doc changes should appear mostly as local test feedback: schema failures when collector output drifts, and docs-hygiene failures when completed initiative records still look like active TODO lists. Schema failure output should name the generated artifact or fixture, the schema path or field that failed when available, and whether the fix belongs in collector output or the schema contract.

User-facing validation copy should be specific enough to recover from without reading source code: name the file or command context, the field/path/rule that failed, what was invalid, and the next action. Product-repository rejection should explain that the chosen repository is this tool's product repository and that no GitHub data was collected. Example shape: `Cannot analyze hannasdev/delivery-friction-analyzer because it is this tool's product repository. Choose the repository you want to measure with --repo owner/name. No GitHub data was collected.`

Profile validation copy should make the direct recovery path clear. For an existing malformed profile, tell the maintainer which field or rule to edit; mention interactive setup only as a way to create or regenerate a starter profile. Example shape: `Invalid repository profile: rules[3] "docs-regex" match.regex is not a valid JavaScript regex. Fix that rule in <profile path>. If you want to regenerate a starter profile instead, rerun interactive setup with --interactive --dry-run.`

Done-doc hygiene failures should also name the file and convention to use. Example shape: `Done initiative has an unchecked open question: docs/initiatives/done/.../prd.md:139. Mark it as Future decision:, Deferred:, Intentionally omitted:, or link it to a backlog follow-up.`

Intentionally unchanged: latest-N PR selection, PR class scoring/ranking behavior, run preset persistence, contributor-source parser scope, artifact sensitivity defaults, and hosted/service behavior.

Human approval checkpoint: Approved by Hanna on 2026-06-21 for the refreshed user-perspective preview and milestone shape. The initiative remains in backlog until activation is requested.

## Acceptance Criteria

- [ ] Live analysis rejects the configured product repository before provider calls.
- [ ] Repository profile validation runs before GitHub collection or report generation depends on profile rules, including repository identity, file-role rules, duplicate IDs, unsupported keys, category/role/surface values, PR class rules, workflow context, contributor-source config, and invalid regex matchers.
- [ ] `github-source-bundle.v1` has a checked-in schema and tests that validate mocked collector output, including optional contributor-source metadata and contributor privacy boundaries.
- [ ] Contract docs are audited and reconciled for latest-N PR selection, profile validation, run preset/profile ownership, source-bundle schema boundaries, and known workflow-run caveats.
- [ ] Completed initiative docs contain no stale unchecked implemented criteria or bare unanswered open questions; legitimate deferred or future-decision items are labeled consistently or linked to backlog follow-up.
- [ ] User-facing validation, schema-validation, and docs-hygiene failures name the failing file or command context, the invalid field/path/rule or schema path when available, the problem, and the next action.
- [ ] Validation commands cover target repository contracts, profile validation, source-bundle schema validation, CLI preflight behavior, existing report fixtures, and `npm run preflight`.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Product-repository identity becomes hardcoded too narrowly. | Reuse outside this repository becomes awkward. | Add injectable/configurable product repository identity for tests and future packaging; keep the CLI default aligned with this repo. |
| Profile validation adds dependency or custom-validator complexity. | Maintenance cost may exceed benefit. | Prefer the smallest reliable validator that can cover existing schemas and invalid regex checks; add a dependency only if local validation becomes misleading. |
| Source-bundle schema overfits GitHub payload details. | Normal upstream API drift could break tests unnecessarily. | Schema only the collector-owned canonical bundle fields consumed downstream; keep raw GitHub extras out or allow them only in explicitly raw subtrees. |
| Early validation blocks exploratory local use. | Users may need a quick way to inspect partial data. | Make errors actionable and focused; keep degraded GitHub coverage as report data when the target/profile contracts are valid. |
| Documentation hygiene turns into bureaucracy. | Planning docs could slow implementation. | Keep the rule simple: done initiatives must reflect shipped/deferred state; backlog remains allowed to have TODO checklists. |
| Docs hygiene in `npm test` changes the maintainer workflow. | Ordinary validation can fail on planning-bookkeeping mistakes. | Keep the check narrow to `docs/initiatives/done/**` and document allowed deferred markers clearly. |

## Testing Strategy

- Unit tests for target repository product-repository rejection in the live CLI/collector path.
- Runtime and schema tests for repository profiles and source bundles.
- CLI tests proving invalid profiles fail before provider calls.
- Existing fixture normalization, metrics, report, full `npm test`, and `npm run preflight` runs.
- A docs hygiene Node test that flags unchecked criteria in `docs/initiatives/done/**` while allowing backlog TODOs and documented deferred items.

## Resolved Decisions

- [x] Should analysis be PR-count based or day-window based? PR-count based. Latest-N merged PRs remain the MVP selection model.
- [x] Should repository profile validation be considered worthwhile? Yes, with the tradeoff that validation should stay small and fail early.
- [x] Should source bundles get a schema? Yes, as a collector-owned canonical source-bundle schema rather than a complete GitHub raw API schema.
- [x] Is PR class segmentation implemented? Yes. PR class rules, report context, explicit filtering, and profile docs are completed in the [PR Class Segmentation](../../done/pr-class-segmentation/prd.md) initiative and are baseline behavior for this initiative.
- [x] Should completed initiative docs be reconciled? Yes. Completed docs should accurately track shipped, deferred, and answered decisions.
- [x] How should product repository identity be configured? Use a repo-local default plus injectable module/API override; defer public CLI/config surface until reuse outside this repository requires it.
- [x] How should schema validation be implemented? Use focused runtime validators plus schema contract tests; add a JSON Schema dependency only if local validation becomes misleading or too costly.
- [x] How should docs hygiene be enforced? Add an automated local Node test that runs under `npm test`; reviewer guidance is supporting documentation, not the enforcement mechanism.
- [x] Does this backlog initiative remain relevant after the later setup, report-usability, interactive CLI, run preset, and maintainer-readiness initiatives? Yes. Those initiatives added surfaces that make validation more important; they did not add product-repository preflight, full profile validation, a source-bundle schema, or done-doc hygiene automation.

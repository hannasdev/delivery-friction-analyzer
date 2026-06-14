# Contract Validation Hardening

## Status

Status: Backlog.

- State: Backlog
- Owner: Hanna
- Created: 2026-06-13
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

- The product repository and target repository are documented as separate concepts, but live analysis does not enforce that separation in the CLI path.
- Repository profiles have a JSON schema and are central to trustworthy file-role classification, but live analysis currently parses profile JSON and trusts the shape at normalization time.
- `source-bundle.json` is a core traceability artifact for live analysis, but it is versioned without a schema-backed contract.
- Completed initiative docs had stale unchecked criteria and unresolved questions, which made it hard to distinguish implemented work from TODOs.

The PR-count selection wording and completed-initiative bookkeeping were corrected during the quality pass. This initiative covers the remaining hardening needed so future changes preserve those contracts intentionally.

## Goals

- Enforce product-repository versus target-repository separation in the live analysis path.
- Validate repository profiles before collection or report generation depends on profile rules.
- Add a schema-backed `github-source-bundle.v1` contract for the collector-owned source bundle.
- Keep failures actionable and early, especially before expensive or rate-limited GitHub calls.
- Preserve local/offline testability with mocked GitHub providers and fixture data.
- Add lightweight documentation hygiene so completed initiatives do not keep stale unchecked criteria or unresolved decisions.

## Non-Goals

- Do not implement PR class segmentation; that remains in the separate [PR Class Segmentation](../pr-class-segmentation/prd.md) backlog initiative.
- Do not add date-window collection or `--since`; live analysis remains latest-N merged PRs.
- Do not add hosted services, GitHub Apps, webhooks, dashboards, or persistent server-side state.
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
- Profile preflight should validate `repository-profile.v1` and invalid regex matchers with clear rule-specific errors.
- Source bundle generation should produce data that validates against a new `github-source-bundle.v1` schema covering collector metadata, target repository, selection, coverage, language context, and PR payload fields consumed by normalization.
- Documentation work should audit and reconcile the existing latest-N PR selection, artifact sensitivity, branch-based workflow-run caveat, and deferred source-bundle redaction guidance rather than rewriting already-current reference docs.
- Completed initiative artifacts should stay reconciled: implemented acceptance criteria checked, intentionally deferred scope called out as deferred, and unresolved questions answered or moved into backlog initiatives.

Implementation decisions:

- Product repository identity should use a repo-local default for `hannasdev/delivery-friction-analyzer` plus an injectable module/API override for tests and future packaging. Do not add a public CLI option in M1.
- Repository profile validation should use focused runtime validators for actionable CLI errors plus schema contract tests for fidelity. Do not add a JSON Schema dependency unless the focused validator proves misleading or too broad to maintain.
- Docs hygiene should be an automated local Node test that runs under the existing `npm test` command. Reviewer guidance can explain the convention, but reviewer practice alone is not sufficient for M3.

## User / Maintainer Workflows

- A maintainer accidentally points the analyzer at this product repository and receives a clear preflight error before GitHub collection begins.
- A maintainer edits a repository profile with a misspelled field or invalid regex and receives a focused profile validation error that names the rule.
- A contributor changes live collection shape and sees a schema test fail before reports silently lose evidence.
- A reviewer inspects a completed initiative and can tell what shipped, what was intentionally deferred, and what belongs to backlog.

## Acceptance Criteria

- [ ] Live analysis rejects the configured product repository before provider calls.
- [ ] Repository profile validation runs before GitHub collection or report generation depends on profile rules.
- [ ] `github-source-bundle.v1` has a checked-in schema and tests that validate collector output.
- [ ] Contract docs are audited and reconciled for latest-N PR selection, profile validation, source-bundle schema boundaries, and known workflow-run caveats.
- [ ] Completed initiative docs contain no stale unchecked implemented criteria or unanswered open questions.
- [ ] Validation commands cover target repository contracts, profile validation, source-bundle schema validation, CLI preflight behavior, and existing report fixtures.

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
- Schema tests for repository profiles and source bundles.
- CLI tests proving invalid profiles fail before provider calls.
- Existing fixture normalization, metrics, report, and full `npm test` runs.
- A docs hygiene Node test that flags unchecked criteria in `docs/initiatives/done/**` while allowing backlog TODOs and documented deferred items.

## Resolved Decisions

- [x] Should analysis be PR-count based or day-window based? PR-count based. Latest-N merged PRs remain the MVP selection model.
- [x] Should repository profile validation be considered worthwhile? Yes, with the tradeoff that validation should stay small and fail early.
- [x] Should source bundles get a schema? Yes, as a collector-owned canonical source-bundle schema rather than a complete GitHub raw API schema.
- [x] Is PR class segmentation implemented? No. It is backlog/TODO only and should stay separate from this initiative.
- [x] Should completed initiative docs be reconciled? Yes. Completed docs should accurately track shipped, deferred, and answered decisions.
- [x] How should product repository identity be configured? Use a repo-local default plus injectable module/API override; defer public CLI/config surface until reuse outside this repository requires it.
- [x] How should schema validation be implemented? Use focused runtime validators plus schema contract tests; add a JSON Schema dependency only if local validation becomes misleading or too costly.
- [x] How should docs hygiene be enforced? Add an automated local Node test that runs under `npm test`; reviewer guidance is supporting documentation, not the enforcement mechanism.

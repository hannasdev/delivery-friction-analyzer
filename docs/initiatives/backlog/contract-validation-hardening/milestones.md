# Contract Validation Hardening Milestones

## M1: Runtime Preflight Validation

### Outcome

Live analysis fails early and clearly when the target repository or profile contract is invalid.

### Scope

- Wire product-repository separation into the live CLI/collector path.
- Add runtime repository profile validation for user-supplied profiles before provider calls or normalization.
- Validate invalid profile regex rules with errors that name the affected rule ID.
- Audit and reconcile target repository and repository profile docs for the enforced preflight behavior.
- Add focused tests for product repository rejection, malformed profile shape, and invalid profile regex.

### Non-Goals

- Do not add source-bundle schema validation in this milestone.
- Do not add PR class segmentation.
- Do not introduce date-window collection.
- Do not change report ranking formulas or recommendation categories.

### Acceptance Criteria

- [ ] `runAnalyzeGithub` or the collector rejects the configured product repository before any provider method is called.
- [ ] Invalid user-supplied repository profile JSON shape fails before provider calls with an actionable error.
- [ ] Invalid user-supplied profile regex patterns fail preflight and name the rule ID.
- [ ] Existing valid fixture profiles continue to run through live CLI tests.
- [ ] Existing docs are audited and reconciled to describe target/product separation enforcement and profile validation behavior without duplicating already-current guidance.

### Required Validation

- `node --test test/target-repository.test.mjs`
- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/profile.test.mjs`
- `npm test`

### Scope Budget

- Acceptance criteria: 5
- Major subsystem boundaries: CLI/collector preflight and profile validation
- Estimated non-generated diff: under 700 changed lines
- Validation story: focused unit/CLI tests plus full suite
- Split rationale: Product target enforcement and profile validation both protect pre-provider input contracts, so they are reviewable together.

### Risks / Watchpoints

- Product repository identity should be configurable or injectable enough for tests and future reuse.
- Profile validation errors should be precise; generic schema dumps would make local setup painful.
- Profile validation is a live CLI/user-profile boundary concern first. Normalization helpers can stay defensive, but should not be the only place invalid user profiles are discovered.
- Invalid regex behavior should change from silent non-match to preflight failure only for user-supplied profiles.

### Status

- [ ] Not started

## M2: Source Bundle Schema Contract

### Outcome

The live collector emits a source bundle that is validated against a checked-in `github-source-bundle.v1` schema.

### Scope

- Add `schemas/github-source-bundle.schema.json`.
- Define schema coverage for collector metadata, target repository, repository metadata, selection, coverage, language distribution, and PR payload fields consumed by normalization.
- Add tests that validate mocked live collector output against the source-bundle schema.
- Audit and reconcile docs to distinguish the source-bundle contract from raw GitHub API payloads.
- Keep coverage labels for unavailable PR-open diff data, GraphQL review-thread coverage, and branch-based workflow-run lookup explicit.

### Non-Goals

- Do not schema every raw GitHub field that is not consumed downstream.
- Do not add source-bundle redaction or sharing workflows.
- Do not change normalized entity schema except where required by the source-bundle contract.
- Do not add direct HTTP GitHub providers.

### Acceptance Criteria

- [ ] A `github-source-bundle.v1` schema exists and is referenced by documentation.
- [ ] Collector test output validates against the schema.
- [ ] Schema tests catch missing required collector, selection, coverage, and PR fields.
- [ ] The schema preserves explicit unavailable/partial coverage instead of forcing invented counts.
- [ ] Documentation explains that the schema covers the analyzer's canonical source bundle, not the full GitHub API, and does not rewrite already-current collection caveats unnecessarily.

### Required Validation

- `node --test test/github-collector.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `node --test test/fixture-normalization.test.mjs`
- `npm test`

### Scope Budget

- Acceptance criteria: 5
- Major subsystem boundaries: source-bundle schema and collector tests
- Estimated non-generated diff: under 700 changed lines
- Validation story: contract tests over mocked collector output plus downstream normalization tests

### Risks / Watchpoints

- Avoid over-constraining fields that GitHub can add, omit, or rename without affecting analyzer behavior.
- Keep `null` versus unavailable semantics aligned with downstream normalization and coverage reporting.
- Source bundle schema should make future PR class or filter work easier, not force that work into this milestone.

### Status

- [ ] Not started

## M3: Done-Docs Hygiene Guard

### Outcome

Completed initiative docs stay reliable as implementation records instead of accumulating stale TODO markers.

### Scope

- Add a lightweight Node test for `docs/initiatives/done/**` that runs under `npm test`.
- Flag unchecked checklist items in done initiatives unless they are explicitly labeled as deferred, intentionally omitted, or historical status options.
- Document how to record deferred scope when moving initiatives to done.
- Add or update tests so the check can run locally without network access.

### Non-Goals

- Do not apply the done-docs check to backlog or active initiatives.
- Do not require every planning artifact to use the exact same template.
- Do not block implementation on broad documentation rewrites unrelated to completed initiative state.
- Do not move backlog initiatives to done or active.

### Acceptance Criteria

- [ ] A local Node test identifies stale unchecked items in done initiative docs and runs under `npm test`.
- [ ] The check permits backlog TODOs and explicitly deferred done items.
- [ ] Repository guidance explains how to mark shipped, deferred, or intentionally omitted work in completed initiatives.
- [ ] Current done initiatives pass the check.

### Required Validation

- `npm test`
- Manual: inspect one done initiative with shipped criteria, resolved decisions, and any deferred notes

### Scope Budget

- Acceptance criteria: 4
- Major subsystem boundaries: documentation hygiene test
- Estimated non-generated diff: under 400 changed lines
- Validation story: local docs check through `npm test`

### Risks / Watchpoints

- A strict check may become annoying if historical docs have legitimate open-ended notes.
- Keep the check narrow so backlog planning remains free to contain TODOs.
- Prefer clear deferred labels over silently checking work that did not ship.

### Status

- [ ] Not started

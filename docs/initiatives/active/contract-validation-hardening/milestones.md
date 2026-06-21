# Contract Validation Hardening Milestones

## M1: Runtime Preflight Validation

### Outcome

Live analysis fails early and clearly when the target repository or current repository profile contract is invalid.

### Scope

- Wire product-repository separation into the live CLI/collector path.
- Add runtime repository profile validation for user-supplied profiles before provider calls or normalization. Cover `schemaVersion`, repository identity, file-role rules, PR class rules, workflow context, contributor-source config, unsupported top-level keys, and invalid regex matchers.
- Validate duplicate file-rule IDs, unsupported file-rule keys, invalid category/role/functional-surface/generated values, invalid repository identity shape, and invalid matcher shape with actionable field or rule errors.
- Validate invalid file-rule and PR-class regex patterns with errors that name the affected rule ID and matcher field.
- Preserve existing defensive fallback behavior only for internal fixture/helper paths where a profile is intentionally omitted or partial; user-supplied live CLI profiles must fail before collection when invalid.
- Audit and reconcile target repository, repository profile, and run preset docs for the enforced preflight behavior.
- Add focused tests for product repository rejection, malformed profile shape, invalid file-rule regex, invalid PR-class regex, and preset/profile validation ordering.

### Non-Goals

- Do not add source-bundle schema validation in this milestone.
- Do not add new PR class behavior; existing PR class segmentation remains baseline.
- Do not add branch-based PR class matching or new contributor-source parsers.
- Do not introduce date-window collection.
- Do not change report ranking formulas or recommendation categories.
- Do not change run preset persistence beyond documenting that presets reference validated profile paths.

### Acceptance Criteria

- [ ] `runAnalyzeGithub` or `collectGitHubSourceBundle` rejects the configured product repository before any provider method is called, with copy that explains the product/target distinction, tells the maintainer to choose a different `--repo`, and confirms no GitHub data was collected.
- [ ] Invalid user-supplied repository profile identity, top-level shape, unsupported keys, or required fields fail before provider calls with an actionable field/path error.
- [ ] Invalid file-rule IDs, duplicate IDs, matcher shape, category, role, functional surface, generated flag, or unsupported keys fail before provider calls with an actionable field/rule error.
- [ ] Invalid user-supplied file-rule and PR-class regex patterns fail preflight and name the rule ID and matcher field.
- [ ] User-facing validation failures name the failing file or command context, the invalid field/path/rule, the problem, and the next action; malformed-profile guidance tells users what to edit and reserves interactive setup for creating or regenerating a starter profile.
- [ ] Existing PR class, workflow, and contributor-source validation remains enforced through the same profile preflight path.
- [ ] Preset-sourced profile paths and dry-run flows use the same profile validation path as explicit `--profile` runs.
- [ ] Existing valid fixture profiles continue to run through live CLI tests.
- [ ] Existing docs are audited and reconciled to describe target/product separation enforcement, profile validation behavior, and run preset/profile ownership without duplicating already-current guidance.

### Required Validation

- `node --test test/target-repository.test.mjs`
- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/profile.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `npm test`
- `npm run preflight`

### Scope Budget

- Acceptance criteria: 9
- Major subsystem boundaries: CLI/collector preflight and profile validation, with narrow docs/preset coverage for the same input-contract boundary
- Estimated non-generated diff: under 750 changed lines
- Validation story: focused unit/CLI/schema tests plus full suite and repo preflight
- Split rationale: This exceeds the 5-criterion preference because the criteria make one boundary precise rather than adding separate product behavior. Product target enforcement, explicit profile validation, preset profile-path validation, and docs updates all protect the pre-provider input contract; splitting product-repository rejection from profile validation would create two small PRs that both modify the same CLI/collector preflight path and duplicate review setup.

### Risks / Watchpoints

- Product repository identity should be configurable or injectable enough for tests and future reuse.
- Profile validation errors should be precise; generic schema dumps would make local setup painful.
- Copy assertions should cover representative validation families and required message components rather than full-string snapshots across every validator path.
- Profile validation is a live CLI/user-profile boundary concern first. Normalization helpers can stay defensive, but should not be the only place invalid user profiles are discovered.
- Invalid file-rule regex behavior should change from silent non-match to preflight failure only for user-supplied profiles.
- Saved run presets should not hide profile validation because presets store profile paths, not profile rules.

### Status

- [x] Active

## M2: Source Bundle Schema Contract

### Outcome

The live collector emits a source bundle that is validated against a checked-in `github-source-bundle.v1` schema.

### Scope

- Add `schemas/github-source-bundle.schema.json`.
- Define schema coverage for collector metadata, target repository, repository metadata, selection, coverage, language distribution, optional contributor-source metadata, and PR payload fields consumed by normalization.
- Add tests that validate mocked live collector output against the source-bundle schema.
- Add negative schema tests for missing required fields and unexpected canonical wrapper fields unless they live under a deliberate future `raw` subtree.
- Audit and reconcile docs to distinguish the source-bundle contract from raw GitHub API payloads.
- Keep coverage labels for unavailable PR-open diff data, GraphQL review-thread coverage, and branch-based workflow-run lookup explicit.

### Non-Goals

- Do not schema every raw GitHub field that is not consumed downstream.
- Do not add source-bundle redaction or sharing workflows.
- Do not change normalized entity schema except where required by the source-bundle contract.
- Do not add direct HTTP GitHub providers.
- Do not change contributor-source behavior beyond schema coverage for the current sanitized source-bundle metadata.

### Acceptance Criteria

- [ ] A `github-source-bundle.v1` schema exists and is referenced by documentation.
- [ ] Collector test output validates against the schema, including a case with contributor-source metadata.
- [ ] Schema tests catch missing required collector, selection, coverage, and PR fields.
- [ ] Schema tests reject unexpected collector-owned canonical wrapper fields unless they are under an explicit future `raw` subtree.
- [ ] Schema validation failures name the generated artifact or fixture, the schema path or field when available, and whether the expected fix is collector output or the schema contract.
- [ ] The schema preserves explicit unavailable/partial coverage instead of forcing invented counts.
- [ ] Source-bundle tests prove contributor-source metadata may include source type, path, coverage/status, and hint count, but not raw contributor file contents or login lists.
- [ ] Documentation explains that the schema covers the analyzer's canonical source bundle, not the full GitHub API, and does not rewrite already-current collection caveats unnecessarily.

### Required Validation

- `node --test test/github-collector.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `node --test test/fixture-normalization.test.mjs`
- `npm test`
- `npm run preflight`

### Scope Budget

- Acceptance criteria: 8
- Major subsystem boundaries: source-bundle schema and collector tests
- Estimated non-generated diff: under 700 changed lines
- Validation story: contract tests over mocked collector output plus downstream normalization tests and repo preflight
- Split rationale: This exceeds the 5-criterion preference only to make privacy and strictness boundaries independently testable; the implementation remains one artifact contract plus its tests.

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
- Flag unchecked checklist items in done initiatives unless they are explicitly labeled as deferred, intentionally omitted, future-decision items, backlog-linked follow-ups, or narrow historical status options. Backlog-linked follow-ups must include a concrete `docs/initiatives/backlog/...` path, a relative Markdown link into `../backlog/`, or an issue/PR URL. Historical status options are limited to lifecycle/status checklist entries under a `Status` heading; stale acceptance criteria and open questions still require an allowed label or backlog link. Bare unchecked `Open Questions` in `done/**` should fail with a file path and the allowed labels.
- Reconcile current done initiatives so shipped criteria are checked and legitimate deferred/future-decision items are labeled consistently.
- Document how to record shipped, deferred, future-decision, backlog-linked, and intentionally omitted scope when moving initiatives to done, including at least one allowed unchecked example and one rejected bare open-question example.
- Add or update tests so the check can run locally without network access.

### Non-Goals

- Do not apply the done-docs check to backlog or active initiatives.
- Do not require every planning artifact to use the exact same template.
- Do not block implementation on broad documentation rewrites unrelated to completed initiative state.
- Do not move backlog initiatives to done or active.
- Do not force deferred or future-decision work to be planned immediately; label it clearly instead.

### Acceptance Criteria

- [ ] A local Node test identifies stale unchecked items in done initiative docs and runs under `npm test`.
- [ ] The check permits backlog TODOs and explicitly labeled deferred, intentionally omitted, future-decision, backlog-linked, or narrow historical status items in done docs, while rejecting bare unchecked `Open Questions` in `done/**`; backlog-linked items include a concrete `docs/initiatives/backlog/...` path, a relative Markdown link into `../backlog/`, or an issue/PR URL, and historical status allowance applies only to lifecycle/status checklist entries, not stale acceptance criteria or open questions.
- [ ] Docs-hygiene failures name the file, the unresolved checklist item or open question, and the allowed labels or backlog-link convention.
- [ ] Repository guidance explains how to mark shipped, deferred, future-decision, backlog-linked, or intentionally omitted work in completed initiatives.
- [ ] Current done initiatives pass the check.

### Required Validation

- `npm test`
- `npm run preflight`
- Manual: inspect one done initiative with shipped criteria, resolved decisions, and any deferred notes

### Scope Budget

- Acceptance criteria: 5
- Major subsystem boundaries: documentation hygiene test
- Estimated non-generated diff: under 400 changed lines
- Validation story: local docs check through `npm test`, repo preflight, and one manual done-doc inspection

### Risks / Watchpoints

- A strict check may become annoying if historical docs have legitimate open-ended notes.
- Keep the check narrow so backlog planning remains free to contain TODOs.
- Prefer clear deferred labels over silently checking work that did not ship.
- Current done docs contain unchecked items from completed PR class filtering, interactive setup, setup/report usability, and deferred report-context work, so this milestone must support a measured reconciliation rather than a blanket checkbox rewrite.

### Status

- [ ] Not started

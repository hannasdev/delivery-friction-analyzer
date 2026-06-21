# Contract Validation Hardening Architecture Notes

## Boundaries

This initiative hardens existing boundaries rather than adding new analytics:

- target repository input contract;
- live CLI and collector preflight;
- repository profile schema validation;
- source-bundle artifact contract;
- completed initiative documentation hygiene.

Baseline as of the 2026-06-21 relevance review:

- `validateTargetRepository` can reject the product repository when a `productRepository` option is supplied, but the live collection path does not yet supply that identity.
- Live profile reading validates PR class rules, workflow context, and contributor-source config, but does not validate the full profile shape, file-role rules, or invalid file-rule regex matchers.
- The collector emits `schemaVersion: github-source-bundle.v1`, but there is no checked-in `schemas/github-source-bundle.schema.json`.
- Done initiative docs still contain unchecked shipped criteria, deferred work, future decisions, and historical status options without an automated distinction between them.

The existing data flow remains:

```text
GitHub provider -> source bundle -> normalized entities -> metrics summary -> report artifacts
```

Validation should happen at the earliest boundary that has enough information to produce an actionable error.

## Product Repository Separation

The product repository rule comes from the product model, not from GitHub. This repository builds the analyzer; the target repository is the repository being analyzed. The MVP originally used `hannasdev/mcp-writing` as validation data because this repository did not have meaningful PR history.

Implementation should preserve:

- a default product repository identity for this repository;
- an injectable product repository identity in module-level APIs so tests can prove rejection without depending on global state;
- a clear error when `--repo` matches the product repository case-insensitively;
- no GitHub provider calls after a product-repository mismatch is detected.

The product-repository error should be written for someone who does not already know the product/target distinction. It should name the rejected repository, explain that it is this tool's product repository, tell the maintainer to choose the repository they want to measure with `--repo owner/name`, and state that no GitHub data was collected.

Decision:

- Use a repo-local default product repository identity for `hannasdev/delivery-friction-analyzer`.
- Expose an injectable module/API override so tests and future packaging can supply a different product repository identity.
- Do not add a public CLI flag or config file for product repository identity in M1; that is future packaging surface area, not necessary for local MVP hardening.

Current code note:

- `src/contracts/target-repository.js` already has the comparison hook.
- `src/collect/github-source-bundle.js` currently validates target name and later collected metadata without a product repository option, so M1 should wire the existing contract into `runAnalyzeGithub` and/or `collectGitHubSourceBundle` before `provider.getRepository`.

## Repository Profile Validation

Repository profiles are user-authored inputs that control file role, generated status, and functional-surface classification. Invalid profiles can make reports look complete while silently misclassifying files.

Validation should cover:

- `schemaVersion`;
- `repository.owner` and `repository.name`;
- rule IDs, match objects, categories, roles, optional functional surfaces, and generated flags;
- duplicate rule IDs and unsupported rule keys where the current schema disallows them;
- invalid category, role, functional surface, generated flag, and matcher values;
- invalid regex patterns with rule-specific messages;
- PR class rule shape and title regex patterns;
- workflow context fields;
- contributor-source fields and repository-relative paths.

Decision and tradeoffs:

- Use focused runtime validation for actionable CLI errors and invalid regex checks.
- Use schema contract tests to keep checked-in schemas honest.
- Do not add a full JSON Schema validator dependency unless the focused runtime validator grows broad enough to become misleading or hard to maintain.
- Reuse existing PR class, workflow, and contributor-source validators so the same validation semantics apply in interactive setup, presets, and non-interactive runs.

The implementation should avoid vague errors. A maintainer should know which field or rule to fix.

Profile validation applies first to user-supplied repository profiles at live CLI/preflight boundaries. Normalization helpers should remain defensive for partial fixtures and tests, but invalid user profiles should not be discovered only after GitHub collection or during report generation.

Live CLI runs still require a repository profile. Defensive fallback behavior for omitted or partial profiles is limited to internal fixture/helper paths where tests intentionally exercise fallback classification.

Saved run presets do not own repository semantics. They should continue to point at a profile path, and the referenced profile should be validated before collection exactly as if it had been passed with `--profile`.

User-facing validation messages should name the file or command context, the invalid field/path/rule, what failed, and the next action. They should avoid generic schema dumps when a focused rule-specific message is possible. For malformed existing profiles, the next action should be to edit the named field or rule; interactive setup should be framed only as a way to create or regenerate a starter profile.

## Source Bundle Schema

`source-bundle.json` is source-shaped, but it is not a raw dump of every GitHub response. It is the analyzer's canonical collection artifact. The schema should describe that artifact, not GitHub's complete API.

Schema should cover:

- `schemaVersion: github-source-bundle.v1`;
- `collectedAt`;
- collector name/provider;
- target repository identity and PR sample limit;
- repository metadata used by downstream layers;
- selection strategy, requested limit, and collected count;
- coverage summary and per-family diagnostics;
- language distribution context;
- optional sanitized contributor-source metadata and its coverage, without raw contributor file contents or transient hint lists;
- PR fields consumed by normalization:
  - identity, title, author, URL, state, timestamps, base/head refs;
  - final diff counts;
  - PR-open diff source/confidence;
  - commits;
  - files;
  - reviews;
  - review threads and comments;
  - status check rollup;
  - workflow runs;
  - per-PR coverage.

The schema should allow optional or nullable values where GitHub coverage is legitimately unavailable. It should not require invented empty counts when the source label says unavailable.

Schema validation failures are contributor-facing test output. They should name the generated artifact or fixture, the schema path or field that failed when available, and whether the expected fix is to change collector output or intentionally update the schema contract.

Strictness decision:

- Use `additionalProperties: false` for collector-owned canonical wrapper objects and mapped entities where downstream code depends on the shape.
- Do not include broad raw GitHub response subtrees in `github-source-bundle.v1`.
- If a future collector needs raw/extensible payloads, put them under an explicit `raw` subtree with `additionalProperties: true` and keep downstream normalization tied to canonical mapped fields.
- Keep coverage diagnostics as arrays of strings and keep source/coverage labels adjacent to nullable counts so unavailable evidence is not confused with observed zero.
- Preserve current contributor-source privacy boundaries: schema the source type, path, coverage, and hint count, but do not require or permit raw contributor contents or login lists in the canonical bundle.

## Documentation Hygiene

Done initiatives are used as implementation history. They should not read like active TODO lists.

Recommended convention:

- checked boxes mean shipped or otherwise resolved;
- deferred work should be labeled directly, for example `Deferred: ...`;
- future decisions should be labeled directly, for example `Future decision: ...`;
- backlog-linked follow-ups should include a concrete `docs/initiatives/backlog/...` path, a relative Markdown link into `../backlog/`, or an issue/PR URL;
- intentionally omitted scope should be named in non-goals or a completion note;
- historical status allowance is limited to lifecycle/status checklist entries under a `Status` heading, not stale acceptance criteria or open questions;
- bare unchecked `Open Questions` should not remain in `docs/initiatives/done/**`;
- backlog and active initiatives can keep unchecked TODO-style acceptance criteria.

M3 should add a Node test that scans only `docs/initiatives/done/**` and runs under `npm test`, so planning artifacts remain useful while completed artifacts stay reliable. Reviewer guidance can document the convention, but automation is the enforcement mechanism. The initial reconciliation should be careful: some unchecked items in done docs are shipped criteria that should be checked, while others are legitimate deferred or future-decision notes that should be labeled rather than marked shipped.

Docs-hygiene failures should be written for quick correction. They should name the file, the unresolved checklist item or open question, and the allowed labels or backlog-link convention instead of only reporting a generic scan failure. The backlog-link convention should match the parser rule exactly: a `docs/initiatives/backlog/...` path, a relative Markdown link into `../backlog/`, or an issue/PR URL.

## Failure Modes

- Product repository selected as target: fail before provider calls with a clear product/target separation message.
- Profile file is invalid JSON: keep the existing JSON parse error behavior.
- Profile shape is invalid, including repository identity, duplicate rule IDs, unsupported keys, category/role/surface/generated values, or matcher shape: fail before provider calls with field/path-oriented errors.
- Profile file-rule or PR-class regex is invalid: fail before provider calls with rule ID and regex field name.
- Live CLI profile is missing: keep requiring a repository profile; fallback profile behavior is only for internal fixture/helper paths.
- Source bundle schema validation fails in tests: block collector/report changes until the contract or implementation is intentionally updated.
- Done docs contain unchecked criteria or bare open questions: fail the docs hygiene check unless the item is explicitly deferred, future-decision labeled, intentionally omitted, backlog-linked, or outside the done subtree. Historical status allowance only applies to lifecycle/status checklist entries under a `Status` heading.

## Migration Strategy

The target repository contract has already moved to `analysisPullRequestLimit`; PR class segmentation, explicit PR class filtering, workflow profile context, contributor-source metadata, run presets, and maintainer preflight scripts are also baseline behavior. This initiative should validate those existing contracts without changing their product behavior.

M1 and M2 may require fixture/golden updates because target metadata and source-bundle schema expectations are serialized into fixture artifacts. Those updates should be deterministic and produced through existing report/fixture commands where possible.

## Alternatives Considered

- Leave profile validation to tests only: rejected because user-authored profiles fail too late and can silently distort reports.
- Treat source bundles as raw, schema-free evidence: rejected because `source-bundle.json` is central to report traceability and downstream normalization.
- Validate every raw GitHub field exactly: rejected because it overfits upstream APIs and makes harmless GitHub changes expensive.
- Keep done initiative docs as historical unchecked plans: rejected because readers need completed docs to distinguish shipped work from TODOs.

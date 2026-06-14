# Contract Validation Hardening Architecture Notes

## Boundaries

This initiative hardens existing boundaries rather than adding new analytics:

- target repository input contract;
- live CLI and collector preflight;
- repository profile schema validation;
- source-bundle artifact contract;
- completed initiative documentation hygiene.

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

Decision:

- Use a repo-local default product repository identity for `hannasdev/delivery-friction-analyzer`.
- Expose an injectable module/API override so tests and future packaging can supply a different product repository identity.
- Do not add a public CLI flag or config file for product repository identity in M1; that is future packaging surface area, not necessary for local MVP hardening.

## Repository Profile Validation

Repository profiles are user-authored inputs that control file role, generated status, and functional-surface classification. Invalid profiles can make reports look complete while silently misclassifying files.

Validation should cover:

- `schemaVersion`;
- `repository.owner` and `repository.name`;
- rule IDs, match objects, categories, roles, optional functional surfaces, and generated flags;
- invalid regex patterns with rule-specific messages.

Decision and tradeoffs:

- Use focused runtime validation for actionable CLI errors and invalid regex checks.
- Use schema contract tests to keep checked-in schemas honest.
- Do not add a full JSON Schema validator dependency unless the focused runtime validator grows broad enough to become misleading or hard to maintain.

The implementation should avoid vague errors. A maintainer should know which field or rule to fix.

Profile validation applies first to user-supplied repository profiles at live CLI/preflight boundaries. Normalization helpers should remain defensive for partial fixtures and tests, but invalid user profiles should not be discovered only after GitHub collection or during report generation.

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

Strictness decision:

- Use `additionalProperties: false` for collector-owned canonical wrapper objects and mapped entities where downstream code depends on the shape.
- Do not include broad raw GitHub response subtrees in `github-source-bundle.v1`.
- If a future collector needs raw/extensible payloads, put them under an explicit `raw` subtree with `additionalProperties: true` and keep downstream normalization tied to canonical mapped fields.
- Keep coverage diagnostics as arrays of strings and keep source/coverage labels adjacent to nullable counts so unavailable evidence is not confused with observed zero.

## Documentation Hygiene

Done initiatives are used as implementation history. They should not read like active TODO lists.

Recommended convention:

- checked boxes mean shipped or otherwise resolved;
- deferred work should be labeled directly, for example `Deferred: ...`;
- intentionally omitted scope should be named in non-goals or a completion note;
- backlog and active initiatives can keep unchecked TODO-style acceptance criteria.

M3 should add a Node test that scans only `docs/initiatives/done/**` and runs under `npm test`, so planning artifacts remain useful while completed artifacts stay reliable. Reviewer guidance can document the convention, but automation is the enforcement mechanism.

## Failure Modes

- Product repository selected as target: fail before provider calls with a clear product/target separation message.
- Profile file is invalid JSON: keep the existing JSON parse error behavior.
- Profile shape is invalid: fail before provider calls with schema/path-oriented errors.
- Profile regex is invalid: fail before provider calls with rule ID and regex field name.
- Source bundle schema validation fails in tests: block collector/report changes until the contract or implementation is intentionally updated.
- Done docs contain unchecked criteria: fail the docs hygiene check unless the item is explicitly deferred or outside the done subtree.

## Migration Strategy

The target repository contract has already moved to `analysisPullRequestLimit` in the current working tree. This initiative should treat that as the baseline.

M1 and M2 may require fixture/golden updates because target metadata and source-bundle schema expectations are serialized into fixture artifacts. Those updates should be deterministic and produced through existing report/fixture commands where possible.

## Alternatives Considered

- Leave profile validation to tests only: rejected because user-authored profiles fail too late and can silently distort reports.
- Treat source bundles as raw, schema-free evidence: rejected because `source-bundle.json` is central to report traceability and downstream normalization.
- Validate every raw GitHub field exactly: rejected because it overfits upstream APIs and makes harmless GitHub changes expensive.
- Keep done initiative docs as historical unchecked plans: rejected because readers need completed docs to distinguish shipped work from TODOs.

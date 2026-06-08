# Delivery Friction Analyzer

## Status

- State: Backlog
- Owner: Hanna
- Created: 2026-06-08
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [GitHub Risk Validation: `hannasdev/mcp-writing`](../../../research/github-risk-validation-mcp-writing.md)

## Problem

AI-assisted development has shifted the bottleneck from producing a working implementation to reducing the number of corrective loops required before that implementation is ready to merge.

Developers can now move from idea to draft feature quickly, but the expensive part is increasingly the back-and-forth that follows: Copilot review findings, human review comments, CI failures, missing tests, scope expansion, documentation gaps, and repeated fix commits. Today those loops are visible in GitHub, but they are not synthesized into a practical diagnosis of where delivery waste is highest or what to change.

The product should help teams answer: "Where are AI-assisted delivery cycles leaking time, and what intervention would reduce the next loop?"

## Goals

- Identify measurable GitHub signals that indicate review churn, validation waste, scope drift, and late corrective work in a repository.
- Produce an actionable friction report from GitHub data while keeping repository-specific assumptions in configurable profiles.
- Connect recurring friction patterns to concrete interventions such as repo-specific AI skills, pre-commit hooks, local validation scripts, planning gates, smaller milestones, or better PR readiness checks.
- Establish a data model that can later support richer repository profiles, vendor confidence/severity signals, and token/model usage data without making those unstable signals part of the MVP score.

## Non-Goals

- Do not build a general engineering productivity score or individual developer performance ranking.
- Do not require token or model usage data for the MVP.
- Do not attempt to judge whether a reviewer comment is correct unless the comment category requires basic classification.
- Do not replace code review, CI, or project management systems.
- Do not optimize for vanity metrics such as total PR volume without linking metrics to actionable delivery friction.
- Do not treat every language or file extension as having the same product role across repositories.
- Do not hardcode assumptions from any one source repository into the product model.

## Product And Design Alignment

The product should feel like an operational diagnostic tool rather than a dashboard for surveillance. Its value comes from finding preventable loops and suggesting precise workflow improvements.

The reporting experience should prioritize:

- repository and team-level patterns over individual blame;
- normalized metrics over raw counts;
- plain-language recommendations over abstract charts;
- drill-down from a high-level bottleneck to specific PR examples;
- clear separation between observed data, inferred diagnosis, and suggested intervention.

## Proposed Solution

Build a GitHub-connected analyzer that ingests pull request data and produces friction metrics across the PR lifecycle.

The first useful output is a local repository friction report that ranks the highest-waste patterns, explains the evidence, and recommends interventions. The report should combine raw observations with transparent component metrics such as comment-source density, iteration drag, validation gap indicators, planning gap indicators, diff growth, and changed-file spread.

The MVP should emit both Markdown and JSON report artifacts. Markdown makes the diagnosis readable; JSON provides a deterministic contract for tests and future UI work.

### Repo-Source-Agnostic MVP

The MVP should be repo-source-agnostic. `hannasdev/mcp-writing` can be used as a validation and fixture source, but no `mcp-writing`-specific product assumptions should be required for another repository to use the analyzer.

The product should support a repository profile that maps paths and languages to product roles before computing risk or friction. Examples of roles include:

- core application/library/runtime code;
- product UI;
- tests;
- generated docs;
- release notes and changelogs;
- planning or initiative docs;
- marketing site;
- configuration;
- infrastructure;
- fixtures;
- generated or vendored artifacts;
- unknown.

The MVP should not infer that `HTML` is always a product UI surface, that docs are always low-risk, or that generated files should always be ignored. Language distribution is repository context; file role and functional surface come from repository profile rules.

### Primary GitHub Signals

- PR lifecycle timestamps:
  - first commit time;
  - PR opened time;
  - first review time;
  - last review time;
  - merged or closed time.
- Pull request diff shape:
  - files changed at open;
  - lines added/deleted at open;
  - files changed at merge;
  - lines added/deleted at merge;
  - GitHub language distribution by byte count;
  - file category: code, tests, docs, config, generated, infrastructure, unknown;
  - file role: core product code, product UI, tests, generated docs, release notes, planning docs, marketing site, config, infrastructure, fixtures, generated/vendored artifacts, unknown;
  - changed-file spread, directory spread, and lines per non-generated code file.
- Review feedback:
  - review comment count;
  - review thread count;
  - unresolved or reopened thread count when available;
  - comment source: Copilot, human reviewer, GitHub Actions bot, dependency bot, code scanning, unknown bot;
  - Copilot review effort level when directly available, currently documented by GitHub as Low or Medium review effort;
  - Copilot comment severity when available, with an explicit source label such as public API, internal UI partial, inferred, or unavailable, but not as a primary trend metric;
  - vendor confidence or hidden-comment state when available, stored as a visibility signal rather than correctness;
  - comment target category: code, tests, docs, config, generated, infrastructure, unknown.
- Iteration churn:
  - commits after PR open;
  - commits after first review;
  - force pushes when available;
  - files introduced after review begins;
  - additional changed lines between PR open and merge.
- CI and validation:
  - failed check runs;
  - repeated failures of the same check;
  - cancelled or superseded workflow runs;
  - review-service check runs such as Copilot review attempts;
  - time spent waiting on failed and rerun checks;
  - commits that appear to address formatting, lint, typecheck, tests, snapshots, or CI config.
- PR metadata quality:
  - PR title and description presence;
  - linked issue or initiative;
  - test plan presence;
  - mismatch between described scope and final touched files.

### Derived Metrics

- Comment-source density: Copilot, human, bot, and scanner comments per 100 changed lines, per changed file, and per review round.
- Functional-surface density: review feedback and post-review churn split by configured file roles such as core product code, product UI, tests, generated docs, release notes, marketing site, config, and infrastructure.
- Iteration drag: post-review commits, review rounds, and elapsed time after feedback begins.
- Diff growth ratio: changed lines and files at merge compared with changed lines and files at open.
- Changed-file spread: number of non-generated files, code files, directories, and functional surfaces touched.
- Small-diff wide-spread flag: low changed-line count across many core code files or directories.
- Validation gap score: CI failures, repeated check failures, and comments about missing or broken validation.
- Planning gap score: late scope expansion, added files after review, and comments about requirements, architecture, or unclear intent.
- Review surprise score: comments and changed files that fall outside the PR title, description, linked issue, or initial scope.
- Fix amplification: additional changes required after PR open or after first review relative to the initial diff.

Composite scores are not required for the MVP. If a score-like value is included, the report must show its component inputs and formula version so users can understand why it changed.

### Recommendation Categories

- Add or improve pre-commit hooks for repeated formatting, lint, typecheck, or snapshot churn.
- Add local preflight scripts when CI catches issues that could have been caught before pushing.
- Add repo-specific AI skills or instructions when comments repeat around architecture, test expectations, documentation conventions, or dangerous APIs.
- Add a PR readiness gate when missing tests, weak descriptions, or unclear scope frequently appear in review.
- Break delivery into smaller milestones when PRs grow substantially between open and merge.
- Break cross-cutting changes into smaller milestones when a small diff touches many core files, directories, or functional surfaces.
- Improve planning artifacts when architecture or requirement comments dominate.
- Invest in test infrastructure when repeated CI failures or flaky checks are a major source of delay.

## User / Maintainer Workflows

- A maintainer connects a repository and receives a friction report for the last 30, 60, or 90 days of merged PRs.
- A team lead inspects the highest-friction PR examples and sees whether waste came from review churn, validation failures, scope growth, or planning gaps.
- A team compares before-and-after friction after adding a hook, skill, validation script, or planning gate.
- A product owner reviews whether AI-assisted delivery is becoming faster in mergeable output, not just faster in draft generation.

## Acceptance Criteria

- [ ] The product can ingest GitHub PRs, reviews, review comments, commits, check runs, and changed-file metadata for a selected repository.
- [ ] The product can ingest GitHub repository language distribution and preserve it as context, not as a direct risk score.
- [ ] The product can distinguish at least these file categories: code, tests, docs, config, generated, infrastructure, unknown.
- [ ] The product can apply a repository profile that distinguishes core product files from tests, generated docs, release notes, planning docs, marketing site files, config, infrastructure, fixtures, generated/vendored artifacts, and unknown files.
- [ ] The product can break review comments down by source: Copilot, human reviewer, GitHub Actions bot, dependency bot, code scanning, unknown bot.
- [ ] The product can compute raw counts and normalized metrics for review feedback, CI failures, lifecycle time, iteration churn, and diff growth.
- [ ] The product can compute changed-file spread and flag small diffs that touch many non-generated core files.
- [ ] The product can preserve Copilot review comment severity and confidence/visibility data when GitHub exposes it, but does not use unstable vendor labels as primary trend metrics.
- [ ] The product can generate Markdown and JSON repository friction reports with ranked bottlenecks, evidence, representative PR examples, and suggested interventions.
- [ ] The product can include coverage metadata that labels unavailable or partial GitHub data, missing scopes, rate limits, deleted branches, and PR-open diff reconstruction confidence.
- [ ] The product clearly labels inferred classifications separately from directly observed GitHub data.
- [ ] The product avoids individual developer ranking in the default reporting experience.
- [ ] Token and model usage integration is documented as a later extension, not a blocker for the MVP.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| GitHub may not expose Copilot severity in a stable, structured way through every API path. | Severity metrics may be incomplete or depend on undocumented UI payloads. | Public changelog checked on 2026-06-08 confirms Copilot comment severity labels, and the GitHub web UI partial exposed `automatedComment.severity: "medium"` for the sample comment. REST review comments and checked GraphQL review-thread fields did not expose severity. Preserve raw comment metadata, model review effort separately from comment severity, support fallback text classification, and label severity source. |
| Raw comment counts can reward shallow reviews or penalize thoughtful review. | Metrics may mislead teams. | Normalize by file category, changed lines, lifecycle phase, and severity; emphasize patterns and examples. |
| Comment counts vary by review culture and automation coverage. | Repositories with diligent human reviewers may look artificially high-friction, while automation-only repositories may look cleaner than they are. | Break feedback down by source and compare within-source trends before making cross-repository claims. |
| The product could feel like developer surveillance. | Low trust and poor adoption. | Default to team and repository-level reporting, avoid individual ranking, and focus recommendations on workflow improvements. |
| Diff line counts can be noisy for generated files, dependency updates, or fixture changes. | False positives in churn metrics. | Validation fixtures show that PRs often mix product code, tests, docs, generated artifacts, release notes, and planning files. Detect generated and low-signal file categories and exclude or down-weight them by default. |
| Repository language distribution can mislead role classification. | HTML, docs, or generated files may be core product surfaces in one repo and unrelated support surfaces in another. | Store GitHub language distribution as context, then use repository profile rules to classify file role and functional surface. Fixture-specific examples can calibrate defaults but must not become hardcoded product assumptions. |
| A small diff across many code files can hide cross-cutting risk. | Line-count-only metrics may understate changes that touch many modules or call sites. | Add changed-file spread, directory spread, functional-surface spread, and small-diff wide-spread flags after excluding generated and low-signal paths. |
| Missing permissions or rate limits can make reports look more complete than they are. | Users may trust metrics that are based on partial data. | Require an access and coverage matrix plus report-level coverage metadata for unavailable, degraded, rate-limited, or reconstructed data. |
| Opaque aggregate scores can create unproductive debates. | The MVP may spend effort defending formulas instead of surfacing bottlenecks. | Prefer component metrics and representative examples. Any score-like value must expose component inputs and formula version. |
| PR-open diff size is not directly available from simple PR metadata. | Open-vs-merge diff growth may be expensive or low-confidence to reconstruct after the fact. | Treat this as a confirmed reconstruction risk. In the MVP, reconstruct from commits/timeline with an explicit confidence label or mark unavailable. Post-MVP, consider GitHub App snapshots at PR-open time. |
| Recommendation quality may be weak if comments are not categorized well. | Reports may feel generic. | Confirmed by sampled comments spanning correctness, performance, safety, docs accuracy, generated docs, release-log hygiene, duplication, and clarity. Start with transparent rule-based categories, representative examples, and user-editable recommendation mappings. |
| Copilot review attempts can produce no comments or fail. | Counting only comments misses review-loop events and tool reliability friction. | Store review attempts, no-new-comment reviews, and failed review bodies as first-class review events. |
| Joining token/model usage with GitHub work may be hard. | Phase 2 attribution may be unreliable. | Treat model analytics as optional and require explicit join keys such as branch, PR number, commit SHA, or session metadata. |

## Testing Strategy

Testing should focus on correctness of data extraction, metric calculation, classification transparency, and report generation.

- Unit tests for file categorization, metric formulas, and recommendation mappings.
- Fixture-based integration tests using representative GitHub PR payloads.
- Contract tests for GitHub API adapters.
- Snapshot or golden-file tests for generated friction reports.
- Manual validation against a small set of real PRs where the diagnosis can be inspected.

## Open Questions

- [ ] What should the product be called publicly?
- [x] Should the MVP be a GitHub App, CLI, hosted dashboard, or local report generator? Start as a local GitHub report generator; GitHub App/webhook snapshot capture is post-MVP.
- [x] Which repositories should be used as the first validation dataset? Use `hannasdev/mcp-writing` as source fixture data only, not as product-specific scope.
- [ ] Can Copilot review effort be fetched reliably through GitHub APIs, or does it require a different integration path?
- [ ] Should the MVP include an experimental GitHub UI-partial extractor for Copilot comment severity, or avoid severity weighting until a stable public API source exists?
- [x] Can GitHub expose repository language distribution? Yes, through `GET /repos/{owner}/{repo}/languages`.
- [x] Should language distribution drive risk directly? No. It should inform a repository profile; file role and functional surface drive risk weighting.
- [x] Can GitHub expose review-thread resolution/outdated state? Yes, through GraphQL `reviewThreads`.
- [x] Is Copilot severity exposed in the checked review-comment/thread payloads? Not in checked public REST or GraphQL payloads. It is exposed in the GitHub web UI's deferred `automated-review-comment` React partial as `automatedComment.severity`.
- [x] Is full CI churn available beyond the final status rollup? Yes, workflow runs can be queried by PR branch/event, but branch deletion or rename may reduce reliability.
- [ ] Should recommendation mappings be manually configured per repo before the product attempts automated suggestions?
- [ ] What join keys are realistic for future token and model usage integration?
- [x] Which report format should come first? Markdown plus JSON; web UI is post-MVP.

## Shaped Backlog Features

These are valuable product directions, but they should not be part of the first local GitHub report MVP.

### Multi-Product Repository Profiles

Support richer repo profiles for client-side apps, libraries, CLIs, infrastructure repos, documentation sites, and mixed monorepos. The feature should let the same language mean different things in different products: HTML can be a marketing site in one repo, a core product surface in a web app, or generated docs in a library.

### Stable Vendor Signal Integrations

Track Copilot severity, confidence, hidden-comment thresholds, review effort, and future vendor labels when GitHub exposes stable APIs or when an experimental extractor is explicitly enabled. Reports should treat these as vendor signals with version/source metadata rather than durable quality scores.

### PR-Open Snapshot Capture

Add a GitHub App or webhook mode that stores PR-open diff snapshots so diff growth does not depend on historical reconstruction.

### PR Readiness Diagnosis

Generate a lightweight diagnosis for an open PR before the author requests review. This is a later workflow because the MVP focuses on repository-level historical friction reports, not live PR intervention.

### Token And Model Usage Attribution

Join model usage with GitHub delivery friction using explicit attribution keys such as branch, PR number, commit SHA, session ID, or timestamp window. This remains a later feature because attribution and privacy boundaries are harder than GitHub-only analytics.

### Hosted Dashboard And Cross-Repo Benchmarking

Build a hosted UI and multi-repository comparisons after the local report proves useful. Cross-repo comparisons must account for review culture, automation coverage, repository profiles, and privacy expectations before becoming a product promise.

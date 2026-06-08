# Delivery Friction Analyzer

## Status

- State: Backlog
- Owner: Hanna
- Created: 2026-06-08
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)

## Problem

AI-assisted development has shifted the bottleneck from producing a working implementation to reducing the number of corrective loops required before that implementation is ready to merge.

Developers can now move from idea to draft feature quickly, but the expensive part is increasingly the back-and-forth that follows: Copilot review findings, human review comments, CI failures, missing tests, scope expansion, documentation gaps, and repeated fix commits. Today those loops are visible in GitHub, but they are not synthesized into a practical diagnosis of where delivery waste is highest or what to change.

The product should help teams answer: "Where are AI-assisted delivery cycles leaking time, and what intervention would reduce the next loop?"

## Goals

- Identify measurable GitHub signals that indicate review churn, validation waste, scope drift, and late corrective work.
- Produce actionable friction reports for repositories and pull requests.
- Connect recurring friction patterns to concrete interventions such as repo-specific AI skills, pre-commit hooks, local validation scripts, planning gates, smaller milestones, or better PR readiness checks.
- Establish a foundation that can later join GitHub workflow data with token count and model usage data.

## Non-Goals

- Do not build a general engineering productivity score or individual developer performance ranking.
- Do not require token or model usage data for the MVP.
- Do not attempt to judge whether a reviewer comment is correct unless the comment category requires basic classification.
- Do not replace code review, CI, or project management systems.
- Do not optimize for vanity metrics such as total PR volume without linking metrics to actionable delivery friction.

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

The first useful output is a repository friction report that ranks the highest-waste patterns, explains the evidence, and recommends interventions. The report should combine raw observations with derived metrics such as severity-weighted comment density, iteration drag, validation gap score, planning gap score, and diff growth.

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
  - file category: code, tests, docs, config, generated, infrastructure, unknown.
- Review feedback:
  - review comment count;
  - review thread count;
  - unresolved or reopened thread count when available;
  - Copilot comment severity: high, medium, low;
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
  - time spent waiting on failed and rerun checks;
  - commits that appear to address formatting, lint, typecheck, tests, snapshots, or CI config.
- PR metadata quality:
  - PR title and description presence;
  - linked issue or initiative;
  - test plan presence;
  - mismatch between described scope and final touched files.

### Derived Metrics

- Severity-weighted comment density: weighted review feedback per 100 changed lines or per changed file.
- Iteration drag: post-review commits, review rounds, and elapsed time after feedback begins.
- Diff growth ratio: changed lines and files at merge compared with changed lines and files at open.
- Validation gap score: CI failures, repeated check failures, and comments about missing or broken validation.
- Planning gap score: late scope expansion, added files after review, and comments about requirements, architecture, or unclear intent.
- Review surprise score: comments and changed files that fall outside the PR title, description, linked issue, or initial scope.
- Fix amplification: additional changes required after PR open or after first review relative to the initial diff.

### Recommendation Categories

- Add or improve pre-commit hooks for repeated formatting, lint, typecheck, or snapshot churn.
- Add local preflight scripts when CI catches issues that could have been caught before pushing.
- Add repo-specific AI skills or instructions when comments repeat around architecture, test expectations, documentation conventions, or dangerous APIs.
- Add a PR readiness gate when missing tests, weak descriptions, or unclear scope frequently appear in review.
- Break delivery into smaller milestones when PRs grow substantially between open and merge.
- Improve planning artifacts when architecture or requirement comments dominate.
- Invest in test infrastructure when repeated CI failures or flaky checks are a major source of delay.

## User / Maintainer Workflows

- A maintainer connects a repository and receives a friction report for the last 30, 60, or 90 days of merged PRs.
- A team lead inspects the highest-friction PR examples and sees whether waste came from review churn, validation failures, scope growth, or planning gaps.
- A developer opens a PR and gets a lightweight readiness diagnosis before asking for review.
- A team compares before-and-after friction after adding a hook, skill, validation script, or planning gate.
- A product owner reviews whether AI-assisted delivery is becoming faster in mergeable output, not just faster in draft generation.

## Acceptance Criteria

- [ ] The product can ingest GitHub PRs, reviews, review comments, commits, check runs, and changed-file metadata for a selected repository.
- [ ] The product can distinguish at least these file categories: code, tests, docs, config, generated, infrastructure, unknown.
- [ ] The product can compute raw counts and normalized metrics for review feedback, CI failures, lifecycle time, iteration churn, and diff growth.
- [ ] The product can classify or preserve Copilot review comment severity when GitHub exposes it.
- [ ] The product can generate a repository friction report with ranked bottlenecks, evidence, representative PR examples, and suggested interventions.
- [ ] The product clearly labels inferred classifications separately from directly observed GitHub data.
- [ ] The product avoids individual developer ranking in the default reporting experience.
- [ ] Token and model usage integration is documented as a later extension, not a blocker for the MVP.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| GitHub may not expose Copilot severity in a stable, structured way through every API path. | Severity metrics may be incomplete. | Preserve raw comment metadata, support fallback text classification, and label severity source. |
| Raw comment counts can reward shallow reviews or penalize thoughtful review. | Metrics may mislead teams. | Normalize by file category, changed lines, lifecycle phase, and severity; emphasize patterns and examples. |
| The product could feel like developer surveillance. | Low trust and poor adoption. | Default to team and repository-level reporting, avoid individual ranking, and focus recommendations on workflow improvements. |
| Diff line counts can be noisy for generated files, dependency updates, or fixture changes. | False positives in churn metrics. | Detect generated and low-signal file categories and exclude or down-weight them by default. |
| Recommendation quality may be weak if comments are not categorized well. | Reports may feel generic. | Start with transparent rule-based categories, representative examples, and user-editable recommendation mappings. |
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
- [ ] Should the MVP be a GitHub App, CLI, hosted dashboard, or local report generator?
- [ ] Which repositories should be used as the first validation dataset?
- [ ] Can Copilot severity be fetched reliably through GitHub APIs, or does it require a different integration path?
- [ ] Should recommendation mappings be manually configured per repo before the product attempts automated suggestions?
- [ ] What join keys are realistic for future token and model usage integration?


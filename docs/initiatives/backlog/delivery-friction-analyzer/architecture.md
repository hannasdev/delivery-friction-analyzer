# Delivery Friction Analyzer Architecture Notes

## Context

The product depends on turning GitHub workflow events into trustworthy delivery-friction metrics. The architecture needs clear boundaries between raw GitHub data, normalized entities, inferred classifications, derived metrics, and recommendations so users can understand what the product observed versus what it inferred.

## Current State

This is a new repository with no implementation yet. The initial source of truth is GitHub data from pull requests, reviews, review comments, commits, check runs, changed files, and timeline events.

Token and model usage data is not part of the MVP. It is an extension that requires explicit attribution keys and privacy decisions.

## Target Shape

The first implementation should be able to run as a local analyzer or service-backed GitHub App, but the core design should remain modular:

- GitHub adapter: fetches raw GitHub data.
- Normalizer: converts provider-specific payloads into stable internal entities.
- Classifier: labels file categories, comment categories, severity source, and workflow signals.
- Metrics engine: computes raw and derived friction metrics.
- Recommendation engine: maps recurring patterns to suggested interventions.
- Reporter: produces human-readable and machine-readable reports.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Start with GitHub-only analytics. | GitHub has enough signal to validate the product without waiting for model usage attribution. | Start with token analytics first, but that risks solving a harder attribution problem before proving workflow value. |
| Keep observed data separate from inferred classifications. | Users need to trust the diagnosis and understand uncertainty. | Collapse everything into a single score, but that would be opaque. |
| Default reports to repository and team-level patterns. | The product should improve workflows without becoming developer surveillance. | Rank individuals, but that undermines trust and misuses noisy metrics. |
| Treat token/model analytics as an optional phase. | Attribution may be noisy and privacy-sensitive. | Require model logs for MVP, but that would slow adoption and narrow the first use case. |
| Use representative PR examples in recommendations. | Suggestions are more convincing when backed by concrete evidence. | Provide generic best practices, but those are less actionable. |
| Use GraphQL for review-thread analytics. | Live validation against `hannasdev/mcp-writing` showed GraphQL exposes review-thread count, resolution state, outdated state, paths, lines, and grouped comments. | REST-only review comments are simpler but lose thread state. |
| Model Copilot severity as optional. | Live validation did not find structured severity in checked REST or GraphQL comment/thread payloads. | Make severity required, but that would block useful MVP metrics. |

## Contracts And Boundaries

- Raw GitHub payloads should be stored or cached separately from normalized entities.
- Normalized PR entities should retain source IDs and URLs for traceability.
- Review attempts should be represented separately from individual review comments so failed Copilot reviews and no-new-comment rounds remain visible.
- Classifications must record their source:
  - `observed` for direct GitHub metadata;
  - `rule` for deterministic local categorization;
  - `model` for any future model-assisted classification;
  - `manual` for user-edited labels.
- Metrics should be deterministic for a given normalized dataset and classifier version.
- Recommendations should reference the metric evidence and example PRs that triggered them.
- Reports should default to repository-level aggregation and avoid individual rankings.
- PR-open diff measurements must record whether they came from an observed snapshot, reconstruction, or are unavailable.

## Data Model Sketch

Core entities:

- Repository
- PullRequest
- PullRequestSnapshot
- ChangedFile
- Review
- ReviewThread
- ReviewComment
- ReviewAttempt
- Commit
- CheckRun
- WorkflowRun
- MetricSummary
- Recommendation

Important fields:

- stable source IDs and URLs;
- timestamps for lifecycle and waiting-time calculations;
- file path, extension, additions, deletions, and category;
- comment author type, severity, body category, file target, and resolution status when available;
- severity source such as `observed`, `inferred`, or `unavailable`;
- check name, conclusion, duration, rerun relationship, and failure category when available;
- metric version and classifier version.

## Migration / Compatibility

There is no existing product data to migrate. The first implementation should still version normalized schemas and metric formulas so later reports can explain whether score changes came from workflow changes or analyzer changes.

## Failure Modes

- GitHub API data is incomplete or rate-limited: report partial coverage and show missing data categories.
- Copilot severity is unavailable: preserve comments and use an explicit `severity_source` value of `unavailable` or `inferred`.
- Generated files dominate a PR: mark the report as low-confidence unless generated files are excluded or down-weighted.
- A PR has limited metadata or no description: compute available metrics while marking planning-related classifications as low-confidence.
- Token/model attribution is ambiguous: do not attach usage to a PR unless the join key meets a documented confidence threshold.

## Security / Safety Considerations

- GitHub tokens must be treated as secrets and never written to reports or logs.
- Reports may include sensitive repository names, PR URLs, file paths, and comment text; storage and sharing should be explicit.
- The product should avoid publishing private repository analysis unless the user intentionally exports it.
- Any future model-assisted classification must avoid sending private code or comments to external services without explicit consent.
- Recommendation automation should not modify repositories without a separate explicit action.

## Validation

- Contract tests for GitHub adapter payloads.
- Unit tests for normalization and metric formulas.
- Fixture-based tests for common PR lifecycle shapes.
- Golden-file tests for generated reports.
- Manual review of early reports against known PRs to calibrate whether recommendations are useful.

## Open Questions

- [ ] Should the MVP persist raw GitHub payloads, or only normalized data and report artifacts?
- [ ] What is the minimum viable GitHub permission set for a public and private repository?
- [ ] Which report format should come first: Markdown, JSON, web UI, or all three?
- [ ] Should file categorization be globally defined or repo-configurable from the start?
- [ ] What confidence threshold is required before token/model usage can be attributed to a PR?

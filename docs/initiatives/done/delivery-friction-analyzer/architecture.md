# Delivery Friction Analyzer Architecture Notes

## Context

The product depends on turning GitHub workflow events into trustworthy delivery-friction metrics. The architecture needs clear boundaries between raw GitHub data, normalized entities, inferred classifications, derived metrics, and recommendations so users can understand what the product observed versus what it inferred.

## Current State

This is a new product repository with no implementation yet and little/no PR history. It is not expected to be a useful analysis target during MVP validation. The initial source of truth is GitHub data from configured target repositories: pull requests, reviews, review comments, commits, check runs, changed files, and timeline events.

Token and model usage data is not part of the MVP. It is an extension that requires explicit attribution keys and privacy decisions.

## Target Shape

The MVP is a local GitHub-connected report generator. It should run from the product repository, fetch live GitHub data for a configured target repository using local credentials, produce local report artifacts, and avoid hosted-service, webhook, or GitHub App assumptions.

The core design should remain modular so a future service-backed GitHub App can reuse the same normalizer, metrics, and reporter:

- GitHub adapter: fetches raw GitHub data.
- Normalizer: converts provider-specific payloads into stable internal entities.
- Repository profile: maps paths and languages to file roles and functional surfaces for the analyzed repository.
- Classifier: labels file categories, file roles, comment sources, comment categories, severity source, and workflow signals.
- Metrics engine: computes raw and derived friction metrics.
- Recommendation engine: maps recurring patterns to suggested interventions.
- Reporter: produces human-readable and machine-readable reports.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Start with GitHub-only analytics. | GitHub has enough signal to validate the product without waiting for model usage attribution. | Start with token analytics first, but that risks solving a harder attribution problem before proving workflow value. |
| Build the MVP as a local GitHub-connected report generator. | Local execution minimizes permissions, avoids hosted storage decisions, and keeps the first product wedge focused on analysis quality while still using live GitHub API data. | Start as a service-backed GitHub App, but that would pull webhook delivery, installation permissions, tenant storage, and PR-open snapshot capture into the MVP. |
| Produce Markdown and JSON reports first. | Markdown is readable and easy to review; JSON gives tests and future UI work a stable machine-readable contract. | Build a web UI first, but that adds presentation scope before the metrics and recommendations are proven. |
| Keep observed data separate from inferred classifications. | Users need to trust the diagnosis and understand uncertainty. | Collapse everything into a single score, but that would be opaque. |
| Default reports to repository and team-level patterns. | The product should improve workflows without becoming developer surveillance. | Rank individuals, but that undermines trust and misuses noisy metrics. |
| Treat token/model analytics as an optional phase. | Attribution may be noisy and privacy-sensitive. | Require model logs for MVP, but that would slow adoption and narrow the first use case. |
| Use representative PR examples in recommendations. | Suggestions are more convincing when backed by concrete evidence. | Provide generic best practices, but those are less actionable. |
| Use GraphQL for review-thread analytics. | Live validation against `hannasdev/mcp-writing` showed GraphQL exposes review-thread count, resolution state, outdated state, paths, lines, and grouped comments. | REST-only review comments are simpler but lose thread state. |
| Use repository profiles instead of hardcoded source-repo assumptions. | Language and file extension do not determine product role. HTML may be a marketing surface in one repo and core UI in another. | Bake assumptions from fixture repositories into metrics, but that would make the product misleading outside the source data. |
| Model Copilot review effort separately from comment severity. | Public docs describe Low/Medium as review effort levels. GitHub's changelog and live UI validation show a separate per-comment severity label, but checked public REST and GraphQL comment/thread payloads did not expose it. | Collapse effort and severity into one field, but that would mix review configuration with finding impact. |
| Treat GitHub UI partial severity as experimental. | Live validation found `automatedComment.severity` in an undocumented deferred `automated-review-comment` React partial, not in a stable public API field. | Ignore severity entirely for MVP, or classify severity locally from comment text. |

## Contracts And Boundaries

- Raw GitHub payloads should be stored or cached separately from normalized entities.
- MVP fixture raw payloads should be versioned with tests after secrets and tokens are redacted.
- Runtime raw payload caches should live in a user-selected local cache directory and should not be committed by default.
- Normalized output and report artifacts should be deterministic for the same input payloads, repository profile, and metric version.
- Markdown reports may include short comment excerpts and source URLs for evidence; private-repository usage must support redaction or excerpt suppression.
- Normalized PR entities should retain source IDs and URLs for traceability.
- Review attempts should be represented separately from individual review comments so failed Copilot reviews and no-new-comment rounds remain visible.
- Classifications must record their source:
  - `observed_public_api` for direct documented GitHub API metadata;
  - `internal_ui_partial` for data extracted from undocumented GitHub UI HTML/React partials;
  - `rule` for deterministic local categorization;
  - `model` for any future model-assisted classification;
  - `manual` for user-edited labels.
- Metrics should be deterministic for a given normalized dataset and classifier version.
- Recommendations should reference the metric evidence and example PRs that triggered them.
- Reports should default to repository-level aggregation and avoid individual rankings.
- Repository profiles should be explicit inputs with conservative defaults; validation fixtures may suggest defaults but must not become hardcoded product assumptions.
- PR-open diff measurements must record whether they came from an observed snapshot, reconstruction, or are unavailable.
- Access coverage must be explicit: reports should state which API sources were available, which scopes were missing, which data was partial, and how that affected each metric.
- The MVP should prefer transparent component metrics over opaque composite scores. Any score-like value must expose its component inputs and version.

## Data Model Sketch

Core entities:

- Repository
- TargetRepository
- RepositoryLanguageDistribution
- RepositoryProfile
- FileRoleRule
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
- target repository owner, name, default branch, visibility, and pull request sample size;
- repository language byte counts and percentages;
- repository profile version and rule source;
- timestamps for lifecycle and waiting-time calculations;
- file path, extension, language when available, additions, deletions, category, role, functional surface, generated/vendored flag, and profile confidence;
- comment source, author type, severity, confidence or visibility state when available, body category, file target, and resolution status when available;
- review effort source such as `observed_public_api`, `rule`, `manual`, or `unavailable`;
- comment impact or severity source such as `observed_public_api`, `internal_ui_partial`, `rule`, `model`, `manual`, `unavailable`, or `excluded`;
- check name, conclusion, duration, rerun relationship, and failure category when available;
- access source and coverage status for each API family used by a report;
- metric version and classifier version.

## Migration / Compatibility

There is no existing product data to migrate. The first implementation should still version normalized schemas and metric formulas so later reports can explain whether score changes came from workflow changes or analyzer changes.

## Failure Modes

- GitHub API data is incomplete or rate-limited: report partial coverage and show missing data categories.
- GitHub token lacks scopes or private-repository access: continue with available public data when possible and mark affected metrics partial or unavailable.
- Repository profile is missing or too generic: compute conservative metrics and mark role-based recommendations as low-confidence.
- Copilot severity is unavailable through public APIs: preserve comments and use an explicit `severity_source` value of `internal_ui_partial`, `unavailable`, or `inferred`.
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

- [x] Should the MVP persist raw GitHub payloads, or only normalized data and report artifacts? Persist redacted fixture payloads for tests; keep runtime raw payload caches local and user-controlled; emit normalized JSON and Markdown reports.
- [x] What is the minimum viable GitHub permission set for a public and private repository? Documented in the GitHub access and coverage matrix; public read is enough for public metadata, while private repositories need repository, pull request, checks, and Actions read permissions depending on desired coverage.
- [x] Which report format should come first: Markdown, JSON, web UI, or all three? Markdown plus JSON first; web UI is deferred.
- [x] Should file categorization be globally defined or repo-configurable from the start? Use global base categories with repository-configurable file-role and functional-surface rules.
- [x] What confidence threshold is required before token/model usage can be attributed to a PR? Deferred from the GitHub-only MVP; future attribution should require explicit join keys such as branch, PR number, commit SHA, session ID, or timestamp windows.

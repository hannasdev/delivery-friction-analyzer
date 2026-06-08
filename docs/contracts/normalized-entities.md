# Normalized Entity Contract

Schema: `schemas/normalized-entities.schema.json`.

Milestone 1 defines the first normalized fixture shape. It is intentionally limited to source inventory and classification transparency, not friction scoring.

## Entities

- `TargetRepository`: owner/name/default branch/visibility/window for the repository being analyzed.
- `RepositoryLanguageDistribution`: byte counts from `GET /repos/{owner}/{repo}/languages`, stored as context only.
- `PullRequest`: source IDs, URL, state, lifecycle timestamps, final diff shape, PR-open diff source confidence, files, reviews, review threads, comments, checks, and workflow-run coverage.
- `Commit`: commit OID, authored timestamp, committed timestamp when present, and message headline.
- `ChangedFile`: path, additions, deletions, change type, category, role, functional surface, generated flag, and classification source.
- `Review`: review attempt with author source, submitted timestamp, commit OID, generated comment count when known, and failed-attempt marker.
- `ReviewThread`: GraphQL thread count, resolved count, outdated count, and source coverage.
- `ReviewCommentSummary`: source-grouped comment counts.
- `CheckRun`: final check/status rollup entries.
- `WorkflowRunSummary`: pull-request workflow-run coverage by conclusion when branch history is available.

## Source Labels

Normalized data must preserve whether a value came from a public API, GraphQL thread query, repository profile rule, fallback rule, internal UI partial, or unavailable coverage. Later metric and report stages should use those source labels before making confidence claims.

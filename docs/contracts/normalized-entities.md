# Normalized Entity Contract

Schema: `schemas/normalized-entities.schema.json`.

Milestone 1 defines the first normalized fixture shape. It is intentionally limited to source inventory and classification transparency, not friction scoring.

## Entities

- `TargetRepository`: owner/name/default branch/visibility/window for the repository being analyzed.
- `RepositoryLanguageDistribution`: byte counts from `GET /repos/{owner}/{repo}/languages`, stored as context only.
- `PullRequest`: source IDs, author login when known, URL, state, lifecycle timestamps, final diff shape, PR-open diff source confidence, optional PR-open additions/deletions/changed-file counts when direct or reconstructed data is available, files, reviews, review decision summary, review threads, comments, checks, and workflow-run coverage.
- `Commit`: commit OID, authored timestamp, committed timestamp when present, and message headline.
- `ChangedFile`: path, additions, deletions, change type, category, role, functional surface, generated flag, and classification source.
- `Review`: review attempt with author source, submitted timestamp, commit OID, generated comment count when known, and failed-attempt marker.
- `ReviewDecisionSummary`: coarse human review state derived from observed review events, with human approval / changes-requested booleans, unique human reviewer count, and source label. `none` means review events were collected and no human review events were observed; `unavailable` means review-event coverage cannot support an absence claim.
- `ReviewThread`: GraphQL thread count, resolved count, outdated count, and source coverage.
- `ReviewCommentSummary`: source-grouped comment counts, separating PR-author replies from human reviewer feedback when author context is available.
- `CheckRun`: final check/status rollup entries.
- `WorkflowRunSummary`: pull-request workflow-run coverage by conclusion when branch history is available.

## Source Labels

Normalized data must preserve whether a value came from a public API, GraphQL thread query, repository profile rule, fallback rule, internal UI partial, or unavailable coverage. Later metric and report stages should use those source labels before making confidence claims.

## PR-Open Diff Counts

`prOpenDiff` always records `source` and `confidence`. When `source` is `direct` or `reconstructed`, normalized data may also include non-negative `additions`, `deletions`, and `changedFiles` counts so the metrics engine can compute open-to-merge diff growth. When those counts are missing or the source is `snapshot_only` / `unavailable`, diff-growth metrics must remain explicitly unavailable rather than inferred from merge-time data.

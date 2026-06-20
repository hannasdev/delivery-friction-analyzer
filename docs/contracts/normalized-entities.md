# Normalized Entity Contract

Schema: `schemas/normalized-entities.schema.json`.

Milestone 1 defines the first normalized fixture shape. It is intentionally limited to source inventory and classification transparency, not friction scoring.

## Entities

- `TargetRepository`: owner/name/default branch/visibility/window for the repository being analyzed.
- `AnalysisFilter`: optional metadata for downstream analysis filters applied after collection and normalization. When present, it records excluded PR classes, the original collected PR count, and the filtered PR count.
- `RepositoryLanguageDistribution`: byte counts from `GET /repos/{owner}/{repo}/languages`, stored as context only.
- `ContributorSource`: optional sanitized metadata from a configured structured contributor source. It records source type, path, coverage status, diagnostics, and parsed hint count. It must not preserve raw contributor file contents or contributor login lists.
- `PullRequest`: source IDs, author login when known, URL, state, PR class evidence, lifecycle timestamps, final diff shape, PR-open diff source confidence, optional PR-open additions/deletions/changed-file counts when direct or reconstructed data is available, files, reviews, review decision summary, review threads, comments, checks, and workflow-run coverage.
- `PrClassSummary`: profile-driven PR class, classification source, and winning rule ID. Unmatched PRs use `class: "unknown"`, `classificationSource: "fallback_rule"`, and `ruleId: null`.
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

Configured contributor hints may classify otherwise-unknown comment authors into existing comment-source groups during the analysis run, but parsed login lists are transient and must not be persisted in generated artifacts. Hints must not change PR authorship, reviewer attribution, scoring formulas, or person-level report/CSV rows.

## Analysis Filters

`source-bundle.json` remains the full collected sample. When a local analysis excludes one or more PR classes, `normalized.json` contains the filtered PR set and an `analysisFilter` object:

- `excludedPrClasses`: class names explicitly excluded by the user;
- `originalPullRequests`: collected PR count before filtering;
- `filteredPullRequests`: PR count after filtering.

Filtering must be explicit and must fail rather than writing complete-looking empty artifacts when every collected PR is excluded.

## PR-Open Diff Counts

`prOpenDiff` always records `source` and `confidence`. When `source` is `direct` or `reconstructed`, normalized data may also include non-negative `additions`, `deletions`, and `changedFiles` counts so the metrics engine can compute open-to-merge diff growth. When those counts are missing or the source is `snapshot_only` / `unavailable`, diff-growth metrics must remain explicitly unavailable rather than inferred from merge-time data.

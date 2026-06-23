# GitHub Data Inventory

Internal validation inventory was checked against `hannasdev/mcp-writing` on 2026-06-08 with `gh` authenticated as `hannasdev`. This repository is fixture and calibration context, not the public tutorial target.

## API Fields

| Area | Fields | Source | Coverage Notes |
| --- | --- | --- | --- |
| Target repository | owner, name, default branch, visibility | local target contract plus REST repository metadata | The target repository is separate from the product repository. |
| Language distribution | language byte counts | `GET /repos/{owner}/{repo}/languages` | Context only; does not determine file role or risk. |
| Pull request lifecycle | number, title, URL, state, createdAt, mergedAt, updatedAt, baseRefName, headRefName, headRefOid | `gh pr view --json` / GraphQL-backed PR fields | Directly available for current and historical PRs. |
| Commits | commit OID, authoredDate, committedDate, message headline | `gh pr view --json commits` | Useful for post-open and post-review iteration counts. |
| Final diff shape | additions, deletions, changedFiles, files path/additions/deletions/changeType | `gh pr view --json additions,deletions,changedFiles,files` | Final/current PR diff is direct. |
| PR-open diff shape | files/lines at PR open | reconstruction from commits/timeline, or future snapshot | Not directly available from simple PR metadata; record confidence or unavailable. |
| Reviews and attempts | review ID, author login, state, submittedAt, commit OID, body summary | `gh pr view --json reviews` | Copilot no-new-comment and failed attempts appear as reviews and should be retained. |
| Review comments | comment ID, author, path, line, timestamps, URL | REST `GET /repos/{owner}/{repo}/pulls/{number}/comments` and GraphQL review threads | REST is good for individual comments; GraphQL is required for thread grouping. Author login is retained so PR-author replies can be separated from human reviewer feedback when known. |
| Review thread state | totalCount, isResolved, isOutdated, path, line, grouped comments | GraphQL `pullRequest.reviewThreads` | Required for thread-aware review analytics. |
| Check runs | name, workflowName, status, conclusion, startedAt, completedAt | `gh pr view --json statusCheckRollup` and check-runs per commit | Final rollup only reflects the current/final head. |
| Workflow-run churn | run id, workflow name, head SHA, conclusion, status, run timestamps | REST `GET /repos/{owner}/{repo}/actions/runs?branch=...&event=pull_request` | Branch lookup may degrade after branch deletion or rename. |
| Copilot review effort | review-level effort setting | public docs / currently not observed in checked PR payloads | Store as unavailable or fallback until a stable API path is confirmed. |
| Copilot comment severity | high/medium/low UI label | GitHub UI partial if experimental extractor is enabled | Not observed in checked REST or GraphQL payloads; label as `internal_ui_partial`, `inferred`, `unavailable`, or excluded. |
| Vendor confidence / visibility | confidence, hidden-comment state, hide-severity-label state | GitHub UI partial if experimental extractor is enabled | Not observed in checked REST or GraphQL payloads. For MVP scoring, treat as `unavailable` or `internal_ui_partial`; do not infer correctness from it. |

## Diff Snapshot Support

PR-open diff support must be recorded as one of:

- `direct`: observed from a stable API payload.
- `reconstructed`: derived from commits/timeline with a confidence label.
- `snapshot_only`: requires a future GitHub App or webhook snapshot captured at PR open.
- `unavailable`: not computed for the current run.

The Milestone 1 fixtures mark PR-open diff data as `unavailable`; final diff data is direct.

## Vendor Signal Support

Copilot review effort, Copilot comment severity, and vendor confidence/visibility are separate fields. The checked PR metadata did not expose review effort as structured data. The checked REST and GraphQL review-comment payloads did not expose comment-level severity, confidence, or hidden-comment visibility state. Prior validation found severity and `hideSeverityLabel` in an undocumented GitHub UI partial. The MVP should not use those unstable labels as primary trend metrics or correctness signals.

Availability decision:

- Review effort: `unavailable` in checked PR payloads unless a stable public API source is later confirmed.
- Comment severity: `unavailable` through checked public APIs; `internal_ui_partial` only if an explicit experimental extractor is enabled.
- Confidence / visibility: `unavailable` through checked public APIs; `internal_ui_partial` only if an explicit experimental extractor is enabled; excluded from MVP scoring.

## Source Commands Used For Fixtures

- `gh api repos/hannasdev/mcp-writing/languages`
- `gh pr view 223 --repo hannasdev/mcp-writing --json ...`
- `gh pr view 221 --repo hannasdev/mcp-writing --json ...`
- `gh pr view 239 --repo hannasdev/mcp-writing --json ...`
- `gh api repos/hannasdev/mcp-writing/pulls/239/comments`
- `gh api graphql` querying `repository.pullRequest.reviewThreads`
- `gh api 'repos/hannasdev/mcp-writing/actions/runs?branch=feat/extended-vocabulary-resolution&event=pull_request&per_page=30'`

Fixtures store compact, redacted source-shaped data rather than full raw payloads.
Live `source-bundle.json` artifacts use the analyzer-owned
`github-source-bundle.v1` contract in `schemas/github-source-bundle.schema.json`;
that schema covers the canonical fields consumed downstream, not the full GitHub
REST or GraphQL API response shape.

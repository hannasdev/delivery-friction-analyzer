# GitHub Risk Validation: `hannasdev/mcp-writing`

## Status

- Source repository: <https://github.com/hannasdev/mcp-writing>
- Checked: 2026-06-08
- Sample focus:
  - <https://github.com/hannasdev/mcp-writing/pull/239>
  - <https://github.com/hannasdev/mcp-writing/pull/221>

## Summary

The core GitHub data source is viable, but several MVP risks are real.

GitHub exposes enough data to measure review-loop friction, review-thread state, CI reruns, changed files, lifecycle timing, and post-review commits. However, Copilot severity is not exposed in the REST or GraphQL review-comment fields checked here, and PR-open diff snapshots are not directly available from simple PR metadata.

## Findings

| Assumption / Risk | Validation Result | Evidence | Product Impact |
| --- | --- | --- | --- |
| Review churn can be measured from GitHub. | Confirmed. | PR 239 exposed 15 GraphQL review threads and five Copilot comment-producing review rounds before the final no-new-comments review. PR 221 exposed 10 Copilot comments, five comment-producing review rounds, and one Copilot review error. | Review-loop metrics are viable for MVP. |
| Review thread resolution and outdated state are available. | Confirmed through GraphQL. | `reviewThreads` returned `totalCount`, `isResolved`, `isOutdated`, `path`, line fields, and per-thread comments. | Use GraphQL for thread-aware review analytics instead of relying only on REST comments. |
| Copilot high/medium/low severity is directly available in review-comment payloads. | Not confirmed; likely real risk. | REST review comments exposed author, path, line, timestamps, commit IDs, and body, but no severity field. GraphQL review threads exposed resolution/outdated state and comment bodies, but no severity field in the queried fields. | Severity-weighted metrics need either a different API source, fallback text classification, or an `unavailable` severity source. |
| Copilot review summary text is available. | Confirmed. | `gh pr view` review bodies contained Copilot summaries such as reviewed file counts and generated comment counts. | The analyzer can derive review-round counts and comment counts from structured comments plus summary bodies. |
| CI churn can be reconstructed beyond final status. | Confirmed, with caveats. | PR 239 branch workflow runs returned nine pull-request runs, including repeated CI runs and one cancelled run. Final head check-runs exposed individual jobs and Copilot review as a check-run. | Use workflow-runs-by-branch or check-suites per commit for churn; `statusCheckRollup` alone only reflects the current/final head. |
| Diff size at merge is easy to collect. | Confirmed. | `gh pr list` / `gh pr view` exposed final additions, deletions, changed files, and per-file changes. | Final diff metrics are straightforward. |
| Diff size at PR open is directly available. | Not confirmed; real reconstruction risk. | Simple PR metadata returned final/current additions and deletions. It did not expose a first-open diff snapshot. | Open-vs-merge diff growth likely requires reconstructing the PR state at open from commits, timeline events, branch refs, and/or stored snapshots collected at PR creation time. |
| File category matters for interpreting metrics. | Confirmed by sample. | PR 239 mixed source, tests, README, generated docs, release-log, and initiative bookkeeping. PR 221 mixed core source, tests, generated docs, guides, release-log, and completed initiative docs. | File categorization is required before line-count or comment-density metrics are meaningful. |
| Comment categorization will affect recommendation quality. | Confirmed. | PR 239 comments included runtime bug, performance regression, duplication/refactor, docs accuracy, generated docs, release-log hygiene, and minor code clarity. PR 221 comments included SQL identifier safety, restore checksum safety, cross-scope safety, release-log hygiene, and dead code. | Recommendation mappings should start transparent and rule-based, then improve with examples. |
| Copilot review can fail and should be represented. | Confirmed. | PR 221 included a Copilot review body: "Copilot encountered an error and was unable to review this pull request." | The data model should include review attempts, failures, and no-new-comment rounds, not only comments. |

## PR 239 Snapshot

- Title: `feat: resolve scene vocabulary variants`
- Final diff: 1,168 additions, 77 deletions, 13 changed files.
- Commits: 7 total, with multiple post-review fix commits.
- Copilot comments: 15 individual Copilot review comments.
- Review threads: 15 total through GraphQL.
- Review loop shape:
  - initial Copilot review generated 3 comments;
  - next Copilot review generated 4 comments;
  - next generated 3 comments;
  - next generated 1 comment;
  - next generated 4 comments;
  - final review generated no new comments.
- CI/workflow runs for the PR branch: 9 pull-request workflow runs, including one cancelled CI run.
- File categories touched:
  - source code;
  - tests;
  - README;
  - generated tool docs;
  - release log;
  - initiative bookkeeping.

## PR 221 Snapshot

- Title: `feat(backup): apply project restores transactionally`
- Final diff: 1,149 additions, 58 deletions, 15 changed files.
- Commits: 13 total.
- Copilot comments: 10 individual Copilot review comments.
- Copilot review attempts:
  - five comment-producing review rounds;
  - one failed Copilot review attempt.
- Comment themes:
  - SQL identifier safety;
  - malformed restore snapshot validation;
  - checksum gating before destructive apply;
  - cross-scope restore safety;
  - recovery path edge case;
  - release-log traceability.

## Data Source Notes

### Useful `gh` / GitHub API Paths

- `gh pr list --json`: good for recent PR inventory, final additions/deletions, changed files, commits, timestamps, and URLs.
- `gh pr view --json reviews,files,statusCheckRollup`: useful for review summaries, final file changes, and final head status.
- `repos/{owner}/{repo}/pulls/{number}/comments`: useful for individual review comments, paths, lines, timestamps, and commit IDs.
- GraphQL `pullRequest.reviewThreads`: required for thread counts, resolved state, outdated state, and per-thread grouping.
- `repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request`: useful for workflow-run churn across PR commits while the branch/run history remains available.
- `repos/{owner}/{repo}/commits/{sha}/check-runs`: useful for check-run detail on a specific commit.

### Observed Gaps

- No structured Copilot severity field was visible in the checked REST or GraphQL comment/thread payloads.
- Simple PR metadata does not expose the changed-line count at PR open.
- Final status rollups do not show the full CI churn history.
- Some timeline events hide commit details unless additional fields or endpoints are queried.
- Branch-based workflow-run lookup may be weaker after head branches are deleted or renamed.

## Product Implications

- MVP should prioritize review loop count, thread count, resolved/outdated state, comment density, CI run churn, and post-review commits before severity-weighted scoring.
- Severity should be modeled as optional with explicit `severity_source` values such as `unavailable`, `inferred`, or `observed`.
- The analyzer should ingest GraphQL review threads, not only REST comments.
- Open-vs-merge diff growth should either require stored snapshots collected by a GitHub App at PR-open time or be clearly marked as reconstructed with confidence.
- Recommendation quality should start with transparent categories: correctness, performance, security/safety, docs accuracy, generated docs, release-log hygiene, test coverage, refactor/duplication, CI/validation, and scope/planning.


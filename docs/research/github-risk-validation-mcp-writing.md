# GitHub Risk Validation: `hannasdev/mcp-writing`

## Status

- Source repository: <https://github.com/hannasdev/mcp-writing>
- Checked: 2026-06-08
- Sample focus:
  - <https://github.com/hannasdev/mcp-writing/pull/239>
  - <https://github.com/hannasdev/mcp-writing/pull/239#discussion_r3369463173>
  - <https://github.com/hannasdev/mcp-writing/pull/221>

## Summary

The core GitHub data source is viable, but several MVP risks are real.

GitHub exposes enough data to measure review-loop friction, review-thread state, CI reruns, changed files, lifecycle timing, and post-review commits. GitHub's public changelog confirms that Copilot code review comments can display `High`, `Medium`, and `Low` severity labels, but the checked public REST and GraphQL review-comment fields do not expose that value. The GitHub web UI does expose it in an undocumented deferred HTML/React partial. PR-open diff snapshots are also not directly available from simple PR metadata.

This note records validation-target evidence from `hannasdev/mcp-writing`. Target-specific observations here should calibrate tests and examples, not become hardcoded product assumptions.

## Findings

| Assumption / Risk | Validation Result | Evidence | Product Impact |
| --- | --- | --- | --- |
| Review churn can be measured from GitHub. | Confirmed. | PR 239 exposed 15 GraphQL review threads and five Copilot comment-producing review rounds before the final no-new-comments review. PR 221 exposed 10 Copilot comments, five comment-producing review rounds, and one Copilot review error. | Review-loop metrics are viable for MVP. |
| Review thread resolution and outdated state are available. | Confirmed through GraphQL. | `reviewThreads` returned `totalCount`, `isResolved`, `isOutdated`, `path`, line fields, and per-thread comments. | Use GraphQL for thread-aware review analytics instead of relying only on REST comments. |
| Copilot high/medium/low severity is directly available in review-comment payloads. | Partially confirmed, but not through checked public APIs. | GitHub's 2026-05-12 changelog says Copilot code review comments are categorized as `High`, `Medium`, and `Low`. The GitHub web UI shows `Medium` on comment `3369463173`, and the deferred HTML partial for thread `2275998924` embeds `automatedComment.severity: "medium"`. However, the exact REST payload exposed author, path, line, timestamps, commit IDs, body, and reactions with no severity field. GraphQL introspection for `PullRequestReviewComment` did not expose a `severity`, `priority`, `risk`, `effort`, or similar field, and queried GraphQL comment/thread nodes did not return this metadata. | Comment severity exists in GitHub's UI model, but relying on it for MVP requires an undocumented HTML-partial extractor. Keep severity source explicit: `internal_ui_partial`, `inferred`, or `unavailable`. |
| Copilot review summary text is available. | Confirmed. | `gh pr view` review bodies contained Copilot summaries such as reviewed file counts and generated comment counts. | The analyzer can derive review-round counts and comment counts from structured comments plus summary bodies. |
| CI churn can be reconstructed beyond final status. | Confirmed, with caveats. | PR 239 branch workflow runs returned nine pull-request runs, including repeated CI runs and one cancelled run. Final head check-runs exposed individual jobs and Copilot review as a check-run. | Use workflow-runs-by-branch or check-suites per commit for churn; `statusCheckRollup` alone only reflects the current/final head. |
| Diff size at merge is easy to collect. | Confirmed. | `gh pr list` / `gh pr view` exposed final additions, deletions, changed files, and per-file changes. | Final diff metrics are straightforward. |
| Diff size at PR open is directly available. | Not confirmed; real reconstruction risk. | Simple PR metadata returned final/current additions and deletions. It did not expose a first-open diff snapshot. | Open-vs-merge diff growth likely requires reconstructing the PR state at open from commits, timeline events, branch refs, and/or stored snapshots collected at PR creation time. |
| File category matters for interpreting metrics. | Confirmed by sample. | PR 239 mixed source, tests, README, generated docs, release-log, and initiative bookkeeping. PR 221 mixed core source, tests, generated docs, guides, release-log, and completed initiative docs. | File categorization is required before line-count or comment-density metrics are meaningful. |
| Repository language distribution is available. | Confirmed through REST. | `GET /repos/hannasdev/mcp-writing/languages` returned byte counts for JavaScript, HTML, Shell, and Dockerfile. | Store language distribution as repository context, but do not use language alone as a risk or product-role signal. |
| Comment categorization will affect recommendation quality. | Confirmed. | PR 239 comments included runtime bug, performance regression, duplication/refactor, docs accuracy, generated docs, release-log hygiene, and minor code clarity. PR 221 comments included SQL identifier safety, restore checksum safety, cross-scope safety, release-log hygiene, and dead code. | Recommendation mappings should start transparent and rule-based, then improve with examples. |
| Copilot review can fail and should be represented. | Confirmed. | PR 221 included a Copilot review body: "Copilot encountered an error and was unable to review this pull request." | The data model should include review attempts, failures, and no-new-comment rounds, not only comments. |

## PR 239 Snapshot

- Title: `feat: resolve scene vocabulary variants`
- Final diff: 1,168 additions, 77 deletions, 13 changed files.
- Commits: 7 total, with multiple post-review fix commits.
- Copilot comments: 15 individual Copilot review comments.
- Example severity gap: comment `3369463173` displays `Medium` in GitHub's web UI, but the checked REST and GraphQL public API payloads do not expose that value.
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
- `repos/{owner}/{repo}/languages`: useful for repository language distribution as byte counts.
- `repos/{owner}/{repo}/pulls/{number}/comments`: useful for individual review comments, paths, lines, timestamps, and commit IDs.
- GraphQL `pullRequest.reviewThreads`: required for thread counts, resolved state, outdated state, and per-thread grouping.
- `repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request`: useful for workflow-run churn across PR commits while the branch/run history remains available.
- `repos/{owner}/{repo}/commits/{sha}/check-runs`: useful for check-run detail on a specific commit.

### Observed UI Partial

The GitHub PR page lazily expands resolved review threads through deferred HTML endpoints. For the sample comment, the collapsed thread advertised:

- `data-deferred-content-url="/hannasdev/mcp-writing/pull/239/threads/2275998924?rendering_on_files_tab=false"`
- `data-hidden-comment-ids="3369463173,3369469200"`

Fetching that endpoint returned HTML with a React partial:

- `react-partial partial-name="automated-review-comment"`
- embedded JSON at `script[type="application/json"][data-target="react-partial.embeddedData"]`
- `props.comment.id: "PRRC_kwDOSAlxCc7I1e2F"`
- `props.comment.databaseId: 3369463173`
- `props.comment.automatedComment.id: "62120207"`
- `props.comment.automatedComment.source: "copilot"`
- `props.comment.automatedComment.severity: "medium"`
- `props.comment.automatedComment.securitySeverity: "none"`
- `props.comment.automatedComment.hideSeverityLabel: false`

This appears to be the source of the visible `Medium` badge for the sample comment. It is not an observed public GraphQL field; it is an undocumented GitHub UI partial and should be treated as unstable.

### Observed Gaps

- No structured Copilot severity field was visible in the checked REST or GraphQL comment/thread payloads.
- Public GraphQL schema introspection for `PullRequestReviewComment` did not list any severity-like or effort-like field, despite the web UI partial exposing `automatedComment.severity`.
- Language distribution does not explain file role. The same language can represent a core product surface, marketing/support content, generated docs, fixtures, or something else depending on repository conventions.
- Simple PR metadata does not expose the changed-line count at PR open.
- Final status rollups do not show the full CI churn history.
- Some timeline events hide commit details unless additional fields or endpoints are queried.
- Branch-based workflow-run lookup may be weaker after head branches are deleted or renamed.

## Public Documentation Check

Public GitHub documentation and changelog sources distinguish two related concepts:

What they document:

- Copilot code review supports review effort levels. Public docs describe `Low` as the default standard review and `Medium` as a higher-reasoning, longer analysis mode for complex, security-sensitive, or cross-service changes.
- Medium review effort is documented as public preview and can consume more AI credits and GitHub Actions minutes than Low.
- GitHub's public changelog announced Copilot code review comment severity labels on 2026-05-12 and says comments are categorized as `High`, `Medium`, or `Low`.
- Copilot review comments are documented as ordinary pull request review comments: users can react, reply, resolve, or hide them.
- REST pull request review comment examples list ordinary review-comment fields such as `id`, `node_id`, `diff_hunk`, `path`, `commit_id`, `body`, `created_at`, `updated_at`, `html_url`, line fields, and author metadata. They do not document severity or review effort fields.
- GitHub Code Quality, a separate product area, does document severity levels for Code Quality findings: `Error`, `Warning`, and `Note`. Those are not the same as Copilot code review comment severities and use a different bot/product surface.

Implication: the `Medium` badge in the GitHub UI is a real Copilot comment severity label, but the stable public API path for retrieving it is still unconfirmed. If the product uses the UI partial, store it as `severity_source: internal_ui_partial`, not `observed_public_api`. If the product classifies severity locally, store it as `severity_source: inferred`.

## Product Implications

- MVP should prioritize review loop count, thread count, resolved/outdated state, comment density, CI run churn, and post-review commits before severity-weighted scoring.
- Copilot review effort and comment severity should be modeled separately. Review effort is a review-level setting documented as Low/Medium. Comment severity is a per-comment UI label documented in the GitHub changelog and available in an undocumented UI partial, but not in checked public REST/GraphQL payloads.
- The analyzer should ingest GraphQL review threads, not only REST comments.
- If severity is important for MVP, add an experimental extractor for GitHub deferred thread partials and label its output as `internal_ui_partial`.
- Open-vs-merge diff growth should either require stored snapshots collected by a GitHub App at PR-open time or be clearly marked as reconstructed with confidence.
- Recommendation quality should start with transparent categories: correctness, performance, security/safety, docs accuracy, generated docs, release-log hygiene, test coverage, refactor/duplication, CI/validation, and scope/planning.

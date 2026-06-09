# GitHub Live Collection

## Status

- State: Active
- Owner: Hanna
- Created: 2026-06-09
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Delivery Friction Analyzer PRD](../../done/delivery-friction-analyzer/prd.md)
  - [Friction Metrics Contract](../../../contracts/friction-metrics.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [GitHub Access And Coverage Matrix](../../../reference/github-access-coverage.md)
  - [GitHub Data Inventory](../../../reference/github-data-inventory.md)

## Problem

The Delivery Friction Analyzer can normalize fixture data, compute friction metrics, and render useful Markdown and JSON reports. However, the productized CLI still requires a precomputed `friction-metrics.v1` file. That means a maintainer cannot yet point the analyzer at a GitHub repository and get a useful report from live repository history.

This gap makes the MVP hard to use outside curated fixtures. It also hides data quality risks that only appear during live collection, such as branch-based workflow-run lookup, deleted head branches, missing GitHub scopes, rate limits, and PR-open diff data that is unavailable without snapshots.

A temporary live run against `hannasdev/mcp-writing` proved the missing step matters. A 30-PR live sample produced materially different bottlenecks from the 3-PR fixture report: validation friction dominated because one Dependabot PR had repeated `PR Template Check` workflow failures. The report layer handled the data, but the collection path, coverage metadata, and CLI workflow are not durable product functionality yet.

## Goals

- Add a local GitHub collection path that fetches recent pull request data for a configured target repository and produces the existing normalized, metrics, JSON report, and Markdown report artifacts.
- Keep collection repo-source-agnostic: `hannasdev/mcp-writing` remains a validation target, not a hardcoded product assumption.
- Preserve the existing boundaries between raw GitHub payloads, normalized entities, metrics, and reports.
- Make coverage and collection quality visible, including missing scopes, rate limits, deleted branches, unavailable PR-open diff data, and partial workflow or review-thread coverage.
- Provide a maintainer-friendly CLI workflow for "analyze this GitHub repo over the latest N merged PRs." Date-window filtering is valuable follow-up scope after latest-N collection is reliable.
- Calibrate live collection against `hannasdev/mcp-writing` so the MVP produces a credible report from more than curated fixtures.

## Non-Goals

- Do not build a hosted dashboard, GitHub App, webhook receiver, or persistent service.
- Do not implement PR-open snapshot capture; live historical runs may mark PR-open diff growth as unavailable.
- Do not add token/model usage attribution.
- Do not automate repository changes based on report recommendations.
- Do not rank individual contributors or reviewers.
- Do not make `mcp-writing` path rules or workflow names global defaults.
- Do not rely on undocumented GitHub UI partials for MVP collection.

## Product And Design Alignment

The product promise in the completed Delivery Friction Analyzer initiative is a local GitHub-connected report generator. The current report command is useful for validation, but it does not fulfill that local connected workflow by itself.

This initiative turns the MVP into something a maintainer can actually try on a repository they care about. The experience should remain operational and trust-centered:

- users choose the target repository and output directory explicitly;
- reports explain which GitHub data was collected and which data was unavailable;
- raw observations stay separate from profile-based classifications and inferred recommendations;
- private repository data stays local unless the user chooses to share artifacts;
- recommendations remain workflow-focused rather than individual-focused.

## Proposed Solution

Add a first-class live GitHub collection layer and CLI command that fetches GitHub data with the user's local credentials, normalizes it through the existing `normalized-fixture.v1` compatible shape or a versioned live successor, computes `friction-metrics.v1`, and renders `friction-report.v1`.

The primary local workflow should be:

```sh
node src/cli/analyze-github.js \
  --repo hannasdev/mcp-writing \
  --limit 30 \
  --profile fixtures/github/mcp-writing/profile.json \
  --out reports/mcp-writing
```

The command should write deterministic local artifacts:

- source collection bundle;
- normalized entities;
- metrics summary;
- JSON report;
- Markdown report;
- collection coverage summary when that is not already embedded in the above artifacts.

The first implementation should use a `gh`-backed adapter behind a small provider boundary. This keeps local authentication aligned with the current developer workflow while leaving room for direct REST/GraphQL HTTP calls later if `gh` becomes limiting.

The live collector should fetch at least:

- repository metadata and language distribution;
- merged pull request inventory by latest-N limit;
- PR lifecycle metadata, author login, title, URL, base/head refs, merge timestamps;
- final diff files, additions, deletions, changed file counts, and change types;
- commits and commit timestamps;
- reviews and review attempts;
- GraphQL review threads with grouped comments, resolved state, outdated state, paths, lines, and comment authors;
- final status check rollup;
- Actions workflow runs for PR head branches when available.

Coverage should be explicit for every API family. For example, review-thread GraphQL failures should mark thread metrics unavailable without discarding PR metadata, and branch workflow lookup should record the lookup method so validation scores can be interpreted correctly.

## User / Maintainer Workflows

- A maintainer runs the analyzer against `hannasdev/mcp-writing` for the latest 30 merged PRs and gets Markdown plus JSON report artifacts without manually preparing metrics JSON.
- A maintainer runs the analyzer against another public repository with a profile and sees coverage caveats rather than a silent failure or fixture-shaped assumptions.
- A maintainer inspects raw collection, normalized data, and metrics when a report recommendation looks surprising.
- A contributor updates fixtures or golden outputs from a live collection path without copying temporary scripts from chat history.

## Acceptance Criteria

- [ ] A documented local command can analyze a configured GitHub target repository without requiring a preexisting `friction-metrics.v1` input.
- [ ] The command supports repository owner/name, PR limit, repository profile path, output directory, and at least one dry-run or metadata-only validation mode.
- [ ] Live collection fetches repository metadata, languages, PR metadata, files, commits, reviews, GraphQL review threads, status check rollups, and workflow runs when permissions allow.
- [ ] Live collection emits raw/source-shaped collection data, normalized entities, metrics summary, Markdown report, and JSON report artifacts.
- [ ] Coverage metadata records attempted API families, source labels, success/partial/unavailable/rate-limited status, and downstream metric impact.
- [ ] Missing GitHub permissions, missing Actions access, deleted head branches, rate limits, and GraphQL failures degrade the report with diagnostics instead of crashing after partial writes.
- [ ] PR-open diff growth remains explicitly unavailable unless direct or reconstructed values are implemented with confidence metadata.
- [ ] The live collector reuses existing normalization, metrics, profile, and report contracts rather than duplicating report logic.
- [ ] `hannasdev/mcp-writing` can be analyzed over a larger live PR sample, with validation evidence checked against known PR examples such as repeated Dependabot PR template failures and high review-churn feature PRs.
- [ ] Tests cover successful collection from mocked GitHub responses and meaningful degraded cases.
- [ ] Generated artifacts are local and user-selected; GitHub tokens and secrets are never written to reports or logs.
- [ ] Documentation clearly labels source bundles, normalized data, metrics summaries, and reports as potentially sensitive artifacts that may contain private repository names, PR URLs, titles, file paths, and comment metadata.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Branch-based workflow-run lookup can over-count or misattribute validation churn. | Reports may overemphasize CI friction, especially for bot branches with many repeated runs. | Record workflow lookup source, branch, run count, conclusions, and head SHAs. Add validation examples from PR #214 and consider later filtering by PR timeline and PR head SHAs. |
| Deleted or renamed head branches can make workflow history unavailable. | Validation metrics may look cleaner than reality. | Mark workflow-run coverage unavailable or partial, retain final status rollup, and explain the impact in coverage metadata. |
| GitHub API rate limits or missing scopes can interrupt collection. | Users may get no report or an incomplete report without knowing why. | Track per-API-family coverage and degrade with actionable diagnostics. Avoid implying completeness. |
| GraphQL review-thread queries can be expensive for large PR samples. | Collection may be slow or rate-limited. | Page review-thread queries, support PR limits/date windows, and expose progress. |
| Live artifacts may contain sensitive private repository details. | Users could accidentally share paths, URLs, titles, or comments. | Default to local output only, avoid token logging, and document artifact sensitivity. |
| The live collector may duplicate fixture-normalization assumptions. | Future schema changes become harder and fixture/live behavior diverges. | Reuse shared adapter and normalizer functions with contract tests for both fixture and live bundles. |
| The MVP may be pulled into GitHub App snapshot capture. | Scope expands before local analysis is useful. | Keep PR-open snapshots out of scope; mark PR-open diff growth unavailable for historical runs. |
| Generic recommendations may feel unearned when live data exposes surprising patterns. | Users may distrust the report. | Preserve representative PR evidence and add calibration notes when a single outlier dominates a bottleneck. |

## Testing Strategy

- Unit tests for CLI option parsing and target repository validation.
- Adapter tests with mocked `gh` responses for repository metadata, PR list, PR view fields, GraphQL review threads, workflow runs, and error responses.
- Contract tests that prove live collection normalizes into the same metric/report path as fixtures.
- Degraded-mode tests for missing GraphQL review threads, missing Actions access, deleted branch workflow lookup, rate limits, malformed repository input, and partial writes.
- Golden or snapshot tests for a small live-shaped fixture bundle.
- Manual smoke test against `hannasdev/mcp-writing` for at least 30 merged PRs, checking report output against known examples from the temporary live run.

## Open Questions

- [ ] Should the primary command live beside `src/report/generate-report.js` or under a dedicated `src/cli/` entry point?
- [x] Should live collection use `gh` as the first implementation dependency, direct HTTP calls with the GitHub token, or a provider interface that can support both? Use a `gh`-backed adapter first, behind a provider boundary so direct HTTP calls can be added later.
- [ ] Should output artifacts default inside the product repo, the target repo, or a user-selected external directory?
- [x] What is the minimum date-window behavior for MVP: latest N merged PRs only, `--since`, or both? Latest N merged PRs only for the live-collection MVP; date windows are follow-up once latest-N collection is reliable.
- [ ] Should workflow runs be filtered by PR timeline and observed commit SHAs in M1, or should the MVP first label branch-based lookup as a known approximation?
- [x] Should fixture refresh become part of the live command, or stay a separate maintainer workflow? M3 should document a manual redacted live-shaped fixture refresh workflow if it adds pinned samples; automated fixture refresh is post-MVP.

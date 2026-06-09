# GitHub Live Collection Milestones

## M1: GitHub Collector Contract And Adapter

### Outcome

Add a reusable GitHub collection layer that can fetch live repository and pull request data into a versioned source bundle without computing metrics or rendering reports inside the adapter.

### Scope

- Define the live collection source-bundle contract, including target repository, collection metadata, API coverage, language distribution, and pull request payloads.
- Implement a local `gh`-backed GitHub adapter for repository metadata, language distribution, merged PR inventory, PR details, files, commits, reviews, status check rollups, GraphQL review threads, and workflow runs.
- Keep the adapter behind a small provider boundary so direct REST/GraphQL HTTP calls can be added later without changing metrics or report code.
- Support a configured target repository and PR selection by latest merged PR limit.
- Record per-API-family coverage and diagnostics for missing permissions, unavailable Actions data, GraphQL failures, rate limits, and deleted or inaccessible branches.
- Keep GitHub token handling out of artifacts and logs.
- Add fixture or mocked-response tests for successful and degraded collection paths.

### Non-Goals

- Do not render Markdown or JSON reports in the adapter.
- Do not implement PR-open diff reconstruction or snapshot capture.
- Do not add a hosted service, GitHub App, or webhook listener.
- Do not hardcode `hannasdev/mcp-writing` as the only target repository.

### Acceptance Criteria

- [ ] A collector module can fetch a live source bundle for `owner/name` and `limit`.
- [ ] The collector uses a `gh`-backed provider boundary rather than calling GitHub directly from normalization, metrics, or report modules.
- [ ] The source bundle includes repository metadata, languages, PR metadata, files, commits, reviews, review threads, check rollups, workflow runs, and coverage metadata when available.
- [ ] The collector labels unavailable PR-open diff data instead of inventing values from merge-time diff data.
- [ ] Missing GraphQL review-thread access, Actions access, or workflow branch history is represented as degraded coverage with diagnostics.
- [ ] Tests prove successful collection mapping and at least three degraded cases.
- [ ] Tokens and secret-bearing environment details are not written to generated artifacts or test snapshots.

### Required Validation

- `npm test`
- Manual: run the collector against `hannasdev/mcp-writing` with a small PR limit and inspect source-bundle coverage fields.

### Risks / Watchpoints

- GraphQL review-thread pagination and rate limits can make large PR samples slow.
- Branch workflow lookup may include many runs for the same branch; record enough source detail for later calibration.
- Mocked tests should not freeze volatile GitHub response fields that make fixtures brittle.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M2: End-To-End Local Analyze Command

### Outcome

Expose a maintainer-facing local command that runs live collection, normalization, metrics, and report generation in one workflow.

### Scope

- Add a documented command for analyzing a target GitHub repository.
- Support target repository, PR limit, repository profile path, output directory, dry-run or metadata-only validation, and help output.
- Reuse the existing repository profile, normalizer, metrics engine, and report renderer.
- Emit source bundle, normalized data, metrics summary, Markdown report, and JSON report artifacts.
- Make output writes deterministic and avoid mutating the analyzed repository.
- Document that generated source bundles, normalized data, metrics summaries, and reports may contain sensitive repository details even when tokens are redacted.
- Surface progress and final artifact paths.
- Keep the existing metrics-summary-only report command available for fixture and advanced workflows.

### Non-Goals

- Do not remove or replace `src/report/generate-report.js`.
- Do not add a web UI.
- Do not implement automatic profile generation.
- Do not make report recommendations modify repository files.

### Acceptance Criteria

- [ ] A user can run one command against `hannasdev/mcp-writing` and get all expected artifacts from live data.
- [ ] A user can run the command in dry-run or metadata-only mode to validate repository access, profile path, output path, and available API families without writing full report artifacts.
- [ ] The command fails fast on malformed repository input, missing required options, and unwritable output directories.
- [ ] Partial GitHub coverage produces a report with coverage caveats when enough PR data exists.
- [ ] Existing fixture report tests and metrics tests still pass.
- [ ] Documentation describes the live command, metrics-summary command, required GitHub auth, output artifacts, and coverage caveats.
- [ ] Documentation describes artifact sensitivity and gives guidance for sharing or redacting live source bundles and reports.

### Required Validation

- `npm test`
- Manual: run the live analyze command against `hannasdev/mcp-writing --limit 30` and inspect the Markdown report.
- Manual: run the dry-run or metadata-only mode against `hannasdev/mcp-writing` and confirm it reports access, profile, output, and API coverage checks without writing full report artifacts.
- Manual: run a degraded scenario or mocked command where workflow-run access is unavailable and confirm coverage metadata is visible.

### Risks / Watchpoints

- The command should not leave partial artifacts that look complete after a fatal collection error.
- Output paths must be controlled by the user and safe to create recursively.
- Users may confuse the product repository with the target repository; CLI help should be explicit.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M3: Live Report Calibration And Coverage Hardening

### Outcome

Use larger live samples from `hannasdev/mcp-writing` to calibrate coverage, diagnostics, and report interpretation so the MVP output is trustworthy beyond curated fixtures.

### Scope

- Add a live-shaped fixture or golden sample derived from a larger PR collection after redaction and stability review.
- If a pinned live-shaped fixture is added, document the manual redaction and refresh workflow; automated fixture refresh remains post-MVP.
- Validate the report against known live examples:
  - repeated Dependabot `PR Template Check` failures dominating validation friction;
  - high review-churn feature PRs with many Copilot threads and author replies;
  - broad file-spread PRs across runtime, tests, planning docs, release notes, and generated docs.
- Improve diagnostics for single-outlier domination in bottleneck rankings.
- Confirm workflow-run coverage labels make branch-based lookup limitations clear.
- Confirm review-thread source coverage is visible and GraphQL-backed when available.
- Document recommended interpretation of live reports and known MVP limitations.

### Non-Goals

- Do not tune formulas into an opaque composite score.
- Do not suppress real validation failures just because they come from dependency or bot PRs.
- Do not introduce cross-repository benchmarking.
- Do not implement PR-open snapshot capture.

### Acceptance Criteria

- [ ] A 30-PR `mcp-writing` live smoke test produces a report whose top examples can be traced to raw collection evidence.
- [ ] Coverage notes explain unavailable PR-open diff growth and any degraded API families.
- [ ] Validation bottleneck examples show the workflow-run source and conclusions needed to interpret the score.
- [ ] Review churn examples show review-thread and comment-source evidence.
- [ ] Documentation names the MVP's collection limitations and how to inspect generated artifacts.
- [ ] Documentation includes artifact sensitivity guidance and, if applicable, a manual redacted fixture refresh workflow.
- [ ] Tests or fixtures protect against regressions in coverage summaries and source labels.

### Required Validation

- `npm test`
- Manual: run live analysis against `hannasdev/mcp-writing --limit 30`.
- Manual: inspect PR examples in the generated report against source-bundle data.

### Risks / Watchpoints

- A single bot or dependency PR can dominate validation findings; this may be accurate but should be easy to understand.
- Larger live bundles may be too volatile for golden tests unless they are redacted and pinned.
- Calibration should improve explanation and coverage, not hide inconvenient data.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

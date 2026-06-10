# M3 Live Validation

Validation date: 2026-06-09

Target repository: `hannasdev/mcp-writing`

Command:

```sh
npm run analyze:github -- --repo hannasdev/mcp-writing --limit 30 --profile fixtures/github/mcp-writing/profile.json --out /private/tmp/delivery-friction-m3-live-30 --validation-target
```

Artifacts inspected:

- `/private/tmp/delivery-friction-m3-live-30/source-bundle.json`
- `/private/tmp/delivery-friction-m3-live-30/normalized.json`
- `/private/tmp/delivery-friction-m3-live-30/metrics-summary.json`
- `/private/tmp/delivery-friction-m3-live-30/friction-report.json`
- `/private/tmp/delivery-friction-m3-live-30/friction-report.md`

Pinned calibration sample:

- `fixtures/github/mcp-writing/reports/live-30-calibration.golden.json`

## Run Summary

- Pull requests analyzed: 30
- Changed lines: 25315
- Non-generated changed lines: 25071
- Review comments: 206
- Review threads: 104
- Failed checks: 3
- Cancelled workflow runs: 12
- Top bottlenecks: `validation-gap`, `local-hook-gap`, `test-infrastructure-gap`

Collection coverage was partial because `pr_open_diff` is unavailable for historical live runs. Repository metadata, languages, PR inventory, PR details, review threads, and workflow runs were available. The Markdown report includes a `Collection Coverage` section naming `pr_open_diff: unavailable` and the downstream impact that diff growth metrics must remain unavailable.

## Evidence Traceability Checks

- Validation bottlenecks were dominated by PR #214, `chore(deps): Bump qs from 6.15.1 to 6.15.2 in the npm_and_yarn group across 1 directory`. The report shows `failure=39, success=16`, workflow source `rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request`, and a dominance note that PR #214 contributes 85% of the displayed signal. The source bundle for PR #214 shows 55 workflow runs, 39 `PR Template Check` failures, and the Dependabot branch `dependabot/npm_and_yarn/npm_and_yarn-05b1f1d78b`.
- Review churn examples were GraphQL-backed. PR #212, `feat: harden filesystem boundary mutations`, shows 17 review threads, 17 resolved threads, 9 outdated threads, and comment sources `author_reply=17, copilot=17` in the report. The source bundle shows `graphql:repository.pullRequest.reviewThreads`, with thread comments from `copilot-pull-request-reviewer` and `hannasdev`.
- Broad file-spread examples remain interpretable beside review evidence. PR #212 reports 4385 changed lines and the same GraphQL thread evidence; PR #219 reports 3285 changed lines with 7 review threads and matching author/Copilot comment counts; PR #217 reports 830 changed lines with 1 resolved outdated thread.

## Interpretation Notes

- The validation recommendation is accurate but outlier-heavy. PR #214 is a dependency PR whose repeated `PR Template Check` failures dominate validation, local-hook, and test-infrastructure bottlenecks. The dominance note prevents reading that as an evenly distributed repository-wide failure.
- PR-open diff growth remains unavailable by design for the MVP and is not inferred from merge-time additions/deletions.
- Workflow-run coverage uses branch-based pull-request Actions history. It was available in this run, but the report and docs continue to treat branch history as an approximation that can be unavailable or partial for other repositories or deleted/reused branches.
- The pinned calibration sample is report-shaped, not raw source-shaped. It preserves only report-level counts, source labels, conclusions, dominance, and representative PR titles. It omits raw comments, file paths, URLs, authors, SHAs, and workflow run lists.
- The inspected artifacts include repository names, PR URLs, titles, paths, and comment metadata. Keep them local/private unless intentionally reviewed for sharing.

## Redacted Fixture Refresh Workflow

Refresh this sample only when intentionally recalibrating the live report contract:

1. Run the live analyzer against `hannasdev/mcp-writing` with `--limit 30` into a temporary local directory.
2. Inspect `friction-report.md`, `friction-report.json`, and `source-bundle.json` for surprising top examples and coverage caveats.
3. Update `fixtures/github/mcp-writing/reports/live-30-calibration.golden.json` from the report artifact, preserving only the redacted fields listed above.
4. Do not commit raw `source-bundle.json`, `normalized.json`, `metrics-summary.json`, comment text, file paths, URLs, authors, SHAs, or workflow run lists.
5. Run `node --test test/report.test.mjs` and `npm test`.

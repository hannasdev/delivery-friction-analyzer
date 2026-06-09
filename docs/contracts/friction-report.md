# Friction Report Contract

Milestone 3 introduces `friction-report.v1`, a deterministic report generated from a `friction-metrics.v1` repository metrics summary. The report layer does not fetch GitHub data, mutate repositories, rank individuals, or depend on services beyond the data collection path that produced the metrics summary.

## Outputs

- JSON report artifacts for contract tests and future UI work.
- Markdown report artifacts for maintainer review.

Local artifact generation is available from an existing metrics summary:

```sh
node src/report/generate-report.js --metrics-summary fixtures/github/mcp-writing/metrics-summary.golden.json --json-out fixtures/github/mcp-writing/reports/friction-report.golden.json --markdown-out fixtures/github/mcp-writing/reports/friction-report.golden.md
```

The command reads local `friction-metrics.v1` JSON and writes deterministic `friction-report.v1` JSON and Markdown files. It does not fetch GitHub data or mutate the analyzed repository.

## Report Shape

- `reportVersion`: report contract version.
- `metricVersion`: source metrics contract version.
- `targetRepository`: analyzed repository identity and analysis window.
- `summary`: repository totals and top bottleneck identifiers.
- `coverage`: PR-open diff, workflow-run, and review-thread coverage counts plus caveats.
- `commentSources`: total and source-grouped review comments for Copilot, human, bot, scanner, author replies, and unknown sources.
- `surfaces`: core, low-signal, generated, support-surface, role, and functional-surface breakdowns.
- `bottlenecks`: ranked friction patterns with observed data, inferred diagnosis, and suggested action kept as separate fields.
- `recommendationCategories`: supported recommendation categories and how many bottlenecks triggered each one.
- `guardrails`: machine-readable checks that the report avoids individual ranking, separates evidence from inference, and does not use an opaque composite score.
- `followUp`: non-automated future work suggested by the report.

Bottlenecks are ordered by their strongest observed representative metric value, with stable category order used only to break ties.

## Markdown Output

The Markdown renderer presents the same report data for human review:

- summary totals;
- ranked bottlenecks with representative PR examples;
- comment-source breakdown;
- core and support-surface breakdown;
- coverage notes for unavailable or partial data;
- guardrails and follow-up.

Markdown output should not include individual contributor or reviewer rankings.

## Recommendation Boundaries

Recommendations are inferred from transparent component metrics and representative PR examples. They suggest workflow interventions such as readiness gates, preflight scripts, smaller milestones, planning artifacts, or scope control. They do not automate repository changes.

The M3 report contract supports these recommendation categories:

- hooks;
- preflight scripts;
- repo-specific AI skills or instructions;
- PR readiness gates;
- smaller milestones;
- planning artifacts;
- test infrastructure.

## Coverage And Confidence

Reports must label unavailable or partial GitHub data instead of inferring unavailable values from merge-time data. PR-open diff growth remains unavailable unless direct or reconstructed counts exist. Workflow coverage and review-thread sources are summarized separately.

## Guardrails

Reports present repository-level patterns, representative PR examples, and file surface evidence. They must keep observed data, inferred diagnosis, and suggested action distinct, and they must not rank contributors or reviewers.

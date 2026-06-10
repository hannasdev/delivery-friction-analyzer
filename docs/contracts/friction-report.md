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
- `bottlenecks[].observedData[].validationEvidence`: workflow-run source label, workflow-run coverage, workflow-run conclusions, failed check-run count, failed workflow-run count, and cancelled workflow-run count for representative PR examples.
- `bottlenecks[].observedData[].reviewEvidence`: review-thread source label, thread counts, resolution/outdated counts, comment-source breakdown, bot comment count, human reviewer comment count, and author reply count for representative PR examples.
- `bottlenecks[].dominance`: whether the displayed examples are dominated by a single PR, including the top PR number, share of displayed signal, and a human-readable interpretation note.
- `recommendationCategories`: supported recommendation categories and how many bottlenecks triggered each one.
- `guardrails`: machine-readable checks that the report avoids individual ranking, separates evidence from inference, and does not use an opaque composite score.
- `followUp`: non-automated future work suggested by the report.

Bottlenecks are ordered by their strongest observed representative metric value, with stable category order used only to break ties.

## Markdown Output

The Markdown renderer presents the same report data for human review:

- executive summary totals in a table;
- a short "How To Read This Report" guide that distinguishes observed evidence, interpretation, recommendations, and caveats;
- evidence-quality and coverage tables before detailed recommendations;
- key findings that highlight top bottlenecks, strongest displayed signal, outlier caveats, and coverage caveats;
- ranked bottlenecks with representative PR examples rendered as tables;
- validation, review, changed-line, score, and source-label evidence for each representative PR example;
- separately labeled interpretation, recommendation, and confidence/caveat blocks for each bottleneck;
- shared-evidence notes when multiple recommendation categories use the same representative PR set;
- recommendation-category, comment-source, and core/support-surface tables;
- a concise methodology summary;
- guardrails, follow-up, and artifact-sensitivity guidance.

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

Representative examples should carry enough source evidence to trace a report claim back to generated artifacts. Validation examples should name the workflow-run source and conclusions. Review churn examples should name the review-thread source and comment sources. When displayed examples are dominated by one PR, the report should say so instead of implying a repository-wide pattern from an outlier.

## Guardrails

Reports present repository-level patterns, representative PR examples, and file surface evidence. They must keep observed data, inferred diagnosis, and suggested action distinct, and they must not rank contributors or reviewers.

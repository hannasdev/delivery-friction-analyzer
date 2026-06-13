# Friction Report Contract

Milestone 3 introduces `friction-report.v1`, a deterministic report generated from a `friction-metrics.v1` repository metrics summary. The report layer does not fetch GitHub data, mutate repositories, rank individuals, or depend on services beyond the data collection path that produced the metrics summary.

## Outputs

- JSON report artifacts for contract tests and future UI work.
- Markdown report artifacts for maintainer review.
- A detailed `methodology.md` artifact for full live analysis runs.
- Curated CSV evidence exports for full live analysis runs unless `--no-csv` is passed:
  - `pr-metrics.csv`
  - `bottleneck-examples.csv`
  - `comment-sources.csv`
  - `collection-coverage.csv`

Local artifact generation is available from an existing metrics summary:

```sh
node src/report/generate-report.js --metrics-summary fixtures/github/mcp-writing/metrics-summary.golden.json --json-out fixtures/github/mcp-writing/reports/friction-report.golden.json --markdown-out fixtures/github/mcp-writing/reports/friction-report.golden.md
```

The command reads local `friction-metrics.v1` JSON and writes deterministic `friction-report.v1` JSON and Markdown files. It does not fetch GitHub data, mutate the analyzed repository, or write CSV/methodology companion artifacts.

## Report Shape

- `reportVersion`: report contract version.
- `metricVersion`: source metrics contract version.
- `targetRepository`: analyzed repository identity and analysis window.
- `summary`: repository totals and top bottleneck identifiers.
- `coverage`: PR-open diff, workflow-run, and review-thread coverage counts plus caveats.
- `commentSources`: total and source-grouped review comments for Copilot, human, bot, scanner, author replies, and unknown sources.
- `surfaces`: core, low-signal, generated, support-surface, role, and functional-surface breakdowns.
- `bottlenecks`: ranked friction patterns with observed data, inferred diagnosis, and suggested action kept as separate fields.
- `bottlenecks[].observedData[]`: representative PR examples with PR identity, score/value, final/current additions, deletions, changed-file count, and changed-line count.
- `bottlenecks[].observedData[].validationEvidence`: workflow-run source label, workflow-run coverage, workflow-run conclusions, failed check-run count, failed workflow-run count, and cancelled workflow-run count for representative PR examples.
- `bottlenecks[].observedData[].reviewEvidence`: review-thread source label, thread counts, resolution/outdated counts, review decision label/source, human reviewer count, human approval / changes-requested booleans, comment-source breakdown, bot comment count, human reviewer comment count, and author reply count for representative PR examples.
- `bottlenecks[].dominance`: whether the displayed examples are dominated by a single PR, including the top PR number, share of displayed signal, and a human-readable interpretation note.
- `sharedSignals`: report-layer interpretation groups for displayed bottlenecks that share a ranking key or the same representative PR evidence. These groups do not change bottleneck scores, ranking, or recommendation categories.
- `sensitivity`: optional robustness summaries for displayed bottlenecks dominated by one PR. Each summary names the excluded PR, affected bottlenecks, baseline top bottlenecks, top bottlenecks without that PR, and an interpretation note.
- `recommendationCategories`: supported recommendation categories and how many bottlenecks triggered each one.
- `guardrails`: machine-readable checks that the report avoids individual ranking, separates evidence from inference, and does not use an opaque composite score.
- `followUp`: non-automated future work suggested by the report.

Bottlenecks are ordered by their strongest observed representative metric value, with stable category order used only to break ties. Final/current PR size fields are context for comparing size against friction signals; they only affect ordering for metric families that explicitly measure changed-file spread.

## Markdown Output

The Markdown renderer presents the same report data for human review:

- executive summary totals in a table;
- a short "How To Read This Report" guide that distinguishes observed evidence, interpretation, recommendations, and caveats;
- evidence-quality and coverage tables before detailed recommendations;
- key findings that highlight top bottlenecks, strongest displayed signal, outlier caveats, and coverage caveats;
- a top-level shared-signal interpretation callout when multiple displayed bottlenecks share a ranking key or representative PR evidence;
- outlier and sensitivity analysis when displayed examples are dominated by one PR;
- a prioritization explanation that describes strongest-signal ordering and how PR size is used as context;
- ranked bottlenecks with representative PR examples rendered as compact PR-size tables;
- validation, review, and source-label evidence for each representative PR example rendered as plain Markdown detail lists;
- separately labeled inferred diagnosis, suggested action, and confidence/caveat blocks for each bottleneck;
- shared-evidence notes when multiple recommendation categories use the same representative PR set;
- recommendation-category, comment-source, and core/support-surface tables;
- a concise methodology summary;
- a reference to the detailed `methodology.md` artifact generated by full live analysis;
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

Representative examples should carry enough source evidence to trace a report claim back to generated artifacts. Validation examples should name the workflow-run source and conclusions. Review churn examples should name the review-thread source, review decision evidence, and comment sources. When `reviewThreads` is zero, review decision evidence should make clean human approval distinguishable from unavailable review evidence and from observed absence of human review. When displayed examples are dominated by one PR, the report should say so instead of implying a repository-wide pattern from an outlier.

Shared-signal groups are interpretation support only. The report may group bottlenecks by the metric ranking key they use or by identical displayed representative PR sets, but it must still preserve each bottleneck and its recommendation category so readers can distinguish one underlying signal from different possible actions.

Sensitivity summaries are robustness context only. They must preserve the baseline ranking, avoid implying that the analyzer discarded inconvenient data, and label excluded-PR summaries as "without this PR" comparisons rather than replacement truth.

## Methodology Artifact

Full live analysis writes `methodology.md` as a hybrid artifact: stable explanatory text plus run-specific facts. It should include:

- target repository and report/metric versions;
- profile path when available;
- requested and collected PR counts;
- collection coverage status and API-family diagnostics;
- scoring, ranking, dominance, sensitivity, and limitation explanations;
- generated artifact names and artifact-sensitivity guidance.

The methodology artifact should stay aligned with this contract and the Markdown methodology summary, but it may be more detailed than the main report.

## CSV Evidence Exports

Full live analysis writes curated CSV exports by default. `--no-csv` suppresses CSV generation while preserving Markdown, JSON, source bundle, normalized data, metrics summary, and methodology artifacts.

CSV exports are supporting evidence trails, not replacements for JSON artifacts. They should be deterministic, properly escaped, mitigate formula-like text cells for spreadsheet inspection, and avoid raw comments or logs.

Minimum CSV column groups:

- `pr-metrics.csv`: PR number, title, URL, changed lines, non-generated changed lines, review comments, review threads, review decision, human reviewer count, human approval / changes-requested booleans, failed checks, failed workflow runs, cancelled workflow runs, post-review commits, review-thread source, workflow-run source/coverage, and main ranking scores.
- `bottleneck-examples.csv`: bottleneck identity, recommendation category, PR identity, score/value, changed lines, validation counts, review counts, comment-source counts, workflow/review source and coverage labels, dominance, and source labels.
- `comment-sources.csv`: source name, total comments, bot/scanner classification, human/author classification, and share of all comments.
- `collection-coverage.csv`: API family, status, attempts, source label, diagnostics, and downstream impact.

Empty CSV cells mean unavailable or not applicable. Numeric zero should be used only for observed or computed zero counts. Count columns that depend on optional GitHub coverage should keep source or coverage labels nearby so spreadsheet readers can tell unavailable evidence apart from observed zeroes. CSVs must not include raw comment bodies, raw workflow logs, tokens, secret-bearing environment details, or individual contributor/reviewer rankings.

## Guardrails

Reports present repository-level patterns, representative PR examples, and file surface evidence. They must keep observed data, inferred diagnosis, and suggested action distinct, and they must not rank contributors or reviewers.

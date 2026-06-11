# Report Readability And Evidence Transparency

## Status

Status: Completed in PR #11 on 2026-06-10, with follow-up report evidence readability polish in PR #12 on 2026-06-11.

- State: Done
- Owner: Hanna
- Created: 2026-06-09
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [Friction Metrics Contract](../../../contracts/friction-metrics.md)
  - [GitHub Live Collection](../github-live-collection/prd.md)

## Problem

The live GitHub analyzer can now collect real repository history and produce Markdown, JSON, normalized data, metrics, and source-bundle artifacts. The generated Markdown report contains useful evidence, but the current presentation still reads like a lightly formatted diagnostic dump.

Maintainers need a report they can scan, understand, trust, and then inspect more deeply when a recommendation looks surprising. Today the report has the right ingredients but too much is embedded in dense prose:

- observed GitHub facts, analyzer interpretation, and suggested actions are present but not visually distinct enough;
- per-PR counts are hard to compare because validation and review evidence are rendered as long text lines;
- methodology and data-quality caveats appear late or require prior knowledge of the product;
- outlier dominance is noted, but the report does not yet show how conclusions shift when a dominant PR is excluded;
- raw JSON artifacts are transparent but not friendly for spreadsheet-based inspection;
- the CLI prints a long JSON completion receipt by default, which obscures the human next step of opening the Markdown report.

The next product step is to make the report feel like a trustworthy maintainer-facing artifact rather than a developer-facing proof of concept.

## Goals

- Make the Markdown report clearly distinguish observed evidence, analyzer interpretation, recommendations, confidence, and caveats.
- Replace dense prose count lines with scannable tables for representative PR evidence, summary counts, coverage, and recommendation categories.
- Add a concise methodology summary inside the Markdown report so readers understand the basic reasoning without leaving the report.
- Generate a more detailed `methodology.md` artifact for deeper explanation of selection, scoring, profile classification, coverage, outliers, and limitations.
- Generate curated CSV evidence exports by default, with an opt-out flag for users who do not want CSV artifacts.
- Add automatic outlier/sensitivity reporting when a bottleneck is dominated by one PR, including how top findings change when the dominant PR is excluded.
- Improve CLI completion output so successful runs point users to the most useful artifacts instead of dumping a long JSON receipt by default.
- Preserve the current JSON artifacts as the machine-readable audit trail.

## Non-Goals

- Do not change the underlying metric formulas unless a readability change exposes an actual correctness issue.
- Do not introduce a web UI, charting layer, hosted dashboard, or browser-rendered report.
- Do not export raw GitHub comments, raw workflow logs, tokens, or secret-bearing environment data to CSV.
- Do not rank individual contributors, reviewers, or authors.
- Do not make automated repository changes based on recommendations.
- Do not implement PR-open snapshot capture or cross-repository benchmarking.
- Do not remove JSON report artifacts; only change whether the CLI prints the long JSON receipt by default.

## Product And Design Alignment

The product promise is an operational diagnostic report for repository-level delivery friction. The report should help maintainers reason about workflow improvements, not overwhelm them with raw data or create a surveillance surface.

This initiative keeps the current trust model:

- observed GitHub data remains separate from configured classifications and inferred recommendations;
- recommendation language stays workflow-focused rather than person-focused;
- coverage gaps and outlier dominance are visible before users act on a conclusion;
- raw artifacts remain local and inspectable;
- generated CSVs support deeper analysis without requiring readers to navigate nested JSON.

## Proposed Solution

Update the report generation workflow so a normal live analysis produces a more readable artifact set:

- `friction-report.md`: the main human-facing report.
- `friction-report.json`: the report contract for tests and future UI work.
- `methodology.md`: a detailed methodology companion artifact.
- `pr-metrics.csv`: one row per analyzed PR with key metric scores and counts.
- `bottleneck-examples.csv`: one row per representative bottleneck example.
- `comment-sources.csv`: source-level comment totals.
- `collection-coverage.csv`: API-family coverage, attempts, diagnostics, and downstream impact.
- existing `source-bundle.json`, `normalized.json`, and `metrics-summary.json` artifacts.

CSV exports should be on by default for full analysis runs. Add a `--no-csv` flag to suppress CSV artifacts when users want fewer files or are especially cautious about spreadsheet-friendly exports.

The initial CSV contract should include these minimum column groups:

- `pr-metrics.csv`: PR number, title, URL, changed lines, non-generated changed lines, review comments, review threads, failed checks, failed workflow runs, cancelled workflow runs, post-review commits, and the main ranking scores.
- `bottleneck-examples.csv`: bottleneck ID/title, recommendation category, PR number, title, URL, score/value, changed lines, validation counts, review counts, comment-source counts, dominance status, and evidence source labels.
- `comment-sources.csv`: source name, total comments, bot/scanner classification, human/author classification, and share of all comments.
- `collection-coverage.csv`: API family, status, attempts, source label, diagnostics, and downstream impact.

CSV fields may include PR titles and URLs because they are needed for useful spreadsheet inspection. CSV fields must not include raw comment bodies, token values, secret-bearing environment details, raw workflow logs, or per-person rankings. Empty values should be explicit empty cells rather than invented zeroes unless the source metric is a real count.

The Markdown report should be reorganized around the reader's path:

1. Executive summary.
2. How to read this report.
3. Evidence quality and coverage.
4. Key findings, including outlier/sensitivity callouts.
5. Ranked bottlenecks.
6. Recommendation categories.
7. Comment sources.
8. Core and support surfaces.
9. Methodology summary.
10. Guardrails, follow-up, and artifact sensitivity.

Each bottleneck should use consistent labels:

- Observed evidence: facts measured from GitHub and configured repository profile rules.
- Interpretation: the analyzer's inference from those facts.
- Recommendation: a suggested workflow intervention.
- Confidence and caveats: dominance, coverage gaps, partial data, and sensitivity notes.

Representative PR evidence should be rendered as tables rather than dense prose. Tables should include PR number/link, score, changed lines, failed workflows, cancelled workflows, review threads, comment-source counts, and any source labels needed to trace the evidence.

Outlier/sensitivity reporting should be automatic when a bottleneck has `single_pr_dominates` dominance. The report should show the dominant PR and, at minimum, summarize how the top bottleneck IDs change when that PR is excluded from the analyzed sample. This is a sensitivity explanation, not a command to ignore inconvenient data.

Sensitivity analysis should reuse the existing normalized data and metric formulas through a report-layer helper. It should not introduce new scoring formulas or mutate the source metrics. The default scope should be one sensitivity summary per distinct dominant PR among displayed bottlenecks, deduplicated when several recommendation categories share the same outlier. If that becomes too large for one report, the implementation may cap summaries with an explicit note rather than silently omitting them.

The detailed methodology artifact should use a hybrid approach: mostly stable explanatory text, plus run-specific facts such as target repository, selection strategy, coverage status, repository profile path when available, generated artifact names, and any sensitivity summaries. This keeps methodology readable while avoiding stale hardcoded claims.

CLI output should become progress- and action-oriented by default:

- print validation, collection, normalization, metrics, and artifact-writing progress;
- print final artifact paths with the Markdown report first;
- print collection status and key caveats concisely;
- print the long JSON completion receipt only when `--json` is passed.

Errors should remain actionable and should continue to avoid partial artifacts that look complete.

## User / Maintainer Workflows

- A maintainer runs the live analyzer and immediately sees where to open the Markdown report instead of scanning a long stdout JSON object.
- A maintainer opens `friction-report.md`, reads a short executive summary, sees data-quality caveats near the top, and understands which conclusions are evidence-backed versus inferred.
- A maintainer reviews bottleneck tables and quickly compares PR evidence counts across representative examples.
- A maintainer sees that a validation recommendation is outlier-dominated and understands how conclusions change when the dominant PR is excluded.
- A maintainer opens CSV exports in a spreadsheet to sort PR metrics, inspect bottleneck examples, or share a narrow evidence table without sharing raw source bundles.
- A contributor can update golden report fixtures and CSV expectations deterministically.

## Acceptance Criteria

- [ ] Markdown reports clearly label observed evidence, interpretation, recommendation, and confidence/caveats for each bottleneck.
- [ ] Markdown reports include an executive summary, how-to-read guidance, key findings, evidence quality/coverage, methodology summary, and artifact sensitivity guidance.
- [ ] Representative PR examples render as scannable tables with key validation, review, changed-line, score, and source fields.
- [ ] Shared underlying evidence across multiple recommendation categories is either grouped or explicitly labeled so duplicated PR examples are not confusing.
- [ ] Reports include automatic outlier/sensitivity analysis when displayed examples are dominated by one PR.
- [ ] Full analysis runs generate curated CSV artifacts by default.
- [ ] Users can pass `--no-csv` to suppress CSV artifact generation.
- [ ] CSV exports include `pr-metrics.csv`, `bottleneck-examples.csv`, `comment-sources.csv`, and `collection-coverage.csv` or documented equivalents.
- [ ] CSV exports include the minimum column groups documented in the proposed solution and represent empty values without inventing unavailable metrics.
- [ ] CSV exports contain useful evidence fields without raw comments, raw workflow logs, tokens, secret-bearing environment values, or individual ranking outputs.
- [ ] Full analysis runs generate a detailed `methodology.md` artifact and link or reference it from `friction-report.md`.
- [ ] CLI success output is concise and action-oriented by default, with the long JSON completion receipt available through `--json`.
- [ ] `--json` mode emits parseable JSON on stdout only; progress and caveats move to stderr or are suppressed.
- [ ] CLI error output remains actionable and preserves existing partial-write safety guarantees.
- [ ] Existing JSON artifacts remain available and deterministic.
- [ ] Fixture/golden tests cover the revised Markdown structure, CSV outputs, methodology artifact, and quiet/default CLI output.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Tables can become too wide for Markdown readers. | Reports may be harder to read in terminals or narrow panes. | Keep table columns focused, use short labels, and move verbose source labels to methodology or coverage sections when possible. |
| Sensitivity analysis could be mistaken for deleting bad data. | Users might ignore real validation problems because an outlier is inconvenient. | Label sensitivity as interpretation support, preserve the original ranking, and explain that excluded-PR summaries show robustness rather than replacing evidence. |
| CSV artifacts can make sensitive data easier to share accidentally. | Users may expose private PR titles, URLs, paths, or metadata. | Keep CSVs curated, avoid raw comments and secrets, preserve artifact sensitivity warnings, and provide `--no-csv`. |
| Adding methodology and CSVs broadens the report contract. | Implementation could sprawl across CLI, report renderer, tests, docs, and fixtures. | Split into milestones: Markdown readability first, exports/methodology second, CLI output polish third. |
| Quiet CLI output may break users who parse stdout JSON today. | Automation around the MVP could fail. | Add `--json` and document the behavior change. Consider warning in release notes and tests for both modes. |
| Duplicated evidence across recommendation categories can look like repeated findings. | Users may think the analyzer found more independent problems than it did. | Group or label shared evidence when multiple bottlenecks use the same ranking source and examples. |
| Broad M2 scope can grow into several implementation PRs. | CSV, methodology, and sensitivity work may become too much for one reviewable change. | Require pre-implementation decisions before M2 activation and split M2 if the implementation packet cannot keep those concerns reviewable. |

## Testing Strategy

- Golden Markdown tests for the revised report shape and key section labels.
- JSON report tests to ensure existing report contract fields remain deterministic.
- CSV generation tests with representative values, escaping, empty values, and no raw comment text.
- CLI tests for default concise output, `--json`, `--no-csv`, artifact paths, and failure behavior.
- Methodology artifact tests that prove the file is generated and references the relevant selection, profile, scoring, coverage, outlier, and sensitivity concepts.
- Manual smoke test against `hannasdev/mcp-writing --limit 30`, including inspection of Markdown, methodology, CSVs, and CLI stdout.

## Open Questions

- [x] Should CSV exports be default or opt-in? Default, with `--no-csv` to suppress them.
- [x] Should methodology live inline or separately? Include a concise report summary and generate a more detailed `methodology.md` artifact.
- [x] Should outlier/sensitivity analysis be included now? Yes, include automatic sensitivity reporting when dominance is detected.
- [x] Should CLI stdout still print the long JSON receipt by default? No. Default output should be concise and progress-oriented; use `--json` for the machine receipt.
- [x] Should the detailed `methodology.md` be copied from a static repository doc, generated from report metadata, or a hybrid of static explanation plus run-specific facts? Use a hybrid: stable explanatory text with run-specific facts.
- [x] Should sensitivity analysis exclude only the top dominant PR for the highest bottleneck, or compute per-dominant-bottleneck sensitivity when several categories share the same outlier? Compute one summary per distinct dominant PR among displayed bottlenecks, deduplicating shared outliers.
- [ ] Before M2 activation, confirm whether the CSV/header contract still fits one reviewable milestone or should be split from methodology/sensitivity work.

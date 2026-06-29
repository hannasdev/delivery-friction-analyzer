# CLI Black-Box Polish Milestones

## M1: Command Surface Clarity

### Outcome

Users can get help for the command or context they are using and can tell which flags apply to sample mode, live GitHub mode, dry-run coverage probing, interactive setup, presets, and output generation.

### Scope

- Restructure CLI help or usage text so sample and live GitHub workflows are visibly distinct.
- Label output controls separately from live-only controls.
- Add mode-specific help through existing flags: `--source sample --help` and `--source github --help`.
- Keep top-level `--help` concise and focused on choosing a workflow.
- Make contextual `?` help available for representative interactive prompt groups without discarding prior answers or forcing the user to restart the flow. In scope: source/repository, profile path or profile-writing choices, workflow/profile context, PR-class exclusion or preset prompts, output/CSV/JSON choices, dry-run/metadata-only choice, and preset-save choice.
- Keep intentional sample-mode rejections for live-only flags, but make their errors name the compatible sample options and a live GitHub alternative where useful.
- Clarify dry-run and metadata-only wording as live GitHub coverage probes, not sample output modes.
- Clarify that presets are created through interactive or live-run workflows and that sample mode is a demo path, not a preset source.
- Add or update focused CLI tests for help output and rejected flag combinations.

### Scope Budget

- Primary behavior change: users understand mode-specific CLI flags before trial-and-error.
- Major subsystem boundaries touched: CLI parser/help adapter, interactive prompt flow, and validation copy/docs.
- Acceptance criteria count: 7.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: CLI help/validation tests plus docs/preflight.
- Split rationale: This exceeds the 5-criterion preference and the 2-boundary preference because interactive/contextual help is inseparable from making the command surface self-explanatory. The milestone still stays on one user-facing surface: command help, prompt help, and validation copy.

### Non-Goals

- Do not add new analysis modes.
- Do not rename existing flags.
- Do not change report, CSV, normalization, or metric behavior.
- Do not make prompts implicit for non-interactive runs.
- Do not introduce a subcommand migration, `help sample`, or nested option namespaces in M1. If implementation proves the existing parser cannot support mode-specific help through current flags, return to planning before changing command shape.

### Acceptance Criteria

- [x] `--help` or equivalent usage output separates sample, live GitHub, and output-control concepts clearly enough that sample/live-only boundaries are visible.
- [x] `--source sample --help` and `--source github --help` are available for the main user workflows without requiring users to read one flat option list.
- [x] Interactive setup offers `?` help for the representative prompt groups named in scope without losing answers already supplied.
- [x] `--source sample` with live-only flags fails with actionable copy that names allowed sample output controls.
- [x] `--dry-run` and `--metadata-only` are described as live GitHub coverage probes.
- [x] Preset save/load docs and help do not imply unsupported sample-mode behavior.
- [x] Tests cover representative valid and invalid sample/live combinations.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `npm run preflight`
- Manual: run `delivery-friction-analyzer --help`, mode-specific help, one rejected sample/live flag combination, and one interactive `?` path that verifies answers entered before help are preserved.

### Risks / Watchpoints

- Keep top-level help concise enough to scan in a terminal, with deeper help available on demand.
- Avoid making docs claim a flag is unsupported if implementation actually accepts it through presets or interactive flow.
- Preserve deterministic non-interactive errors.
- Follow familiar CLI conventions over inventing a bespoke help interaction.
- Any move toward subcommands or a Git-style `help <topic>` command requires a planning revision before implementation.
- Any expansion from representative prompt-group help to per-prompt help for every interactive question should be treated as a follow-up, not part of M1.

### Status

Lifecycle state lives in `initiative.json`. Use this section only for human-readable notes that do not contradict the structured state.

## M2: Receipt And Artifact Truthfulness

### Outcome

Completion receipts, CSV artifacts, reports, and methodology agree on accepted filters and available review-thread counts.

### Scope

- Decide and implement how live dry-run receipts represent accepted `--exclude-pr-class` input.
- Use `analysisFilter.excludedPrClasses` in completion receipts to represent accepted PR-class exclusions consistently across dry-run and full runs.
- Ensure preset-provided exclusions and CLI-provided exclusions produce consistent receipt metadata.
- Fix the sample `pr-metrics.csv` `review_threads` cells so they align with available review-thread evidence, or remove/rename the field if the contract says it cannot be populated.
- Add focused tests that trace review-thread counts through generated artifacts.
- Update docs or contract text when receipt or CSV semantics are clarified.

### Scope Budget

- Primary behavior change: generated machine-readable and spreadsheet-readable outputs are truthful and aligned.
- Major subsystem boundaries touched: CLI completion receipts and CSV/report artifact rendering.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 650 changed lines.
- Validation shape: CLI receipt tests, artifact/fixture tests, and preflight.
- Split rationale: Receipt metadata and CSV count alignment are one artifact-truthfulness slice; report ranking changes are kept in M3.

### Non-Goals

- Do not change PR-class matching rules.
- Do not make dry-run compute full metrics or write report artifacts.
- Do not add new CSV files.
- Do not change GitHub collection permissions or coverage rules.

### Acceptance Criteria

- [x] Live dry-run JSON receipts expose requested PR-class exclusions through `analysisFilter.excludedPrClasses`.
- [x] Preset-loaded exclusions and direct CLI exclusions produce the same `analysisFilter.excludedPrClasses` receipt semantics.
- [x] `pr-metrics.csv` review-thread counts are populated when review-thread counts are available in normalized/report evidence.
- [x] Sample and live-like fixture artifacts agree on review-thread totals across receipt/report/CSV where the data is available.
- [x] Contract or reference docs are updated if receipt or CSV field semantics change.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/report.test.mjs`
- `npm run preflight`
- Manual: run sample with CSVs and inspect `pr-metrics.csv`; run live dry-run with `--exclude-pr-class` and `--json`.

### Risks / Watchpoints

- Do not blur the distinction between requested filters and filters actually applied to metrics.
- If the blank CSV cells come from missing normalized data, fix the owning boundary rather than patching display output only.
- Keep displayed labels aligned with machine-readable values.

### Status

Lifecycle state lives in `initiative.json`. Use this section only for human-readable notes that do not contradict the structured state.

## M3: Low-Signal Report Quieting

### Outcome

Tiny or clean analyses move zero-score bottlenecks into no-signal context instead of promoting them or their recommendation categories as observed friction.

### Scope

- Define report-layer behavior for bottlenecks with no positive displayed evidence.
- Treat "positive displayed evidence" as a raw, unrounded report-owned representative score greater than zero in the displayed bottleneck example or summary, including iteration drag, spread score, validation gap score, planning gap score, review surprise score, or fix amplification score. Do not classify by rounded display strings or hidden non-report fields.
- Add a no-signal category or section that explains inactive bottlenecks without treating them as focus items.
- Adjust executive summary, focus snapshot, recommendation category snapshot, and ranked bottleneck sections so zero-score signals are excluded from top findings and recommendation drivers.
- Add a report JSON sibling `noSignalBottlenecks` list whose entries use the same property names and deterministic ordering as ranked bottleneck entries.
- Exclude no-signal IDs from completion receipt `topBottleneckIds`.
- Emit `noSignalBottleneckIds` as an array for report-generating runs, using an empty array when no no-signal bottlenecks exist; emit `null` for dry-run or metadata-only runs where report ranking is not computed.
- Preserve evidence, methodology, and caveats for small samples without inventing confidence.
- Add fixture/golden tests for a one-PR clean report and any affected JSON fields.
- Include fixture cases for a zero-score review/validation bottleneck, a one-PR clean report, and a small sample with a real positive score to prove low-count evidence is not suppressed.
- Document the small-sample and zero-signal interpretation in report methodology or reference docs.

### Scope Budget

- Primary behavior change: reports distinguish observed friction from inactive or low-evidence context.
- Major subsystem boundaries touched: report rendering, report JSON/Markdown fixtures, and completion receipt/CLI contract output.
- Acceptance criteria count: 9.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: report fixture/golden tests plus manual black-box inspection.
- Split rationale: This exceeds the 5-criterion preference and the 2-boundary preference because Markdown, report JSON, and completion receipts must stay consistent when no-signal behavior changes. The milestone remains one reviewable report-contract slice; if implementation cannot keep receipt changes tightly coupled to report output, split receipt follow-through into a separate milestone.

### Non-Goals

- Do not change core metric formulas unless implementation proves the report layer cannot accurately express inactive signals.
- Do not hide coverage caveats or small-sample caveats.
- Do not remove stable report sections solely for aesthetic reasons.
- Do not make cross-repository benchmark claims.

### Acceptance Criteria

- [x] Reports move zero-score bottlenecks into a no-signal category instead of listing them as top findings.
- [x] No-signal classification is driven by zero raw unrounded score or absence of positive representative report-owned scores, not by rounded display values, hidden non-report fields, or sample size alone.
- [x] The no-signal category explains the potential use of those bottlenecks when evidence exists.
- [x] Report JSON includes a sibling `noSignalBottlenecks` list using the same item property names and deterministic ordering as ranked bottleneck entries.
- [x] Completion receipts exclude no-signal IDs from `topBottleneckIds`; report-generating receipts include `noSignalBottleneckIds` as an array, and dry-run or metadata-only receipts set it to `null`.
- [x] `noSignalBottlenecks` ordering follows ranked-bottleneck ordering after positive-signal entries are removed, with stable bottleneck ID tie-breaks.
- [x] Recommendation category counts are not inflated by bottlenecks with no positive displayed evidence.
- [x] One-PR clean reports still show evidence reviewed, coverage caveats, and methodology.
- [x] JSON report fields affected by low-signal handling are documented and covered by tests.
- [x] Manual black-box run against a tiny live sample produces a report whose top findings match the observed evidence.

### Required Validation

- `node --test test/report.test.mjs` with explicit JSON assertions for `noSignalBottlenecks`, `topBottleneckIds`, and `noSignalBottleneckIds`
- `node --test test/analyze-github-cli.test.mjs`
- `npm run preflight`
- Fixture or JSON assertions must cover: report-generating run with no no-signal entries emits `noSignalBottleneckIds: []`; report-generating run with no-signal entries emits the expected IDs; dry-run and metadata-only receipts emit `noSignalBottleneckIds: null`; `topBottleneckIds` excludes no-signal IDs; `noSignalBottlenecks` uses stable bottleneck ID tie-breaks.
- Manual: run a one-PR live or live-like analysis and inspect `friction-report.md`.

### Risks / Watchpoints

- Avoid hiding a real but low-count issue merely because the sample is small.
- Keep raw-score classification and displayed rounded values aligned in explanatory text so users are not confused by near-zero edge cases.
- Coordinate JSON and Markdown changes so downstream consumers do not see contradictory outputs.
- Keep caveat wording concise; this initiative is meant to reduce noise, not add another wall of warnings.

### Status

Lifecycle state lives in `initiative.json`. Use this section only for human-readable notes that do not contradict the structured state.

## Activation Watchpoints

- Human approval was recorded in the PRD on 2026-06-28; do not activate unless initiative lifecycle state is updated through the activation workflow.
- M1 must not become a CLI redesign. Use top-level `--help`, `--source sample --help`, `--source github --help`, and interactive `?` help; return to planning before introducing subcommands or `help <topic>` command shape.
- M2 must keep `analysisFilter.excludedPrClasses` and `pr-metrics.csv` `review_threads` truthfulness explicit in tests.
- M3 must use the predicate "zero raw unrounded score or no positive representative report-owned score"; do not suppress real low-count evidence merely because the sample is small.
- If any milestone exceeds the repo broad-change tripwires, split the implementation or record why the chosen scope is still reviewable before PR work.

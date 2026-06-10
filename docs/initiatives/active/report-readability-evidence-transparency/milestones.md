# Report Readability And Evidence Transparency Milestones

## M1: Markdown Report Structure And Labels

### Outcome

Make the Markdown report readable as a human-facing diagnostic artifact by adding clearer sections, consistent evidence labels, and scannable bottleneck tables without changing the underlying metric formulas.

### Scope

- Reorganize `friction-report.md` around a reader path: executive summary, how to read, evidence quality, key findings, ranked bottlenecks, recommendation categories, sources/surfaces, methodology summary, guardrails, and follow-up.
- Clearly separate observed evidence, interpretation, recommendation, and confidence/caveats for each bottleneck.
- Replace dense per-PR validation/review prose with tables that expose the same counts more clearly.
- Make coverage and data-quality caveats visible before detailed rankings.
- Add a concise methodology summary explaining selection, profile classification, score-like metrics, coverage, and limitations.
- Reduce confusing duplication when multiple recommendation categories share the same underlying evidence.
- Preserve report guardrails against individual ranking and opaque composite scoring.

### Non-Goals

- Do not add CSV exports in this milestone.
- Do not add `methodology.md` in this milestone.
- Do not add sensitivity analysis in this milestone.
- Do not change the CLI stdout behavior in this milestone.
- Do not change metric formulas except for bug fixes required to preserve existing semantics.
- Do not introduce charts, HTML, or a web UI.

### Acceptance Criteria

- [ ] Markdown reports include the new high-level sections in a stable order.
- [ ] Each bottleneck visibly distinguishes observed evidence, interpretation, recommendation, and confidence/caveats.
- [ ] Representative PR examples render in Markdown tables with score, changed-line, validation, review, and source fields.
- [ ] Coverage caveats appear before users reach detailed bottleneck recommendations.
- [ ] Shared evidence across related bottlenecks is grouped or labeled clearly enough to avoid implying independent findings.
- [ ] Existing JSON report output remains deterministic and compatible.
- [ ] Golden tests cover the revised Markdown report structure and representative table rows.

### Required Validation

- `npm test`
- `node --test test/report.test.mjs`
- Manual: inspect a generated `friction-report.md` for `hannasdev/mcp-writing --limit 30`.

### Risks / Watchpoints

- Markdown tables may become too wide if every evidence field is included.
- The report must remain transparent without turning into a wall of tables.
- Label changes should not hide source labels needed for traceability.
- M1 should stay focused on Markdown readability. CSV, detailed methodology, sensitivity analysis, and CLI delivery changes belong to later milestones.

### Status

- [ ] Not started
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M2: Methodology And Evidence Exports

### Outcome

Add deeper transparency artifacts so maintainers can understand the methodology and inspect curated raw evidence without reading nested JSON.

### Scope

- Generate a detailed `methodology.md` artifact for full analysis runs.
- Reference or link the detailed methodology artifact from `friction-report.md`.
- Use a hybrid methodology artifact: stable explanatory text plus run-specific facts such as repository, selection, coverage, profile path when available, artifact names, and sensitivity summaries.
- Generate curated CSV exports by default:
  - `pr-metrics.csv`
  - `bottleneck-examples.csv`
  - `comment-sources.csv`
  - `collection-coverage.csv`
- Include at least the minimum column groups defined in the PRD for each CSV.
- Add a `--no-csv` CLI flag to suppress CSV export generation.
- Include automatic outlier/sensitivity analysis when a bottleneck is dominated by one PR, using one summary per distinct dominant PR among displayed bottlenecks.
- Preserve existing JSON artifacts as the machine-readable audit trail.
- Update report and artifact contracts to describe CSV and methodology outputs.

### Pre-Implementation Decisions

- Confirm whether M2 remains one reviewable PR or should split CSV exports from methodology/sensitivity implementation.
- Confirm whether `src/report/generate-report.js` remains JSON/Markdown-only by default or receives explicit opt-in flags for methodology/CSV generation.
- Confirm whether any optional sensitivity fields added to `friction-report.v1` are backwards-compatible additions or require a report-version bump.

### Non-Goals

- Do not export raw comments, raw workflow logs, tokens, secrets, or individual ranking outputs.
- Do not make CSV exports replace JSON artifacts.
- Do not implement arbitrary user-selected CSV schemas.
- Do not implement PR exclusion as a general CLI feature unless required for internal sensitivity calculation.

### Acceptance Criteria

- [ ] Full analysis writes `methodology.md` with selection, profile, scoring, coverage, dominance, sensitivity, and limitation explanations.
- [ ] Full analysis writes curated CSV exports by default.
- [ ] `--no-csv` suppresses CSV artifacts while still writing Markdown, JSON, source bundle, normalized data, and metrics summary.
- [ ] CSV rows are deterministic, properly escaped, and include the minimum PRD column groups for each artifact.
- [ ] CSV empty cells represent unavailable values without inventing metrics; real zero counts remain numeric zeroes.
- [ ] CSV exports do not include raw comment text or secret-bearing data.
- [ ] Outlier/sensitivity analysis appears in the Markdown report when dominance is detected.
- [ ] Sensitivity output preserves original rankings and labels excluded-PR summaries as robustness context, not filtered truth.
- [ ] Sensitivity calculation reuses existing normalized data and metric formulas through report-layer recomputation or an equivalent helper without changing metric formulas.
- [ ] Tests cover default CSV output, `--no-csv`, methodology generation, and sensitivity behavior.

### Required Validation

- `npm test`
- Manual: run live analysis against `hannasdev/mcp-writing --limit 30` and inspect `friction-report.md`, `methodology.md`, and CSV files.
- Manual: confirm `--no-csv` omits CSV artifacts without affecting core outputs.

### Risks / Watchpoints

- CSV exports are easier to share than JSON and still may contain private PR metadata.
- Sensitivity analysis must not imply the tool is discarding inconvenient evidence.
- Run-specific methodology should not drift from static product docs or report contract docs.

### Status

- [ ] Not started
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M3: CLI Report Delivery Experience

### Outcome

Make the CLI completion experience point maintainers to the useful report artifacts while preserving machine-readable output through an explicit flag.

### Scope

- Replace the long default stdout JSON completion receipt with concise progress and completion output.
- Print the Markdown report path first, followed by key artifact paths and collection coverage status.
- Add a `--json` flag that prints the existing machine-readable completion receipt.
- Ensure `--json` writes valid JSON to stdout without progress text mixed into stdout.
- Keep error messages actionable for malformed input, inaccessible repositories, missing permissions, unwritable output paths, and partial-write failures.
- Document the new stdout behavior, `--json`, and `--no-csv`.
- Add README and release-log coverage for the default stdout compatibility change.
- Update CLI tests for default output, `--json`, and error cases.

### Non-Goals

- Do not redesign all CLI options.
- Do not add interactive prompts.
- Do not remove JSON artifacts written to disk.
- Do not add a TUI, browser opener, or report viewer.

### Acceptance Criteria

- [ ] Successful default CLI runs print a concise human-readable completion message with primary artifact paths.
- [ ] `--json` preserves the full machine-readable completion receipt as parseable JSON on stdout.
- [ ] Progress messages and caveats are written to stderr or suppressed when `--json` is used.
- [ ] Progress messages remain useful and do not hide long-running collection phases.
- [ ] Error output remains actionable and avoids leaking secrets.
- [ ] README, release-log, and tests cover default output, `--json`, `--no-csv`, and failure paths.
- [ ] Existing partial-write safety behavior remains covered by tests.

### Required Validation

- `npm test`
- Manual: run the CLI against `hannasdev/mcp-writing --limit 30` and inspect stdout.
- Manual: run the CLI with `--json` and confirm the full receipt is still available.

### Risks / Watchpoints

- Any existing automation that parses stdout JSON must opt into `--json`.
- Progress output should remain readable without becoming noisy.
- Error handling changes should not weaken the artifact transaction guarantees.

### Status

- [ ] Not started
- [x] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

Lifecycle note: Final acceptance/completion bookkeeping and moving this initiative to `docs/initiatives/done/` are intentionally deferred until the M3 PR is reviewed and merged.

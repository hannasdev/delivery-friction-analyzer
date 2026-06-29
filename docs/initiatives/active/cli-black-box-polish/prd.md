# CLI Black-Box Polish

## Status

- State: Complete
- Human approval: Approved
- Owner: Hanna
- Created: 2026-06-28
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Interactive CLI Setup](../../done/interactive-cli-setup/prd.md)
  - [Tutorial Sample Experience](../../done/tutorial-sample-experience/prd.md)
  - [PR Class Segmentation](../../done/pr-class-segmentation/prd.md)
  - [Run Presets](../../../reference/run-presets.md)

## Problem

Black-box testing the CLI as a user showed that the analyzer's newest surfaces work, but a few rough edges can still undermine trust during first-run exploration:

- CLI help exposes sample, live GitHub, dry-run, filtering, JSON, CSV, interactive, preset, and product-repository options in one flat list, so users can reasonably try combinations that are rejected later.
- Sample mode rejects live-only options such as `--dry-run`, `--metadata-only`, `--exclude-pr-class`, and `--save-preset`, but the help text does not make those applicability boundaries visible before the user hits an error.
- Live dry-run accepts `--exclude-pr-class`, but the JSON receipt still reports `analysisFilter: null`, so users do not get confirmation that the filter flag was parsed.
- The sample receipt and report say review-thread counts are available, but `pr-metrics.csv` emits blank `review_threads` cells for sample PRs.
- A tiny, clean one-PR live report can still rank zero-score bottlenecks such as Review churn and Validation gap and show a broad recommendation category set, making the report feel noisier than the evidence supports.

The CLI should keep its current capabilities, but the user-facing contract needs a pass that aligns help, validation, receipts, generated artifacts, and low-signal report wording.

## Goals

- Make CLI option applicability clear before users discover invalid sample/live combinations by trial and error.
- Provide command- and context-specific help that follows familiar CLI conventions and can be requested without interrupting an interactive flow.
- Preserve current sample and live GitHub behavior while improving help and error guidance around mode-specific flags.
- Ensure dry-run completion receipts truthfully reflect accepted analysis filters.
- Align CSV, report, and receipt fields for review-thread counts and other displayed metadata.
- Move zero-score bottlenecks into a no-signal category so they remain discoverable without producing top-finding or recommendation noise.
- Add focused tests around CLI help, mode validation, receipts, CSV artifacts, and low-signal report rendering.

## Non-Goals

- Do not redesign the CLI command name, package entrypoint, or existing flag names.
- Do not remove sample mode, interactive mode, presets, PR-class filtering, CSV toggles, JSON receipts, or the product-repository guard.
- Do not change GitHub collection coverage rules or require additional GitHub permissions.
- Do not change the core metric formulas solely to improve one tiny sample report.
- Do not add a hosted UI, dashboard, graph output, or browser onboarding flow.
- Do not make sample mode perform live GitHub validation or dry-run collection.
- Do not make sample mode save or load run presets; presets are for reusable live or interactive run settings.

## Product And Design Alignment

Delivery Friction Analyzer is a local, evidence-preserving CLI. This initiative should reinforce that product posture by making mode boundaries, generated artifacts, and report caveats honest at the exact surfaces users touch:

- Help and validation copy should teach the sample/live distinction without making automation brittle.
- Receipts and generated artifacts should be reliable enough for scripts and human review.
- Reports should distinguish real signals from small-sample or zero-signal context.
- Changes should stay narrow because repository guidance flags CLI entrypoint behavior, metadata truthfulness, report caveat wording, CSV artifacts, and docs precision as recurring review hotspots.

## Proposed Solution

Clarify the command surface first. Help should make the two primary modes easy to scan:

- sample tutorial analysis, where output controls such as `--out`, `--json`, `--csv`, and `--no-csv` apply;
- live GitHub analysis, where repository, profile, limit, dry-run, metadata-only, validation-target, product-repository override, PR-class exclusion, interactive setup, and preset save/load apply.

The CLI may keep one command and one parser, but displayed usage and validation errors should explain why a flag is sample-compatible, live-only, or output-only. Existing rejected combinations may stay rejected when the behavior is intentional.

Help should also be available at the place where the user is making a decision. The M1 convention should stay close to established CLI patterns without forcing a subcommand redesign:

- `delivery-friction-analyzer --help` shows a concise overview and the main workflows.
- `delivery-friction-analyzer --source sample --help` shows sample-mode usage and output controls.
- `delivery-friction-analyzer --source github --help` shows live GitHub usage, dry-run, filtering, presets, validation-target, and product-repository override options.
- Interactive prompts advertise `?` for contextual help where extra explanation is useful; entering `?` explains the current prompt or option group and then resumes the flow without discarding answers already provided.

Interactive `?` help is bounded to representative prompt groups already present in the guided setup: source/repository choice, profile path or profile-writing choices, workflow/profile context prompts, PR-class exclusion or preset prompts, output/CSV/JSON choices, dry-run/metadata-only choice, and preset-save choice. M1 should not add a separate help system for every individual prompt or introduce new prompt categories solely to make help more complete.

`delivery-friction-analyzer help sample` or full subcommands such as `delivery-friction-analyzer sample` may be considered later, but they are out of scope for M1 unless the existing parser cannot support mode-specific help without confusing users.

Next, make machine-readable receipts and generated artifacts line up with what the command accepted and what the report says. If a dry-run accepts PR-class exclusions, the completion receipt should expose that filter or explicitly say that filtering is not applied during coverage-only sampling. CSV fields should not silently go blank when the same count is available elsewhere in the report or receipt.

Finally, quiet low-signal report conclusions. When a displayed bottleneck has zero score or no positive displayed evidence, the report should move that bottleneck into a "No signal observed" category instead of presenting it as a focus area. For this initiative, positive displayed evidence means the report-owned bottleneck example or summary has a raw, unrounded representative score greater than zero, such as iteration drag, spread score, validation gap score, planning gap score, review surprise score, or fix amplification score. Classification must not depend on rounded display text or hidden collection fields that are not part of report-owned bottleneck evidence. The category should explain what the bottleneck would be useful for when evidence exists, while keeping top findings and recommendation counts reserved for positive observed signals.

Report JSON should use an additive sibling list for no-signal entries. Positive-signal bottlenecks stay in the existing ranked/top bottleneck shape, while zero-score or no-positive-evidence bottlenecks move into a sibling `noSignalBottlenecks` list whose entries use the same property names as ranked bottleneck entries. The `noSignalBottlenecks` list should use the same deterministic report ordering as ranked bottlenecks would have used after positive-signal entries are removed, with stable bottleneck ID tie-breaks.

Completion receipts should exclude no-signal items from `topBottleneckIds`. For report-generating runs, receipts must include `noSignalBottleneckIds` as an array, using an empty array when no no-signal bottlenecks exist. For dry-run or metadata-only runs where report ranking is not computed, receipts must set both `topBottleneckIds` and `noSignalBottleneckIds` to `null`.

## User-Perspective Preview

- Primary users: maintainers and evaluators running the CLI directly, especially first-time users trying the sample, interactive setup, dry-run, or a small live repository sample.
- Result they should experience: the CLI feels coherent from `--help` through generated artifacts. Users can tell which flags belong to sample mode versus live GitHub mode, and receipts/reports do not overclaim what the run actually found.
- Visible surfaces: CLI help text, mode validation errors, JSON completion receipts, generated CSV files, Markdown reports, methodology text, README/reference docs where command examples or artifact promises are listed, and focused test fixtures.
- Key workflow:
  1. A user runs `delivery-friction-analyzer --help` and sees sample and live GitHub workflows separated enough to pick the right command.
  2. A user asks for help while inside an interactive flow and receives contextual guidance without losing the run setup already entered.
  3. A user who passes a live-only flag with `--source sample` receives an actionable error that names the compatible output flags and a live GitHub alternative when relevant.
  4. A user runs a live dry-run with `--exclude-pr-class feature --json` and the receipt truthfully reflects the requested filter behavior.
  5. A user opens generated CSVs and sees review-thread counts aligned with the receipt and report.
  6. A user analyzes a tiny clean sample and sees that no meaningful review or validation bottleneck was observed, with zero-score bottlenecks listed only as no-signal context.
  7. A script that reads report JSON can inspect positive-signal bottlenecks and no-signal bottlenecks separately, using the same item property names for both lists and deterministic ordering.
- States and edge cases: top-level help, mode-specific help, contextual interactive help for representative guided-setup prompt groups, sample mode with output-only flags, sample mode with live-only flags, live dry-run with filters, live full run with and without CSVs, preset-supplied filters, interactive dry-run, one-PR clean reports, and sample reports with partial coverage.
- What will not change: live analysis still requires GitHub access and a repository profile; sample mode remains deterministic and synthetic; repository profiles still own PR-class semantics; the product-repository guard remains explicit and opt-in.
- UX assumptions or gaps: human approval is recorded; implementation should still carry forward the no-subcommand, receipt-contract, and no-real-signal-suppression watchpoints.

## Human Approval Checkpoint

- Approval state: Approved
- Reviewer: Hanna
- Decision date: 2026-06-28
- Decision notes: Approved by Hanna on 2026-06-28 after adversarial review returned Accepted with notes. Carry forward the clarified product decisions: zero-score bottlenecks move to no-signal context; report JSON exposes a sibling `noSignalBottlenecks` list with the same item property names and deterministic ordering; completion receipts emit `noSignalBottleneckIds` as an array for report-generating runs and `null` for dry-run or metadata-only runs; sample mode does not affect presets; and help uses familiar CLI conventions with mode-specific `--help` and interactive `?` help.

## User / Maintainer Workflows

- A new user runs the bundled sample and understands which optional flags are valid for sample output.
- A maintainer uses live dry-run as a coverage probe and gets a truthful JSON receipt.
- A maintainer exports CSV evidence and can trust that displayed count fields match the report.
- A maintainer tests a clean small repository sample and receives a cautious report that does not invent friction.
- A maintainer or reviewer compares fixture/golden report changes against explicit milestone acceptance criteria.

## Acceptance Criteria

- [ ] CLI help and validation copy clearly distinguish sample-compatible, live-only, and output-only flags, with command- or context-specific help available without disrupting interactive setup.
- [ ] Dry-run receipts truthfully represent accepted PR-class filter input or explicitly document why the filter is not applied during coverage-only sampling.
- [ ] CSV review-thread counts align with the available normalized/report/receipt evidence for sample and live runs.
- [ ] Tiny or zero-signal reports move zero-score bottlenecks into a no-signal category instead of promoting them as top findings or recommendation drivers.
- [ ] Report JSON exposes no-signal bottlenecks in a sibling `noSignalBottlenecks` list whose entries use the same property names and deterministic ordering as ranked bottleneck entries; completion receipts exclude no-signal IDs from `topBottleneckIds` and follow the `noSignalBottleneckIds` array/null contract.
- [ ] README/reference documentation stays precise about conditional artifacts, `npx` or package usage, interactive prompts, and configured versus observed claims touched by this initiative.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Help text becomes too long. | Users may have more to scan instead of less. | Group by workflow and keep examples concrete; avoid repeating every parser detail in every section. |
| Moving zero-score findings into no-signal context changes downstream expectations. | Golden outputs or scripts that expect stable top-bottleneck arrays may need updates. | Treat report wording and JSON shape as contract changes; document any changed fields and add focused fixture/schema tests. |
| Filter receipts overpromise dry-run behavior. | Users may think dry-run recomputes metrics when it only samples coverage. | Either expose requested filters as pending run options or explicitly label them as not applied until full analysis. |
| CSV count fixes reveal a normalization mismatch. | The issue may be deeper than one renderer. | Trace the field from normalized data to metrics/report/CSV and fix the earliest contract boundary that owns the count. |
| Copy changes accidentally imply configured profile context is observed GitHub evidence. | Report trust worsens. | Reuse established configured-versus-observed wording from existing report and methodology docs. |
| Nested help expands the command surface too quickly. | Implementation could drift into a larger CLI redesign. | Start with conventional help affordances for existing modes and prompts; defer subcommands or option namespaces unless needed to make help usable. |

## Testing Strategy

- CLI tests for top-level `--help`, `--source sample --help`, `--source github --help`, interactive `?` help, sample/live flag validation, and actionable errors.
- CLI receipt tests for dry-run filters, preset-provided filters, and JSON output.
- CSV artifact tests for review-thread counts in sample and live-like fixtures.
- Report/golden tests for one-PR clean or zero-signal cases.
- Documentation/reference checks through `npm run preflight`.
- Manual black-box smoke tests mirroring the observed user flows before PR review.

## Resolved Decisions

- [x] Zero-score bottlenecks should move to a no-signal category so they do not produce top-finding or recommendation noise, while still teaching users what those bottlenecks would mean when evidence exists.
- [x] Report JSON should expose a sibling `noSignalBottlenecks` list. Items in that list should use the same property names and deterministic ordering as ranked bottleneck items, but they are sorted into no-signal context because raw report-owned representative score signal is zero or absent.
- [x] Completion receipts should emit `noSignalBottleneckIds` as an array for report-generating runs and `null` for dry-run or metadata-only runs where ranking is not computed.
- [x] Sample mode should not affect run presets. Presets are created through interactive or live-run workflows for reusable local run settings; sample mode is only a deterministic demo path.
- [x] Help should follow familiar CLI conventions: top-level `--help`, mode-specific help through existing mode flags, and interactive `?` prompt help where useful, without interrupting or discarding the user's current flow.

## Approval Record

- [x] Human approval of the overall preview was granted by Hanna on 2026-06-28.

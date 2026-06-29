# CLI Black-Box Polish Architecture Notes

## Context

This initiative touches user-facing CLI contracts and generated artifact contracts rather than core collection architecture. Architecture notes are included because the work may change command help semantics, JSON receipt fields, CSV field population, and report ranking/display behavior.

## Current State

- The CLI exposes sample, live GitHub, interactive setup, dry-run, JSON, CSV, PR-class filtering, presets, validation-target metadata, and product-repository override flags through one command surface.
- Sample mode is deterministic and synthetic. It accepts output controls but rejects live-only collection or filtering controls.
- Live dry-run samples GitHub coverage and writes a JSON receipt without report artifacts.
- Full sample and live runs can write Markdown, JSON, methodology, normalized data, metrics, source bundle, and optional CSV artifacts.
- Reports separate observed evidence, configured profile context, interpretation, recommendations, and caveats, but tiny clean runs can still surface zero-score bottlenecks as top findings.

## Target Shape

- CLI help and validation make option applicability visible at the workflow boundary: sample tutorial run, live GitHub run, dry-run coverage probe, interactive setup, presets, and output controls.
- Help is available at the user's current command or prompt context and can return to interactive setup without discarding answers.
- Interactive `?` help is scoped to representative prompt groups: source/repository, profile path or profile-writing choices, workflow/profile context, PR-class exclusion or preset prompts, output/CSV/JSON choices, dry-run/metadata-only choice, and preset-save choice.
- Completion receipts distinguish requested run options from metrics or artifacts actually produced.
- CSV fields are populated from the same normalized or metrics-owned evidence used by reports, or documented as unavailable when the owning data is absent.
- Report ranking and recommendation snapshots only promote bottlenecks with positive displayed evidence, and zero-score bottlenecks move to no-signal context.
- Positive displayed evidence is determined by raw, unrounded report-owned representative scores greater than zero in bottleneck examples or summaries, such as iteration drag, spread score, validation gap score, planning gap score, review surprise score, or fix amplification score. Rounded display text and hidden non-report fields must not drive no-signal classification.
- Report JSON exposes no-signal bottlenecks as a sibling `noSignalBottlenecks` list whose entries use the same property names and deterministic ordering as ranked bottleneck entries.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Keep the existing command stable while adding contextual help. | Existing package usage remains stable and automation-friendly, while users can still ask for help at the decision point they are in. | Add a full subcommand migration such as `sample` and `github`; defer unless the current parser cannot support usable mode-specific help. |
| Use `--source sample --help`, `--source github --help`, and interactive `?` for M1 help. | This follows common CLI patterns without redesigning the command around subcommands. | `--help sample` is less conventional; `help sample` or `sample --help` are conventional only after adding subcommands or a topic-help command. |
| Keep sample mode out of presets. | Sample mode is a deterministic demo with few reusable decisions; interactive and live workflows own reusable local run settings. | Allow `--source sample --save-preset`; rejected because it adds state to a tutorial path without meaningful rerun value. |
| Treat dry-run filters as requested run options unless metrics are computed. | Dry-run is a coverage probe and should not imply filtered metrics were generated. | Ignore filters in receipts; this hides accepted user input and caused black-box confusion. |
| Fix artifact truthfulness at the owning boundary. | CSV/report/receipt consistency matters more than display-only patching. | Fill blank CSV cells ad hoc; this risks diverging from normalized data or report JSON. |
| Move zero-score report findings into no-signal context at the report layer first. | The observed issue is presentation of inactive signals, not necessarily metric computation. | Change metric formulas; only do this if report-layer handling cannot represent no-signal states honestly. |
| Use additive no-signal JSON fields. | Downstream consumers can adopt the clearer distinction without losing the ranked item property shape. | Reuse `topBottleneckIds` for zero-score items; rejected because it preserves the current noise. |
| Emit `noSignalBottleneckIds` consistently in completion receipts. | Scripts can distinguish report-generating runs from coverage-only dry-runs without guessing whether the field is absent by accident. | Emit the field only when useful; rejected because it creates ambiguous receipt semantics. |

## Contracts And Boundaries

- CLI parser and help own which flags are accepted, how invalid combinations are explained, and how contextual help is reached.
- Interactive prompt flow owns nested help behavior and must preserve answers already collected when help is requested.
- Interactive prompt flow should provide representative prompt-group help only; exhaustive per-prompt help or new prompt categories are outside M1.
- Run presets own reusable run preferences, not repository semantics.
- Sample mode owns deterministic tutorial output only; it does not own preset creation or reusable run state.
- Repository profiles own PR class rules, workflow context, and contributor-source declarations.
- Completion receipts own run status, artifact paths, accepted options that matter to reruns, coverage summaries, totals when computed, and top bottleneck IDs when computed.
- Completion receipts should use `analysisFilter.excludedPrClasses` for requested PR-class exclusions and should exclude no-signal IDs from `topBottleneckIds`.
- Completion receipts for report-generating runs should emit `noSignalBottleneckIds` as an array, including an empty array when none exist; dry-run or metadata-only receipts should set `noSignalBottleneckIds` to `null` because report ranking is not computed.
- CSV artifacts own spreadsheet-readable evidence fields and must stay aligned with normalized/report evidence.
- Markdown and JSON reports own user-facing interpretation, caveats, recommendation categories, and top-finding presentation.
- Report JSON owns the `noSignalBottlenecks` sibling list for zero-score or no-positive-evidence bottlenecks, sorted with the same deterministic report ordering as ranked bottlenecks after positive-signal entries are removed.

## Migration / Compatibility

Existing commands should continue to work. Help and error text may change without migration. JSON/report receipt changes should be additive where possible: `noSignalBottlenecks` and `noSignalBottleneckIds` are additive; `topBottleneckIds` should remain but contain only positive-signal top IDs. CSV fixes should populate existing fields where possible rather than introduce new columns.

## Failure Modes

- Unsupported flag combinations should fail before collection or artifact writes with actionable copy.
- Dry-run should not write report artifacts even when filters are supplied.
- If review-thread counts are unavailable, CSV/report fields should preserve unavailable or blank semantics consistently rather than mixing counts and blanks.
- If every bottleneck has zero positive evidence, reports should say no positive bottleneck signal was observed and list inactive bottlenecks only in no-signal context.
- Near-zero raw scores should be classified by their raw report-owned values before display rounding; explanatory text should avoid showing a rounded zero as if it were positive evidence.
- A small sample with a real positive representative score should remain eligible for top findings; sample size alone is not a no-signal predicate.
- If users request help during interactive setup, the CLI should show the relevant guidance and return to the current prompt or next safe prompt state without dropping prior answers.

## Security / Safety Considerations

- Do not add token, credential, or raw GitHub payload output to receipts, CSVs, presets, or reports.
- Preserve the product-repository guard and explicit override behavior.
- Do not make sample mode call GitHub or inspect local repositories.
- Keep path handling for presets and output directories within existing validation rules.

## Validation

- CLI parse/help tests for accepted combinations, rejected combinations, mode-specific help, and interactive contextual help.
- Receipt tests for dry-run, presets, and filters.
- Artifact tests for review-thread count consistency.
- Report fixture/golden tests for zero-score, one-PR clean, small-positive-signal behavior, deterministic `noSignalBottlenecks` ordering, and receipt `noSignalBottleneckIds` array/null semantics.
- Manual black-box smoke tests using sample, live dry-run, and a tiny live full run.

## Resolved Decisions

- [x] Zero-score bottlenecks should move to no-signal context instead of top findings or recommendation drivers.
- [x] Report JSON should expose no-signal bottlenecks as `noSignalBottlenecks`, a sibling list whose items share ranked bottleneck item property names and deterministic ordering.
- [x] Completion receipts should include `noSignalBottleneckIds` as an array for report-generating runs and `null` for dry-run or metadata-only runs.
- [x] Sample mode should not create or load presets.
- [x] Command- and context-specific help should be available through `--help`, `--source sample --help`, `--source github --help`, and interactive `?` help where useful.

## Approval Record

- [x] Human approval of the overall preview was granted by Hanna on 2026-06-28.

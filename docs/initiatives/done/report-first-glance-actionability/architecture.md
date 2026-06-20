# Report First-Glance Actionability Architecture Notes

## Context

The current report pipeline generates deterministic `friction-report.v1` JSON and Markdown from `friction-metrics.v1`, with full live analysis also writing methodology and curated CSV evidence artifacts.

Recent user feedback is about the report's reader path rather than metric correctness. The opening sections contain useful data, but the report still delays some action-oriented context until later sections and uses some terms that mirror internal metric names more than maintainer language.

The feedback also raises a possible downstream workflow: use analyzer output as structured input for another model that can draft a report narrative. That idea touches artifact boundaries and trust guarantees, so it needs an explicit architecture decision before any artifact implementation.

The initiative also assumes the PR class/report contract shape from the active PR class segmentation work. M1 should activate after that work is present on the base branch, or the implementation packet should explicitly call for rebasing against it before changing the report opening.

## Current State

- `src/report/friction-report.js` owns `friction-report.v1` generation and Markdown rendering.
- `renderRepositoryFrictionMarkdown` currently renders:
  - title and versions;
  - executive summary totals;
  - how-to-read guidance;
  - evidence quality and coverage;
  - key findings;
  - PR class context, shared signals, sensitivity, prioritization, and ranked bottlenecks;
  - recommendation categories after ranked bottleneck details;
  - supporting comment-source, surface, methodology, guardrail, follow-up, and artifact-sensitivity sections.
- `friction-report.json` contains structured summary, coverage, bottlenecks, recommendation categories, shared signals, sensitivity, guardrails, and follow-up.
- Full live analysis writes curated CSV evidence exports that can already support spreadsheet or downstream inspection.
- `src/report/generate-report.js` intentionally remains JSON/Markdown-only for fixture and advanced workflows.

## Target Shape

The report renderer should make first-glance decision context explicit without changing metric ownership:

- report JSON and metrics remain deterministic source data;
- Markdown presentation derives a compact focus snapshot from existing report fields by default;
- recommendation category context appears before detailed bottlenecks, preferably as a compact summary while retaining the full reference table later;
- user-facing labels and prose prefer maintainer language over internal metric terminology;
- stable IDs, table fields, contract references, and immediately explained metric-family labels may retain internal names for traceability;
- detailed evidence remains available below the opening sections.

The model-ready path should be decision/documentation-only first. If a later model-ready artifact is justified, it should be a deterministic local artifact derived from existing report data. It should not fetch network resources, call an LLM, mutate repositories, or create a second source of truth.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Keep M1 limited to Markdown presentation and contract docs. | User feedback directly targets report readability and first-glance focus. | Change metrics or recommendation ranking. |
| Preserve stable JSON and CSV identifiers during wording changes. | Existing tests, contracts, and downstream analysis may depend on IDs such as `changed-file-spread`. | Rename IDs everywhere, which would require a versioned contract change. |
| Surface recommendation categories near the top as a compact summary by default. | Readers should understand action themes before reading detailed bottleneck evidence while still having a full reference table later. | Move the full table near the top, or leave categories only near the end as a reference section. |
| Keep the focus snapshot Markdown-derived by default. | The feedback targets the human Markdown opening, and adding JSON fields would broaden the contract unnecessarily unless a downstream consumer needs them. | Add a `friction-report.v1` focus snapshot field immediately. |
| Treat any model-generated narrative as optional downstream use. | The analyzer's trust model depends on deterministic local artifacts. | Make the analyzer call a model or replace Markdown with generated prose. |
| Split model-context decision/docs from artifact production. | Docs-only and new-artifact paths touch different contracts, command behavior, and tests. | Keep both paths in one milestone and decide during implementation. |
| Evaluate existing JSON and CSV artifacts before adding `report-context.json`. | Avoid expanding artifact surface if current artifacts are enough. | Add a new artifact immediately. |
| M2 accepts `friction-report.json` plus curated CSV exports as sufficient for guarded downstream narrative drafting. | The existing JSON carries report identity, summary, coverage, PR class context, ranked bottlenecks, recommendation categories, guardrails, and follow-up, while CSV exports provide per-PR and source-level evidence without adding another artifact contract. | Add `report-context.json` now, or require users to interpret raw CSVs without JSON/source-of-truth guardrails. |

## Contracts And Boundaries

- Metrics boundary:
  - `friction-metrics.v1` formulas and ranking inputs remain unchanged.
  - Friendly wording must not change how component metrics are computed.
- Report JSON boundary:
  - Existing stable IDs and fields remain intact unless a separate versioned contract change is accepted.
  - New fields for a focus snapshot may be added only if the snapshot is needed outside Markdown; otherwise derive it in the renderer.
- Markdown boundary:
  - Markdown may use reader-facing labels that differ from internal IDs.
  - Markdown must continue separating observed evidence, interpretation, recommendation, and confidence/caveats.
  - The existing how-to-read trust orientation should remain near the top or be intentionally folded into the new evidence/confidence opening.
  - Markdown must keep caveats visible before detailed recommendations.
- CSV boundary:
  - CSV exports remain curated evidence trails, not prose-generation prompts.
  - M1 should not change CSV schemas.
- Optional model-context boundary:
  - M2 is decision/documentation-only and must not add an artifact, CLI flag, fixture output, or write path.
  - Any model-ready artifact must be deterministic and local.
  - It must carry guardrails and artifact sensitivity notes.
  - It must not include raw comments, workflow logs, tokens, secrets, or individual rankings.
  - It should derive from report JSON and CSV-equivalent data rather than recomputing metrics differently.
- CLI boundary:
  - M1 should not change CLI option behavior.
  - If M3 adds a new artifact to full live analysis, it must participate in the existing artifact write safety model.

## Migration / Compatibility

M1 is a presentation change. Existing JSON and CSV consumers should not need changes if stable identifiers remain unchanged.

Golden Markdown fixtures and tests will change because the section order and wording are part of the human-facing contract.

If M3 adds a new artifact, it should be additive. Existing core artifacts should continue to be written:

- `source-bundle.json`
- `normalized.json`
- `metrics-summary.json`
- `friction-report.json`
- `friction-report.md`
- `methodology.md`
- CSV evidence exports unless `--no-csv` is used

Before adding a new artifact, M2 must record why existing `friction-report.json` plus CSV exports are insufficient. If existing artifacts are sufficient, no artifact-producing milestone should be activated.

If M3 becomes artifact-producing, the implementation packet must name the chosen output surface before code changes begin: artifact filename, default or opt-in behavior, CLI completion listing, fixture command behavior, and artifact-sensitivity wording.

If M2 resolves as documentation-only, the durable guidance should live in `docs/contracts/friction-report.md` and README report-usage guidance, rather than only in an implementation note.

M1 activation should account for the active PR class segmentation dependency. If that initiative has not merged, either defer activation or make the implementation packet responsible for rebasing against the PR class report contract before editing the Markdown opening flow.

## Failure Modes

- Focus snapshot cannot identify bottlenecks because the report has no bottleneck evidence:
  - Render an explicit empty or unavailable state rather than omitting the section.
- Recommendation categories have zero triggered bottlenecks:
  - Show the supported categories or state that no categories were triggered, depending on which is clearer in the top summary.
- Coverage or PR class data is unavailable:
  - Preserve existing caveats and avoid presenting absence as evidence of no friction.
- A new model-ready artifact write fails in M3:
  - Treat it as an artifact generation failure if the artifact is part of the selected output set; do not leave a complete-looking partial run.
- Downstream model prose conflicts with deterministic artifacts:
  - Documentation should tell users to treat deterministic report artifacts as authoritative and model prose as a draft.

## Security / Safety Considerations

- Report summaries, CSVs, and any model-ready context may contain private repository names, PR titles, URLs, file paths, and metadata counts.
- Artifact sensitivity warnings should remain visible and should include any new context artifact.
- A model-ready context must not encourage uploading sensitive artifacts to third-party services without review.
- Guardrails against individual contributor and reviewer ranking must stay machine-readable or plainly visible in any downstream context.
- The report should not overstate certainty when evidence coverage is partial.

## Validation

- Golden Markdown tests for the new first-glance report structure.
- Unit tests for any focus snapshot helper.
- Regression tests for clarified wording in user-visible Markdown.
- Report contract documentation review.
- If model context is added in M3, deterministic artifact tests and negative assertions for raw comments, secrets, workflow logs, and individual rankings.
- Manual fixture inspection to ensure the first screen is concise and action-oriented.

## Open Questions

- [x] Is there a concrete downstream consumer that requires focus snapshot data as a structured `friction-report.v1` field instead of the preferred Markdown-only derivation? No. The focus snapshot remains Markdown-derived.
- [x] Does implementation evidence justify moving the full recommendation category table near the top, or should it keep the preferred compact top summary plus later full table? Keep the compact top summary plus later full table.
- [x] Does M2 show that `report-context.json` is materially different enough from `friction-report.json` plus CSVs to justify activating M3? No. Existing `friction-report.json` plus curated CSV exports are sufficient for the guarded downstream narrative workflow, so M3 remains deferred unless a concrete consumer needs a smaller single-file context or machine-readable prompt package.
- [x] If M3 is activated, should the model context artifact be default, opt-in, or limited to specific commands? Not applicable after M2; no model context artifact is activated.
- [x] If M3 is activated, should `src/report/generate-report.js` remain JSON/Markdown-only or support the new artifact explicitly? Not applicable after M2; `src/report/generate-report.js` remains JSON/Markdown-only.
- [x] Has the PR class segmentation report contract landed on the base branch, or does the implementation packet need an explicit rebase/dependency note? Yes. PR Class Segmentation M3 merged in PR #27 before this initiative completed.

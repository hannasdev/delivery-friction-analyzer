# Report First-Glance Actionability

## Status

Status: Active; M1 merged and M2 active.

- State: Active
- Owner: Hanna
- Created: 2026-06-15
- Activated: 2026-06-15
- Current milestone: M2: Model-Ready Context Decision And Documentation (active)
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [Friction Metrics Contract](../../../contracts/friction-metrics.md)
  - [Report Readability And Evidence Transparency](../../done/report-readability-evidence-transparency/prd.md)
  - [PR Class Segmentation](../../active/pr-class-segmentation/prd.md)

## Problem

User feedback on the generated report shows that the report is more transparent than before, but it still makes readers work too hard to understand what deserves attention at a glance.

Current pain points:

- The first screen does not clearly answer what the reader should focus on.
- Recommendation categories appear after the detailed ranked bottlenecks, so users must read far before understanding the action themes.
- The high-level summary is mostly totals and top bottleneck IDs, rather than a tailored summary of what the analyzer found and what evidence was reviewed.
- Some phrasing is too metric-internal for maintainers, such as "changed-file spread" where "number of files" or another reader-facing label may be clearer.
- There is interest in producing analyzer output that another model could use to generate a more narrative report from the generated CSVs or structured artifacts.

The report already separates evidence, interpretation, recommendations, caveats, PR class context, sensitivity, methodology, and CSV evidence. This initiative should improve the report's first-glance communication and language without weakening those trust boundaries.

## Goals

- Make the top of the Markdown report clearly show the most important focus areas, action categories, evidence reviewed, and confidence caveats.
- Move or duplicate recommendation category context near the top so readers can understand the action themes before detailed bottlenecks.
- Tailor the executive summary toward what the analyzer found, including top findings, triggered recommendation categories, sample size, reviewed evidence counts, coverage caveats, and outlier or PR-class caveats.
- Replace metric-internal language with maintainer-facing labels where possible, including changing "changed-file spread" in user-visible prose to clearer wording such as "number of files" or "files changed" when that is the actual concept being communicated.
- Preserve transparent ranking, evidence, caveats, and guardrails; the report must remain auditable rather than becoming untraceable prose.
- Decide whether existing artifacts are sufficient for a model-ready report context workflow, and only define a deterministic local artifact in a later milestone if the decision finds a concrete gap.

## Non-Goals

- Do not change the underlying metric formulas or ranking semantics solely to improve wording.
- Do not remove detailed bottleneck evidence, coverage tables, methodology, CSV exports, or JSON artifacts.
- Do not introduce a hosted report service, web UI, dashboard, or automatic external LLM call.
- Do not make model-generated narrative the default source of truth for `friction-report.md`.
- Do not rank individuals, reviewers, or authors.
- Do not hide outlier, class-dominance, or coverage caveats to make the report feel cleaner.
- Do not make broad PR class segmentation changes; class behavior remains covered by the active PR class initiative.

## Product And Design Alignment

Delivery Friction Analyzer is a local, evidence-preserving diagnostic tool. Maintainers should quickly understand where to focus, but they also need enough traceability to trust or challenge the recommendation.

This initiative keeps the existing product posture:

- the report remains repository-level, workflow-focused, and non-personalized;
- observed data, inferred diagnosis, and suggested action stay distinct;
- caveats appear before users act on a finding;
- generated CSV and JSON artifacts remain the audit trail;
- any model-ready output is deterministic context for an optional user workflow, not an opaque decision engine.

## Proposed Solution

Revise the Markdown report's opening flow so the top of the report reads as an action-oriented diagnostic brief:

1. Executive summary.
2. Focus snapshot.
3. Recommendation categories.
4. Evidence reviewed and confidence.
5. Key findings, PR class context, shared signals, and sensitivity notes.
6. Prioritization explanation.
7. Ranked bottlenecks and detailed evidence.
8. Supporting source/surface/methodology/guardrail sections.

The exact section names can change during implementation, but the first page should answer:

- What did the analyzer find?
- Which recommendation categories are triggered?
- How much evidence was reviewed?
- Which caveats should affect confidence?
- Which detailed bottlenecks should I inspect first?

Treat "first page" as a practical ordering and compactness target rather than an exact viewport requirement. Golden fixtures should assert that the focus snapshot, category summary, reviewed evidence, and confidence caveats render before detailed bottlenecks; manual review should confirm the opening remains compact, shorter than the ranked bottleneck detail, and compactly scannable when caveats or categories are empty.

The executive summary should include compact human-facing text plus tables where useful. It should summarize the analyzed sample rather than merely list totals. Candidate content:

- PRs analyzed, changed lines, non-generated changed lines, files changed when available, review comments, review threads, failed checks, cancelled workflows, and post-review commits.
- Top bottleneck names with reader-facing labels.
- Triggered recommendation categories with counts.
- A short "focus first" list derived from the top ranked bottlenecks, outlier sensitivity, PR class dominance, and coverage caveats.
- Analysis filter status when PR classes were excluded.

Recommendation categories should appear near the top. Prefer a compact top summary by default, with the full category table remaining later as a supporting reference unless implementation shows that moving the full table near the top is cleaner. Readers should not need to pass the ranked bottleneck details before seeing the action themes.

The existing "How To Read This Report" trust orientation should remain near the top or be intentionally folded into the new evidence/confidence opening. The revised opening must still tell readers how to distinguish observed evidence, interpretation, recommendations, and caveats before they act on a finding.

Language should be reviewed for reader-facing clarity:

- Prefer "files changed" or "number of files" when explaining PR size.
- Keep internal IDs such as `changed-file-spread` in JSON, CSV, and traceability contexts where stable identifiers matter.
- In Markdown prose, use labels that explain the concept rather than echoing internal metric names.
- Keep internal terms such as `changed-file-spread` only in stable IDs, table fields, contract references, or metric-family explanations where the report immediately explains the reader-facing meaning.
- Preserve a clear report-contract mapping between reader-facing labels such as "files changed" and the internal `changedFileSpread` concept, because that metric can include file count, directory spread, and functional-surface spread.

The optional model-ready path should first be resolved as a decision and documentation exercise. The default bias is documentation-only unless a concrete gap in `friction-report.json` plus CSV exports is demonstrated. If a deterministic local artifact is justified later, it should be planned as a separate artifact-producing milestone rather than folded into the first decision milestone.

A possible later artifact is `report-context.json` or `report-brief.json`, derived from existing report JSON and CSV-equivalent evidence, containing:

- report identity and target repository metadata;
- sample and coverage summary;
- focus snapshot;
- recommendation categories;
- top bottleneck summaries with observed data, interpretation, recommendation, and caveats;
- guardrails that tell downstream prose generators not to rank individuals, invent missing evidence, or erase caveats;
- artifact sensitivity notes.

The implementation should first decide whether existing `friction-report.json` and CSVs already provide enough model input. If they do, this initiative should document the recommended prompt/context workflow instead of adding another artifact. If they do not, the artifact-producing work should proceed only after the architecture decision records the artifact name, default or opt-in behavior, command support, fixture behavior, CLI completion behavior, contract updates, and artifact-sensitivity wording.

## User / Maintainer Workflows

- A maintainer opens `friction-report.md` and immediately sees the focus areas, recommendation categories, reviewed evidence, and caveats before the detailed bottleneck list.
- A maintainer sees "number of files" or "files changed" in report prose instead of needing to decode internal metric phrasing.
- A maintainer compares the top action categories before deciding whether to inspect review churn, validation gaps, planning gaps, or milestone sizing details.
- A maintainer can optionally pass deterministic local context to a model to draft a narrative summary, while using the generated report and artifacts as the source of truth.
- A contributor can update golden fixtures and tests to lock the new first-glance report structure.

## Acceptance Criteria

- [ ] Markdown reports include a top-of-report focus snapshot or equivalent section that names focus areas, action categories, reviewed evidence, and confidence caveats.
- [ ] Recommendation category context appears before detailed ranked bottlenecks.
- [ ] The executive summary is tailored to findings and reviewed evidence, not only raw totals and top bottleneck IDs.
- [ ] The opening preserves or intentionally replaces the existing how-to-read trust orientation for observed evidence, interpretation, recommendations, and caveats.
- [ ] User-visible Markdown phrasing replaces unclear metric-internal wording such as unexplained "changed-file spread" with clearer reader-facing language where appropriate.
- [ ] Internal stable IDs remain unchanged in JSON and CSV contracts unless a separate contract decision is made.
- [ ] Coverage, outlier, shared-signal, PR-class, and analysis-filter caveats remain visible before detailed recommendations.
- [ ] Golden Markdown tests cover the revised top-level section order and key phrasing.
- [ ] Report contract documentation describes the revised Markdown opening flow.
- [ ] The model-ready report context question is first resolved as a documented decision about existing artifacts versus a new deterministic local artifact contract.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Moving categories upward duplicates information. | The report may become longer or repetitive. | Use a compact top summary and keep the full category table as a reference, or move the table entirely if tests and readability allow it. |
| Simplifying phrasing could hide metric meaning. | Maintainers may lose traceability from prose to metric contracts. | Keep IDs and metric labels in evidence tables or detail sections while using clearer prose in summaries. |
| A top "focus first" list can look like an opaque priority score. | Users may over-trust the first item. | Explain that focus is derived from ranked bottlenecks, coverage, outliers, and categories without inventing a composite score. |
| Model-ready output could undermine deterministic reporting. | Users may treat generated prose as authoritative even when it invents or omits caveats. | Keep any model path optional, local, deterministic, and guardrailed; preserve `friction-report.md` and `friction-report.json` as source-of-truth artifacts. |
| Adding a new artifact increases contract surface. | More tests and docs must be maintained. | First evaluate whether existing JSON and CSVs are sufficient; add a new artifact only if it removes real ambiguity for downstream prose generation. |
| Report opening flow may become too dense. | Readers could still struggle to scan it. | Keep the first screen compact, use short tables/lists, and push detailed evidence to existing sections. |

## Testing Strategy

- Golden Markdown tests for the revised section order and first-glance content.
- Unit tests for any helper that derives focus snapshot content from report data.
- Fixture tests proving recommendation categories render before detailed bottlenecks.
- Regression tests that user-facing Markdown no longer contains unclear phrasing where replacement is expected.
- Contract documentation tests or snapshot checks if a model-ready context artifact is added.
- Manual fixture inspection of `fixtures/github/mcp-writing/reports/friction-report.golden.md`.
- Manual live smoke test against a representative repository after implementation, including filtered PR-class output if the active PR class initiative has merged.
- Focused fixture or unit coverage for empty/no-caveat states, no triggered recommendation categories, unavailable coverage, and unavailable PR class context.

## Open Questions

- [ ] Should implementation keep the preferred default of a compact top recommendation category summary plus the full table later, or does moving the full table near the top prove cleaner?
- [x] What exact wording should replace "changed-file spread" in each Markdown prose context? Use "Change scope" with an explicit explanation that it sums core files touched, directories touched, and functional surfaces touched; it is not a line-count metric.
- [ ] Should implementation keep the preferred default of deriving the focus snapshot in Markdown only, or is a `friction-report.v1` field needed for downstream consumers?
- [ ] Should the top focus snapshot combine ranked bottlenecks with category counts, coverage caveats, and outlier/class dominance as proposed, or should it narrow to ranked bottlenecks only?
- [x] Are existing `friction-report.json` plus CSV exports sufficient as model input, or is a smaller model-ready `report-context.json` artifact needed? Existing `friction-report.json` plus curated CSV exports are sufficient for a guarded downstream narrative workflow; no smaller model-ready artifact is needed unless a concrete consumer later requires a single-file context or machine-readable prompt package.
- [ ] If a model-ready artifact is justified by M2, should the separate artifact-producing milestone generate it by full live analysis only, or also by `src/report/generate-report.js` for fixture and advanced workflows?

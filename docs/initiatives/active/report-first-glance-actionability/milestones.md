# Report First-Glance Actionability Milestones

## M1: Action-Oriented Report Opening

### Outcome

Make the top of `friction-report.md` immediately communicate what the reader should focus on, what evidence was reviewed, which recommendation categories were triggered, and which caveats affect confidence.

### Scope

- Add a top-of-report focus snapshot or equivalent compact section.
- Move or surface recommendation category context before detailed ranked bottlenecks.
- Rewrite the executive summary so it describes findings and reviewed evidence, not just raw totals.
- Preserve early visibility of coverage, outlier, shared-signal, PR-class, and analysis-filter caveats.
- Preserve or intentionally fold the existing "How To Read This Report" trust orientation into the revised opening so observed evidence, interpretation, recommendations, and caveats remain clear before readers act.
- Replace unclear user-visible Markdown phrasing such as unexplained "changed-file spread" with clearer reader-facing terms where the report is discussing files changed or number of files.
- Keep stable JSON and CSV identifiers unchanged unless a separate contract change is explicitly accepted.
- Update the report contract to describe the revised Markdown opening flow and preserve the mapping between reader-facing file-count wording and the internal `changedFileSpread` concept.
- Update golden report fixtures and focused tests.
- Treat "first screen" as a testable ordering and compactness goal: golden fixtures should prove the focus snapshot, category summary, evidence reviewed, and confidence caveats render before detailed bottlenecks, while manual review checks that the opening remains compact and shorter than the detailed ranked bottleneck section.

### Dependencies / Activation Gate

- PR Class Segmentation M3 must be merged into the base branch before M1 activation.
- If M1 is activated before that merge for an exceptional reason, the implementation packet must explicitly require rebasing or syncing against the PR class report contract, including filtered-analysis labels, PR class caveats, and class-dominance report behavior.
- Validation must include a golden or focused fixture check that filtered PR-class analysis keeps class/filter caveats visible before detailed bottlenecks.

### Pre-Implementation Decisions

- Default to deriving the focus snapshot in Markdown only. Add a `friction-report.v1` field only if implementation identifies a concrete downstream consumer that needs structured focus data outside Markdown.
- Default to a compact top recommendation-category summary with the full category table retained later as supporting reference. Move the full table near the top only if implementation proves that is clearer and not repetitive.
- Treat maintainer-facing prose labels separately from stable identifiers: prose should use reader-facing wording, while stable IDs, table fields, contract references, and immediately explained metric-family labels may keep internal names such as `changed-file-spread`.

### Scope Budget

- Primary behavior change: Markdown reports become easier to scan and prioritize in the first screen.
- Major subsystem boundaries touched: report renderer and report contract docs.
- Acceptance criteria count: 8.
- Estimated non-generated diff size: under 800 changed lines.
- Validation shape: focused report tests plus golden Markdown fixture review.
- Split rationale: M1 intentionally exceeds the 5-criterion preference because the renderer change, report contract docs, golden fixture updates, PR-class ordering check, trust-orientation preservation, compactness review, and phrasing cleanup all describe one human-facing Markdown opening. Splitting wording/order/docs apart would leave fixtures or contracts describing a report opening that does not yet exist.

### Non-Goals

- Do not change metric formulas or ranking semantics.
- Do not add an LLM integration or model-ready artifact in this milestone.
- Do not remove detailed bottleneck evidence or methodology sections.
- Do not change PR class filtering behavior.
- Do not redesign CSV exports.

### Acceptance Criteria

- [ ] A reader can see focus areas, recommendation categories, evidence reviewed, and confidence caveats before the detailed bottleneck sections.
- [ ] Recommendation category context appears before `## Ranked Bottlenecks`.
- [ ] The executive summary includes findings-oriented content such as top bottleneck labels, triggered categories, reviewed sample/evidence counts, and caveats.
- [ ] The opening preserves or intentionally replaces the existing "How To Read This Report" guidance for observed evidence, interpretation, recommendations, and caveats.
- [ ] Markdown prose avoids unclear unexplained "changed-file spread" phrasing where clearer terms such as "files changed" or "number of files" are more appropriate; stable IDs, table fields, contract references, and immediately explained metric-family labels may retain internal names.
- [ ] Golden Markdown tests assert the stable top-level order before `## Ranked Bottlenecks`, including filtered PR-class caveats when class filtering is applied, plus focused coverage for no bottlenecks, no triggered categories, unavailable coverage, and unavailable PR class context.
- [ ] Manual fixture inspection confirms the opening remains compact, scannable, shorter than the detailed ranked bottleneck section, readable when there are no caveats, and limited to a compact category summary rather than repeating the full detailed category reference.
- [ ] Report contract docs reflect the new opening flow and map reader-facing file-count wording back to `changedFileSpread` when that internal concept is referenced.

### Required Validation

- `npm test`
- `node --test test/report.test.mjs`
- Manual: inspect generated `friction-report.md` and confirm the first screen answers what to focus on.

### Risks / Watchpoints

- The opening section should not invent a composite score or imply certainty beyond the evidence.
- Category summaries should not become repetitive with the full category reference table.
- Friendly wording should not disconnect report prose from stable metric IDs and CSV fields.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M2: Model-Ready Context Decision And Documentation

### Outcome

Resolve whether existing analyzer artifacts are sufficient input for users who want a separate model to draft a narrative report, and document the recommended guarded workflow without adding a new artifact.

### Scope

- Evaluate whether `friction-report.json` plus CSV exports already provide enough structured input for a downstream model-generated narrative.
- Document a recommended local workflow and guardrails in `docs/contracts/friction-report.md` and README guidance when existing artifacts are sufficient.
- If existing artifacts are not sufficient, record a committed architecture decision that justifies a later artifact-producing milestone and names the missing information.
- Define guardrails for downstream model use: do not rank individuals, do not invent missing data, preserve caveats, distinguish observed evidence from inference, and treat deterministic artifacts as authoritative.
- Preserve the current artifact set; do not add `report-context.json` or any equivalent artifact in this milestone.

### Pre-Implementation Decisions

- Decide whether existing `friction-report.json` plus CSV exports are sufficient for the documented downstream model workflow.
- If not sufficient, record the missing data and why existing artifacts cannot carry it without a new artifact contract.
- Decide whether the docs-only workflow is enough to close this initiative or whether M3 should be activated later.

### Scope Budget

- Primary behavior change: users have a documented, deterministic way to use existing analyzer output as optional model input, or a recorded decision explaining why a new artifact is needed later.
- Major subsystem boundaries touched: report contract docs and README guidance.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: docs review plus any repository documentation checks.
- Split rationale: this milestone is decision/documentation-only so artifact-surface work cannot expand the PR before a stable architecture decision exists.

### Lifecycle Note

- If M2 determines existing `friction-report.json` plus CSV exports are sufficient, the initiative can be completed after M2 and M3 should remain unactivated/deferred.
- If M2 records that existing artifacts are insufficient, M3 remains backlog work until separately activated with the accepted architecture decision.

### Non-Goals

- Do not call an external LLM from the analyzer.
- Do not make model-generated prose replace deterministic Markdown output.
- Do not add a new artifact, CLI flag, fixture output, or artifact write path in this milestone.
- Do not export raw comments, workflow logs, secrets, or individual rankings.
- Do not add arbitrary prompt templating or provider-specific integrations.

### Acceptance Criteria

- [ ] `docs/contracts/friction-report.md` records whether existing JSON/CSV artifacts are sufficient for downstream model use or whether a later artifact milestone is justified.
- [ ] README guidance names the source artifacts, expected local workflow, and source-of-truth guardrails clearly.
- [ ] If a later artifact is justified, `architecture.md` records the missing data and the required output-surface decisions before M3 activation.
- [ ] No new artifact, CLI flag, fixture output, or artifact write path is added in M2.
- [ ] The documented model-ready path preserves artifact sensitivity warnings and report guardrails.

### Required Validation

- `npm test`
- Manual: inspect the recommended workflow and verify it can support a narrative report without requiring raw CSV interpretation when existing artifacts are declared sufficient.

### Risks / Watchpoints

- This milestone should not turn into provider integration or artifact implementation work.
- A later new artifact should be justified only if it materially improves the optional downstream model workflow.
- Guardrails must travel with the context so downstream prose does not erase caveats.

### Status

- [x] Active
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M3: Optional Model-Ready Context Artifact

### Outcome

If M2 proves existing artifacts are insufficient, add a deterministic local model-ready context artifact with a stable contract and explicit command behavior.

### Scope

- Define the artifact name and contract, such as `report-context.json` or equivalent.
- Generate the artifact from existing report, metrics, and CSV-equivalent evidence without recomputing metrics differently.
- Include guardrails and artifact-sensitivity text in the artifact or adjacent documentation.
- Decide and implement whether the artifact is written by default, behind an opt-in flag, or only for specific commands.
- Decide and implement whether `src/report/generate-report.js` supports the artifact or remains JSON/Markdown-only.
- Update CLI completion output only if the artifact is part of default full-analysis output.
- Add deterministic tests for artifact shape, command behavior, fixture behavior, and excluded sensitive fields.

### Dependencies / Activation Gate

- M2 must first record an accepted architecture decision that existing `friction-report.json` plus CSV exports are insufficient.
- The implementation packet must name artifact filename, default or opt-in behavior, command support, fixture behavior, CLI completion behavior, contract updates, and artifact-sensitivity wording before code changes begin.

### Scope Budget

- Primary behavior change: users get a deterministic local context artifact for optional downstream model-generated narrative.
- Major subsystem boundaries touched: report artifacts and CLI artifact writing.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 800 changed lines; split if command behavior, fixture updates, and artifact generation cannot stay focused.
- Validation shape: focused artifact tests plus CLI/fixture behavior tests.
- Split rationale: artifact production is separate from M2 so the decision can be reviewed before the repository gains another output contract.

### Non-Goals

- Do not call an external LLM from the analyzer.
- Do not make model-generated prose replace deterministic Markdown output.
- Do not export raw comments, workflow logs, secrets, or individual rankings.
- Do not add arbitrary provider-specific prompt templating.

### Acceptance Criteria

- [ ] A model-ready context artifact, if implemented, is deterministic, local, tested, and documented in the report contract.
- [ ] The artifact includes or references guardrails that preserve observed/inferred/recommended separation, caveats, artifact sensitivity, and no-individual-ranking constraints.
- [ ] Command behavior is explicit and tested for default or opt-in output, fixture generation, and CLI completion listing when applicable.
- [ ] The artifact omits raw comments, workflow logs, tokens, secrets, and individual ranking outputs.
- [ ] Existing Markdown, JSON, methodology, and CSV artifacts remain authoritative and compatible.

### Required Validation

- `npm test`
- Focused tests for artifact shape, deterministic content, command behavior, and excluded sensitive fields.
- Manual: inspect the generated artifact and confirm it can support a narrative report without requiring raw CSV interpretation or erasing caveats.

### Risks / Watchpoints

- Artifact scope should not creep into provider integration.
- The new artifact should not duplicate `friction-report.json` unless it materially improves downstream model usability.
- Guardrails must travel with the context so downstream prose does not erase caveats.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

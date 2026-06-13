# Report Signal Trustworthiness Milestones

## M1: Review Decision Evidence

### Outcome

Make review approval state visible alongside review-thread churn so cleanly approved PRs with zero inline threads are not mistaken for unreviewed PRs.

### Scope

- Derive a conservative per-PR review decision summary from collected review events.
- Store the review decision summary in normalized PR evidence and carry it through metrics output.
- Include human approval and changes-requested signals without listing or ranking reviewer identities.
- Add metrics fields needed by report and CSV outputs.
- Add `pr-metrics.csv` columns for review decision and human reviewer count or documented equivalents.
- Annotate Markdown report evidence details when `review_threads = 0` and human approval is observed.
- Update docs/contracts where the artifact shape changes.

### Non-Goals

- Do not change review churn formula semantics unless a bug is discovered during implementation.
- Do not add PR class segmentation or release-PR filtering.
- Do not expose reviewer identity lists in reports or CSVs.
- Do not infer approval when review events are unavailable.

### Acceptance Criteria

- [ ] Metrics expose a stable review decision summary for each PR.
- [ ] Clean human approval with zero review threads is distinguishable from no observed review.
- [ ] Missing review-event coverage remains explicit rather than converted to `none`.
- [ ] `pr-metrics.csv` includes the new review decision evidence.
- [ ] Markdown evidence details explain zero-thread human-approved PRs.
- [ ] Contract docs and golden fixtures are updated.

### Required Validation

- `npm test`
- `node --test test/metrics.test.mjs`
- `node --test test/report.test.mjs`
- Manual: inspect generated Markdown and `pr-metrics.csv` for a sample containing zero-thread approved PRs.

### Scope Budget

- Acceptance criteria: 6
- Major subsystem boundaries: normalization/metrics and report/artifacts
- Estimated non-generated diff: under 800 changed lines
- Validation story: focused unit/golden tests plus one manual artifact inspection
- Split rationale: M1 intentionally crosses the evidence and artifact-rendering boundary because the misleading `review_threads = 0` user problem is only fixed when the normalized decision evidence is visible in the report and CSV. If implementation approaches the diff budget, split after normalized/metrics evidence and defer report/CSV rendering.

### Risks / Watchpoints

- Review data can be partial, so labels must remain conservative.
- Human reviewer counts should support interpretation without becoming person-focused.
- Existing users may rely on `review_threads`; keep the column and clarify meaning instead of replacing it.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M2: Planning Gap Regression Guard

### Outcome

Prove `planning_gap_score` can become non-zero on realistic input and guard against a silently dead metric.

### Scope

- Add a synthetic or fixture-backed metrics test with a changed file classified as `planning_docs`.
- Assert the planning gap component value and formula inputs.
- If the test exposes a real classification or formula issue, fix it within this milestone only when the fix is narrow.
- Document why the field-test zero result may simply mean the sampled repository did not trigger the metric.

### Non-Goals

- Do not retune the planning gap formula without a separate metric-design decision.
- Do not add NLP scope detection.
- Do not create new report sections for planning unless needed for the regression guard.

### Acceptance Criteria

- [ ] A test asserts `planningGapScore.value > 0` when planning-doc changed lines are present.
- [ ] The test validates the relevant formula inputs, including changed planning lines.
- [ ] Existing fixture tests remain deterministic.
- [ ] Any formula or classification bug found while adding the test is fixed and documented.

### Required Validation

- `npm test`
- `node --test test/metrics.test.mjs`

### Scope Budget

- Acceptance criteria: 4
- Major subsystem boundaries: metrics tests only unless a narrow bug appears
- Estimated non-generated diff: under 200 changed lines
- Validation story: focused unit test

### Risks / Watchpoints

- This milestone should not become metric redesign.
- The goal is to prove liveness, not to force planning findings in repositories where no planning files changed.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M3: Shared Signal Interpretation

### Outcome

Make it clear when multiple ranked bottlenecks are different recommendation framings of one underlying signal rather than independent findings.

### Scope

- Detect bottlenecks that share a ranking key or identical representative PR evidence.
- Add a top-level report callout near key findings or the ranked bottleneck list.
- Preserve per-bottleneck recommendation actions while making shared evidence visible.
- Update JSON report shape only if needed to keep Markdown deterministic and testable.
- Update golden report fixtures.

### Non-Goals

- Do not remove bottleneck categories from the JSON contract unless a separate breaking-change decision is made.
- Do not implement statistical correlation analysis as a required runtime feature.
- Do not collapse recommendations so aggressively that users lose useful intervention choices.

### Acceptance Criteria

- [ ] Reports identify shared ranking keys or shared representative PR evidence before detailed bottleneck sections.
- [ ] The callout distinguishes "same underlying signal" from "same recommended action."
- [ ] Existing per-section shared-evidence notes still render or are replaced by an equivalent clearer mechanism.
- [ ] Golden Markdown/JSON tests cover the shared-signal output.
- [ ] Report ordering remains deterministic.

### Required Validation

- `npm test`
- `node --test test/report.test.mjs`
- Manual: inspect a report where review-churn, repo-guidance-gap, or fix-amplification share representative PRs.

### Scope Budget

- Acceptance criteria: 5
- Major subsystem boundaries: report generation and report tests
- Estimated non-generated diff: under 500 changed lines
- Validation story: golden report assertion plus manual readability inspection

### Risks / Watchpoints

- A top-level callout should reduce confusion without burying the ranked list.
- Shared representative PRs are a deterministic proxy for relatedness; they are not a full statistical correlation model.

### Status

- [ ] Not started

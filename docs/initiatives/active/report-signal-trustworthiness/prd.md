# Report Signal Trustworthiness

## Status

Status: Active after M1 implementation.

- State: Active
- Owner: Hanna
- Created: 2026-06-12
- Activated: 2026-06-12
- Active milestone: M1: Review Decision Evidence
- Current milestone state: Implemented and reviewed for PR packaging; M2 remains not started.
- Related issues:
  - [#14: review_threads=0 reads as "unreviewed" but usually means "approved cleanly"](https://github.com/hannasdev/delivery-friction-analyzer/issues/14)
  - [#15: Three ranked bottlenecks are driven by one near-duplicate signal](https://github.com/hannasdev/delivery-friction-analyzer/issues/15)
  - [#17: planning_gap_score never fires; add a fixture asserting it can be non-zero](https://github.com/hannasdev/delivery-friction-analyzer/issues/17)
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Friction Metrics Contract](../../../contracts/friction-metrics.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [Normalized Entity Contract](../../../contracts/normalized-entities.md)

## Problem

Recent user feedback found that the analyzer can produce technically valid counts that are easy to misread or under-validate:

- `review_threads = 0` can look like "no review happened" even when the PR was human-approved with no inline churn.
- Several ranked bottleneck sections can share the same underlying review-volume signal, making one pattern look like several independent problems.
- `planning_gap_score` is currently zero in the observed 30-PR field test, and there is no fixture proving the metric can become non-zero on realistic input.

These are trust problems. The product promise is not just to count GitHub facts, but to help maintainers decide what to improve. If clean approvals look like missing review, or duplicated review-volume signals look like multiple independent findings, maintainers may act on the wrong conclusion.

## Goals

- Make clean human approval visible anywhere a reader sees zero review threads.
- Preserve review-thread counts as a churn signal while avoiding language that implies review coverage.
- Expose enough review decision evidence in metrics, reports, and CSVs to distinguish clean approval from missing review.
- Add regression coverage proving `planning_gap_score` can fire when repository-profile planning files change.
- Add report-level grouping or callouts for bottlenecks that share the same ranking source or representative PR evidence.
- Keep the report repository-focused and avoid individual reviewer or author ranking.

## Non-Goals

- Do not implement release/development PR segmentation here; that belongs to the PR class segmentation initiative.
- Do not change the core definition of review churn beyond clarifying its inputs and interpretation.
- Do not introduce NLP classification of review themes.
- Do not rank reviewers, authors, or individual contributors.
- Do not add a web UI or charting layer.
- Do not close field-test caveats by hiding zeroes; keep observed zeroes visible with better context.

## Product And Design Alignment

Delivery Friction Analyzer should help maintainers reason about workflow improvements without creating false alarm. This initiative keeps the existing evidence boundaries:

- observed GitHub review events remain separate from inline review-thread churn;
- configured file roles remain separate from metric interpretation;
- recommendations remain workflow-level rather than person-level;
- CSV exports remain curated evidence trails rather than raw comment dumps;
- report caveats and shared-signal notes appear before users over-generalize.

## Proposed Solution

Add an explicit review decision summary to normalized PR evidence and carry it through metrics output. Normalization is the durable ownership boundary because the decision is derived from collected GitHub `reviews[]` events; metrics and report layers should consume that normalized evidence rather than re-deriving it independently. The summary should at minimum expose:

- whether a human approval exists;
- whether a human requested changes exists;
- human reviewer count, counted as unique human reviewers with observed review events and without ranking or naming reviewers in report outputs;
- a coarse review decision label such as `approved`, `changes_requested`, `commented`, `review_required`, or `none`;
- enough source/coverage context to avoid treating missing review data as observed absence.

Bot reviews and comments should remain separate source evidence. They must not cause a PR to be labeled as human-approved or human-reviewed.

Update the metrics summary, Markdown report, and `pr-metrics.csv` so PRs with zero review threads can still show "human approved, no inline churn" when the data supports that interpretation. Keep the existing `review_threads` column and `review churn` language, but avoid implying that thread count measures review coverage.

Add a focused fixture or synthetic unit test where a `planning_docs` file changes and `planningGapScore.value` is non-zero. This should catch accidental deadening of the metric without requiring a formula change.

Add a report-level shared-signal summary that appears near the key findings or ranked bottleneck list. It should identify when multiple bottlenecks use the same ranking key or the same representative PR set. The existing per-section shared-evidence note is useful, but the top of the report should also make clear when several recommendations are different framings of one underlying signal.

## User / Maintainer Workflows

- A maintainer sees `review_threads = 0` and can tell whether the PR was human-approved cleanly or whether review evidence is unavailable.
- A maintainer opens `pr-metrics.csv` and can filter cleanly approved PRs without mistaking them for unreviewed PRs.
- A maintainer reads the executive findings and understands when several bottlenecks are multiple recommendation framings of the same review-volume signal.
- A contributor can update metrics tests and report golden fixtures with confidence that planning-gap and review-decision behavior is covered.

## Acceptance Criteria

- [ ] Metrics expose a per-PR review decision summary derived from review events.
- [ ] Metrics distinguish observed clean approval from unavailable review evidence and from no observed review.
- [ ] `pr-metrics.csv` includes review decision and human reviewer count or documented equivalent fields.
- [ ] Markdown report evidence details annotate zero review-thread PRs when human approval is observed.
- [ ] Report language consistently treats review threads as review churn, not review coverage.
- [ ] Reports include a top-level shared-signal callout when multiple bottlenecks share the same ranking key or representative PR evidence.
- [ ] `planning_gap_score` has a regression test proving it can be non-zero on realistic repository-profile input.
- [ ] Existing JSON, Markdown, CSV, and fixture outputs remain deterministic.
- [ ] No output ranks individual reviewers, authors, or contributors.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Review decision labels may overstate certainty when review data is partial. | Reports could replace one misleading signal with another. | Carry source/coverage context and use conservative labels when review events are unavailable. |
| Human reviewer counts can feel people-focused. | The report could drift toward surveillance. | Expose counts only as review-process evidence; do not list or rank reviewer identities in reports or CSVs. |
| Shared-signal grouping could hide useful recommendation categories. | Maintainers might miss that one signal can imply several interventions. | Group underlying evidence while preserving multiple recommendation tags or actions. |
| Adding review decision fields changes artifact contracts. | Golden fixtures and downstream readers need updates. | Treat fields as additive `v1` contract extensions unless a breaking change is required and documented. |

## Testing Strategy

- Unit tests for review decision derivation across approved, changes requested, commented-only, no reviews, bot-only, and unavailable cases.
- Metrics tests asserting review decision fields are stable and do not replace review churn counts.
- CSV tests for new review-decision columns, including observed zero review threads with human approval.
- Golden Markdown/JSON tests for zero-thread approval annotation and shared-signal callouts.
- Existing fixture normalization and report tests.
- Manual smoke test against a 30-PR `hannasdev/mcp-writing` run or equivalent field-test bundle.

## Resolved Decisions

- [x] Should the review decision label live in normalized data, metrics output, or both? Store it in normalized PR evidence and carry it through metrics output.
- [x] Should `human_reviewer_count` count unique human reviewers only, or unique human reviewers with terminal review states? Count unique human reviewers with observed review events; state-specific booleans capture approval and changes-requested facts separately.
- [x] Should bot approvals or comments ever influence the coarse review decision label, or should they remain separate source evidence? Keep bot evidence separate; it must not produce a human review decision.
- [x] Should shared-signal grouping collapse bottlenecks in JSON, or only add report-level interpretation while preserving the current bottleneck list? Add report-level interpretation first and preserve the current bottleneck list unless a later contract review chooses a breaking change.

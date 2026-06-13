# Report Signal Trustworthiness Architecture Notes

## Boundaries

This initiative touches three layers:

- normalized evidence, where review events become coarse review-decision facts;
- metrics output, where review-decision facts travel with per-PR friction evidence;
- report/artifact rendering, where Markdown and CSV outputs explain those facts without changing the meaning of review churn.

The initiative should not fetch new GitHub data unless existing review event collection is insufficient. The current source bundle already includes review events with author metadata and review state for fixture/live paths.

## Review Threads Versus Review Decision

`reviewThreads.totalCount` should continue to mean inline review discussion count. It is a churn signal, not a review coverage signal.

Add a separate review decision summary in normalized PR evidence rather than overloading `reviewThreads`. Metrics should carry this object through so report and CSV renderers do not re-derive decision state:

```json
{
  "reviewDecision": {
    "state": "approved",
    "humanApproved": true,
    "humanChangesRequested": false,
    "humanReviewerCount": 1,
    "source": "reviews"
  }
}
```

Exact field names may change during implementation, but the contract should preserve these ideas:

- the decision is derived once during normalization from review events, not inline threads;
- metrics preserve the normalized decision evidence;
- human and bot/scanner sources remain distinguishable;
- unavailable review events are not treated as observed absence;
- count fields are process evidence and must not become individual rankings.

## Conservative State Model

Prefer a small state vocabulary:

- `approved`: at least one human approval and no stronger terminal changes-requested signal in the chosen derivation rules;
- `changes_requested`: at least one human changes-requested review in the relevant review event set;
- `commented`: human review comments exist but no approval or changes-requested state is observed;
- `review_required`: GitHub or collected metadata explicitly indicates review is still required, if available;
- `none`: review events are observed and no human review is present;
- `unavailable`: review events are unavailable or incomplete enough that absence cannot be trusted.

## Review Event Coverage

The normalized `reviewDecision` must distinguish observed absence from missing evidence:

- Use `unavailable` when the source bundle or normalized PR cannot tell whether review events were collected for that PR. This includes missing `reviews` fields, a collection coverage flag indicating reviews were unavailable or partial, or adapter errors that make review-event absence untrustworthy.
- Use `none` only when review events are known to have been collected for the PR and the collected review-event list contains no human review events.
- Use `commented`, `approved`, or `changes_requested` only from observed human review events in the collected `reviews[]` list.
- Bot-only review events keep the state `none` for the human review decision while remaining available as separate bot/source evidence.
- When review events are collected but timestamps are missing or incomparable, compute the conservative booleans from observed states and document/test the precedence fallback instead of returning `unavailable`.

Precedence should be based on observed human review events, ordered by submission time when available:

- latest human `CHANGES_REQUESTED` after any later approval yields `changes_requested`;
- latest human `APPROVED` after earlier changes-requested reviews yields `approved`;
- human `COMMENTED` reviews without approval or changes-requested yields `commented`;
- bot-only review events do not affect the human decision label;
- missing or timestamp-incomparable review events fall back to conservative boolean inputs, with tests documenting the behavior.

## CSV And Markdown

`pr-metrics.csv` should keep `review_threads` and add decision context nearby. Candidate columns:

- `review_decision`
- `human_reviewer_count`
- `human_approved`
- `human_changes_requested`

Markdown bottleneck evidence should annotate zero-thread PRs only when the annotation adds meaning, for example: "Threads: 0; human-approved review observed." Avoid adding noisy approval text to every PR if the evidence table already has adequate columns.

## Shared Signal Reporting

The report already has bottleneck definitions that intentionally reuse ranking keys. Shared-signal detection can start with deterministic report-layer grouping:

- group by `rankingKey` from the bottleneck definition;
- group by representative PR evidence signature when available;
- render a concise top-level callout naming the affected bottlenecks.

This is interpretation support, not a new score. It should not change metric formulas.

## Contract Strategy

Prefer additive changes to `friction-metrics.v1` and `friction-report.v1` unless implementation discovers an incompatible contract problem. Update contract docs and golden fixtures in the same milestone as code changes.

## Failure Modes

- Review events are missing: report `unavailable` rather than `none`.
- Review events include only bot reviews: keep bot evidence separate and do not call it human approval.
- Conflicting review states: apply documented precedence and include enough tests to lock it down.
- Shared-signal grouping has no groups: omit the callout or render a clear "no shared displayed evidence" note only if the surrounding report already expects a row.

## Alternatives Considered

- Rename `review_threads` everywhere to `review_churn_threads`: clearer, but likely too disruptive as a first step. Use report language and adjacent fields first.
- Collapse duplicate bottleneck categories entirely: tempting, but it may hide distinct intervention choices. Start with shared-signal callouts.
- Retune planning-gap formula immediately: premature. First add liveness coverage, then redesign only with more evidence.

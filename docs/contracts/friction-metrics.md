# Friction Metrics Contract

Milestone 2 introduces `friction-metrics.v1`, a deterministic metrics summary computed from normalized fixture data. The metrics layer does not fetch GitHub data and does not generate the final human-facing report.

## Summary Shape

- `metricVersion`: formula version for every repository and PR summary.
- `targetRepository`: normalized target repository input.
- `analysisFilter`: optional metadata for explicit analysis filters, such as excluded PR classes and before/after PR counts.
- `totals`: repository-level counts for pull requests, changed lines, non-generated changed lines, review comments, review threads, failed checks, and cancelled workflow runs.
- `rankings`: PR rankings by review churn, changed-file spread, validation gap, planning gap, review surprise, and fix amplification.
- `pullRequests`: per-PR metrics with PR class evidence, diff, file spread, review comments, review-thread churn, review decision evidence, CI, lifecycle, iteration, coverage, and transparent component metrics.

## Component Metrics

Every score-like component exposes `formulaVersion`, `value`, and `inputs`.

- `commentSourceDensity`: comment counts and per-100-changed-line density by source.
- `functionalSurfaceDensity`: functional surface count and changed lines by surface.
- `iterationDrag`: commits after first review, review threads, and failed review attempts.
- `diffGrowthRatio`: PR-open to merge growth when PR-open diff data is direct or reconstructed; otherwise unavailable.
- `changedFileSpread`: core file count plus directory and functional-surface spread.
- `validationGapScore`: failed check runs, failed workflow runs, and cancelled workflow runs.
- `planningGapScore`: deterministic signal from repository-profile planning-doc changes.
- `reviewSurpriseScore`: deterministic functional-surface spread signal without title/body NLP.
- `fixAmplification`: commits after first review plus explicit diff-growth availability.

## Classification And Coverage

Observed GitHub data remains separate from inferred or configured classifications:

- file paths and changed lines come from normalized GitHub payloads;
- file categories, roles, functional surfaces, and generated flags come from repository profile or fallback rules;
- PR class, PR class source, and PR class rule ID come from repository profile rules or fallback rules;
- `files.classificationSources` counts the classification source used by each changed file;
- PR-open diff growth and workflow-run metrics carry coverage status when source data is unavailable;
- review decision evidence carries the normalized review-event source label so clean human approval can be distinguished from unavailable review evidence and from observed absence of human review.

Generated or low-signal roles are not hidden. They are counted separately, excluded from core file metrics, and down-weighted in `weightedChangedLines`.

When an explicit PR class filter is applied, metrics are computed from the filtered normalized PR set. Rankings, totals, and CSV evidence should describe that filtered sample, while `analysisFilter` records the excluded classes and the original collected count for auditability.

## Formula Constants

`friction-metrics.v1` exposes formula constants in code and in metric output where they affect file-spread calculations:

- Low-signal roles use `lowSignalRoleWeight: 0.25` in `weightedChangedLines`.
- Generated files and `generated_or_vendored` files contribute `0` to `weightedChangedLines`.
- `smallDiffWideSpread` is true when non-generated core files have `coreChangedLines > 0`, `coreChangedLines <= 600`, and `coreFiles >= 3`.
- Core roles for spread calculations are `core_product_code` and `product_ui`.

Validation gap metrics treat GitHub check-run failures and workflow interruptions separately. Failure-like check conclusions include `failure`, `failed`, `timed_failure`, `startup_failure`, `action_required`, `timed_out`, `stale`, `error`, `cancelled`, and `canceled`. Workflow-run `cancelled` / `canceled` conclusions are counted as cancelled workflow runs rather than double-counted as failed workflow runs.

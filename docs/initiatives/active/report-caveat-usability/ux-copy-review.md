# Generated Report UX Copy Review

Audience/moment: a maintainer or evaluator opens `friction-report.md` after a first sample or live run and tries to decide what to inspect first, how much to trust the findings, and what caveats should change their next action.

Artifact reviewed: bundled synthetic sample `friction-report.md`, generated on 2026-06-29 with:

```sh
npm exec --yes . -- --source sample --out /private/tmp/dfa-prd-report-review
```

Source of intent: first-run black-box review, existing report contract, completed report actionability and signal-trustworthiness initiatives.

## Blocking

No single wording issue blocks use of the report. The report is honest about evidence limits, configured context, shared signals, and artifact sensitivity.

## Should Fix

- The top-level caveat summary gives counts but not decisions. `Confidence caveats | 2 coverage caveats, 6 outlier caveats, 8 PR class caveats. Read the evidence and caveat sections before generalizing.` tells readers that caveats exist, but not which caveat should affect which finding or where to look next. Replace the count-only summary with a compact decision-oriented confidence digest that names the dominant PR, dominant class, and coverage gaps.

- `## Key Findings` turns caveats into two long wall-of-text bullets. The outlier caveat repeats `inspect raw evidence before generalizing` six times; the PR class caveat repeats the same small-sample warning eight times. This makes the most trustworthy part of the report feel least readable. Aggregate by caveat driver instead: one row for PR #104 dominance, one row for feature-class dominance, and one row per coverage gap family.

- Top-level caveats include every positive-signal bottleneck, not just the focus areas. The report says to focus first on Change scope, Review churn, and Repo guidance gap, then immediately lists caveats for Validation gap, Local hook gap, Test infrastructure gap, Review surprise, and Fix amplification. Keep full caveat detail available, but make the opening distinguish focus-area caveats from supporting/non-focus caveats.

- Caveat sections are spread across `Focus Snapshot`, `Workflow Data Caveats`, `Evidence Quality And Coverage`, `Key Findings`, `Shared Signal Interpretation`, `Outlier And Sensitivity Analysis`, per-bottleneck `Confidence And Caveats`, `Methodology Summary`, and `Collection Coverage`. Each section has a legitimate purpose, but a reader cannot tell which one is the short answer. Add one canonical top-level confidence digest and let other sections serve as details or audit trails.

- The PR class caveat wording is technically accurate but overly repetitive. The repeated sentence `The feature class has 2 PRs in the analyzed sample, so treat this as a small-sample caveat.` should render once for the feature class and list affected bottlenecks and percentages together.

- The outlier/sensitivity story is split between a long `Key Findings` bullet and a useful table later. The table is much clearer. Promote that table shape, or a smaller version of it, to the top-level confidence digest and remove the long prose list from `Key Findings`.

- The coverage story is repeated in the CLI completion, workflow caveats, evidence coverage notes, key findings, methodology summary, and collection coverage. The top report should state the actionable impact once: `PR-open diff is unavailable for 1 of 4 PRs, so diff-growth signals are partial; workflow runs are unavailable for 1 of 4 PRs, so validation signals use observed runs only.`

- Per-bottleneck confidence sections are useful, but they repeat global class/outlier language verbatim. Keep per-bottleneck confidence local to that bottleneck and refer to the top digest for repeated sample-level context where possible.

## Consider

- `Strongest displayed signal: Change scope (spread score)` is compact, but `spread score` remains slightly internal. Consider `Change scope (file/surface spread score)` if it still fits.

- The detailed evidence tables contain very dense validation/review/source cells. That may be a later readability initiative; it is not necessary to fix the aggregated-caveat problem.

- The report uses several trust-oriented sections before `## Ranked Bottlenecks`. That ordering is good, but the opening should feel like a digest, not a compliance record.

## Suggested Copy

Before:

```md
| Confidence caveats | 2 coverage caveats, 6 outlier caveats, 8 PR class caveats. Read the evidence and caveat sections before generalizing. |
```

After:

```md
| Confidence digest | Partial PR-open diff and workflow-run coverage; PR #104 dominates 6 supporting signals; feature-class PRs drive most displayed signal across 8 bottlenecks from a 2-PR class sample. See Confidence Digest for details. |
```

Before:

```md
- PR class caveat: Change scope: PR class feature contributes 73% ... The feature class has 2 PRs ... Fix amplification: PR class feature contributes 80% ... The feature class has 2 PRs ...
```

After:

```md
### Confidence Digest

| Caveat driver | Affects | Why it matters | Next check |
| --- | --- | --- | --- |
| Partial coverage | PR-open diff 3/4, workflow runs 3/4 | Diff-growth and validation signals use available evidence only. | Check `methodology.md` and `collection-coverage.csv` before comparing trends. |
| Dominant PR | PR #104 dominates Review churn, Repo guidance gap, Validation gap, Local hook gap, Test infrastructure gap, Fix amplification | Some recommendations may describe one broad PR more than a repository-wide pattern. | Inspect PR #104 and the sensitivity table before changing process. |
| Dominant PR class | Feature class drives 73-100% of displayed signal across 8 bottlenecks; class sample size is 2 PRs | Feature work may be overrepresented in the findings. | Compare against the PR class table or rerun with class filters. |
```

## Checked / Looks Good

- The report clearly labels the sample as synthetic.
- Observed evidence, interpretation, recommendation, and caveats are introduced before ranked bottlenecks.
- Configured workflow context is correctly labeled as profile context, not observed GitHub evidence.
- PR class context correctly says it supports interpretation only and does not change rankings or exclude PRs.
- Outlier sensitivity is presented as robustness context, not as a replacement ranking.
- Per-bottleneck confidence sections preserve auditability; repeated global caveats can be shortened to reference links once the digest carries the sample-level detail.

## Historical Next Skill

This review was carried into `initiative-planning`; use the PRD and milestones as the current activation source of truth.

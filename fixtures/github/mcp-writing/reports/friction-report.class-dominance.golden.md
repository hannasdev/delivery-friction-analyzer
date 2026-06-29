# Repository Friction Report: example/target

Report version: friction-report.v1
Metric version: friction-metrics.v1
Pull requests analyzed: 3

## Executive Summary

| Metric | Value |
| --- | --- |
| Pull requests analyzed | 3 |
| Changed lines | 700 |
| Non-generated changed lines | 700 |
| Review comments | 0 |
| Review threads | 0 |
| Failed checks | 0 |
| Cancelled workflow runs | 0 |
| Top findings | Review churn, Repo guidance gap |
| Triggered recommendation categories | Repo-specific AI skills (1), PR readiness gates (1) |
| Analysis filter | none |

## Focus Snapshot

| Question | Answer |
| --- | --- |
| Focus first | Review churn, Repo guidance gap |
| Action categories | Repo-specific AI skills (1), PR readiness gates (1) |
| Evidence reviewed | 3 PRs, 700 changed lines, 700 non-generated changed lines, 0 review comments, 0 review threads, 0 failed checks, 0 cancelled workflow runs |
| Confidence caveats | Confidence Digest groups 3 digest rows by caveat group. Read it before acting on top findings. |

## Confidence Digest

Top-level routing for caveats that can change how you act on the findings; detailed audit trails remain in the sections below.

| Caveat driver | Affects | Why it matters | Next check |
| --- | --- | --- | --- |
| Partial coverage | PR-open diff 0/3 available (3 unavailable); workflow runs 0/3 available (3 unavailable); review threads 0/3 available (3 unavailable) | diff-growth, validation, and review-thread signals use available evidence only. | Check Evidence Quality And Coverage and \`methodology.md\`/\`collection-coverage.csv\` before comparing trends. |
| Dominant PR class | Focus areas: Review churn, Repo guidance gap | release class drives 90% of displayed score value; class sample size is 2 PRs. | Compare against PR Class Context or rerun with class filters before generalizing. |
| Shared evidence | Focus areas: Review churn, Repo guidance gap | 2 shared-signal groups means some recommendations interpret the same metric or representative PR evidence. | Read Shared Signal Interpretation before treating affected recommendations as independent findings. |

## Recommendation Category Snapshot

| Category | Triggered bottlenecks |
| --- | --- |
| Repo-specific AI skills | 1 |
| PR readiness gates | 1 |

## How To Read This Report

- Observed evidence is measured from source-bundle evidence and repository-profile classifications.
- Interpretation is the analyzer's explanation of what the observed evidence suggests.
- Recommendation is a workflow intervention to consider; the report does not modify repositories.
- Confidence and caveats call out outliers, missing coverage, and evidence-quality limits before you act.

## Evidence Quality And Coverage

| Evidence area | Observed coverage |
| --- | --- |
| PR-open diff | unavailable: 3 |
| Workflow runs | unavailable: 3 |
| Review thread sources | unavailable: 3 |

Coverage notes:

- PR-open diff growth is unavailable for PRs without an open-time snapshot or equivalent captured state; final/current PR metadata can still come from GitHub PR data, but open-time size is not reconstructed from merge-time data.
- Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.

## Key Findings

- Top bottlenecks: Review churn, Repo guidance gap.
- Strongest displayed signal: Review churn (iteration drag).
- Confidence digest: review the grouped caveat drivers below before generalizing from the top findings.

## PR Class Context

PR classes are repository-profile evidence for interpretation only; they do not change rankings or exclude PRs.

| Class | PRs | Changed lines | Share | Sources |
| --- | --- | --- | --- | --- |
| release | 2 | 600 | 67% | repository\_profile=2 |
| development | 1 | 100 | 33% | fallback\_rule=1 |

## Profile Suggestions

Optional profile improvements based on this report's existing evidence. These suggestions do not change scores, rankings, CSV exports, or JSON report fields.

| Profile area | Evidence | Suggested next step |
| --- | --- | --- |
| Workflow context | PR-open diff coverage unavailable for 3 PRs; workflow-run coverage unavailable for 3 PRs. | Configure repository-profile workflow context, such as primary merge method or branch strategy, so unavailable diff-growth or workflow-run evidence is interpreted with maintainer-confirmed context instead of guesses. |

## Shared Signal Interpretation

Shared-signal groups are report interpretation only; they do not change scores, ranking, or recommendation categories.

- Review churn, Repo guidance gap share the review churn ranking signal; treat them as related interpretations, not separate independent findings. Recommendation categories remain distinct: PR readiness gates, Repo-specific AI skills.
- Review churn, Repo guidance gap display the same representative PR evidence (#1, #2, #3); keep recommendation actions distinct while reading the shared evidence as one underlying signal. Recommendation categories remain distinct: PR readiness gates, Repo-specific AI skills.


## How Bottlenecks Are Prioritized

- Bottlenecks are ordered by their strongest displayed representative score, not by an opaque composite priority score.
- Each score comes from one metric family, such as review-loop drag, validation failures, change scope, planning signals, review surprise, or post-review commits.
- Bottlenecks with no positive raw representative score are shown as no-signal context instead of top findings or recommendation drivers.
- Change scope is the internal changed-file-spread signal: core files touched plus directories touched plus functional surfaces touched. It is not a line-count metric.
- PR size columns show final/current additions, deletions, changed files, and changed lines so readers can compare size against the detected friction signals.
- PR size columns are context for interpreting displayed examples; bottleneck ordering uses each metric family's representative score and stable tie-breaks, not the PR size columns.
- Coverage caveats and outlier dominance should be considered before treating the first bottleneck as the most important repository problem.

## Ranked Bottlenecks

### Review churn

Recommendation category: pr_readiness_gate

#### Review churn Observed Evidence (iteration drag)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#1](https://example.test/pull/1) | Release 2026.06.14 | 10 | release | unknown | unknown | unknown | 500 |
| [#2](https://example.test/pull/2) | Release follow-up | 8 | release | unknown | unknown | unknown | 100 |
| [#3](https://example.test/pull/3) | feature work | 2 | development | unknown | unknown | unknown | 100 |

| PR | Validation | Review | Source labels |
| --- | --- | --- | --- |
| [#1](https://example.test/pull/1) | \[unavailable\] workflow coverage: unavailable; \[unavailable\] validation outcome unavailable; conclusions: none | \[unavailable\] threads: 0, resolved: 0, outdated: 0; \[unavailable\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable; comments: \[unavailable\] comment sources unavailable | PR class: \[configured\] release (source=repository\_profile, rule=release-title); Review thread source: \[unavailable\] unavailable; Workflow source: \[unavailable\] unavailable |
| [#2](https://example.test/pull/2) | \[unavailable\] workflow coverage: unavailable; \[unavailable\] validation outcome unavailable; conclusions: none | \[unavailable\] threads: 0, resolved: 0, outdated: 0; \[unavailable\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable; comments: \[unavailable\] comment sources unavailable | PR class: \[configured\] release (source=repository\_profile, rule=release-title); Review thread source: \[unavailable\] unavailable; Workflow source: \[unavailable\] unavailable |
| [#3](https://example.test/pull/3) | \[unavailable\] workflow coverage: unavailable; \[unavailable\] validation outcome unavailable; conclusions: none | \[unavailable\] threads: 0, resolved: 0, outdated: 0; \[unavailable\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable; comments: \[unavailable\] comment sources unavailable | PR class: \[observed\] development (source=fallback\_rule); Review thread source: \[unavailable\] unavailable; Workflow source: \[unavailable\] unavailable |

#### Review churn Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Review loops are concentrated in a small set of PRs. |
| Suggested action | Add or tighten a PR readiness gate for changes that attract repeated review rounds. |

#### Review churn Confidence And Caveats

- Displayed examples are not dominated by one PR.
- See [Confidence Digest](#confidence-digest) and [PR Class Context](#pr-class-context) for repeated class-dominance context.
- See [Confidence Digest](#confidence-digest) and [Shared Signal Interpretation](#shared-signal-interpretation) for shared-evidence context.

### Repo guidance gap

Recommendation category: repo_specific_ai_skills

#### Repo guidance gap Observed Evidence (iteration drag)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#1](https://example.test/pull/1) | Release 2026.06.14 | 10 | release | unknown | unknown | unknown | 500 |
| [#2](https://example.test/pull/2) | Release follow-up | 8 | release | unknown | unknown | unknown | 100 |
| [#3](https://example.test/pull/3) | feature work | 2 | development | unknown | unknown | unknown | 100 |

| PR | Validation | Review | Source labels |
| --- | --- | --- | --- |
| [#1](https://example.test/pull/1) | \[unavailable\] workflow coverage: unavailable; \[unavailable\] validation outcome unavailable; conclusions: none | \[unavailable\] threads: 0, resolved: 0, outdated: 0; \[unavailable\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable; comments: \[unavailable\] comment sources unavailable | PR class: \[configured\] release (source=repository\_profile, rule=release-title); Review thread source: \[unavailable\] unavailable; Workflow source: \[unavailable\] unavailable |
| [#2](https://example.test/pull/2) | \[unavailable\] workflow coverage: unavailable; \[unavailable\] validation outcome unavailable; conclusions: none | \[unavailable\] threads: 0, resolved: 0, outdated: 0; \[unavailable\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable; comments: \[unavailable\] comment sources unavailable | PR class: \[configured\] release (source=repository\_profile, rule=release-title); Review thread source: \[unavailable\] unavailable; Workflow source: \[unavailable\] unavailable |
| [#3](https://example.test/pull/3) | \[unavailable\] workflow coverage: unavailable; \[unavailable\] validation outcome unavailable; conclusions: none | \[unavailable\] threads: 0, resolved: 0, outdated: 0; \[unavailable\] unavailable from unavailable; human reviewers: unavailable; approved: unavailable; changes requested: unavailable; comments: \[unavailable\] comment sources unavailable | PR class: \[observed\] development (source=fallback\_rule); Review thread source: \[unavailable\] unavailable; Workflow source: \[unavailable\] unavailable |

#### Repo guidance gap Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Repeated review loops suggest some repository expectations are not yet available at implementation time. |
| Suggested action | Add repo-specific AI skills or instructions for repeated review themes before opening the next PR. |

#### Repo guidance gap Confidence And Caveats

- Displayed examples are not dominated by one PR.
- See [Confidence Digest](#confidence-digest) and [PR Class Context](#pr-class-context) for repeated class-dominance context.
- See [Confidence Digest](#confidence-digest) and [Shared Signal Interpretation](#shared-signal-interpretation) for shared-evidence context.

## Recommendation Categories

| Category | Triggered bottlenecks | Meaning |
| --- | --- | --- |
| Hooks | 0 | Local hooks for repeated formatting, lint, typecheck, snapshot, or generated-output churn. |
| Preflight scripts | 0 | Local commands that catch CI or workflow failures before pushing. |
| Repo-specific AI skills | 1 | Repository guidance for repeated review themes around architecture, tests, docs, or unsafe APIs. |
| PR readiness gates | 1 | Review-before-review checks for scope, tests, descriptions, and evidence. |
| Smaller milestones | 0 | Smaller delivery slices for broad, unstable, or cross-surface changes. |
| Planning artifacts | 0 | Durable product or architecture notes when requirement or scope signals dominate. |
| Test infrastructure | 0 | Validation infrastructure when recurring failures or missing coverage create delivery loops. |

## Comment Sources

| Metric | Value |
| --- | --- |
| Total comments | 0 |
| Bot/scanner comments | 0 |
| Human reviewer comments | 0 |
| Author replies | 0 |
| Dominant source | none (0) |

By source:

None

## Core And Support Surfaces

| Metric | Value |
| --- | --- |
| Core changed lines | 0 |
| Low-signal changed lines | 0 |
| Low-signal files | 0 |
| Weighted changed lines | 0 |
| Small-diff wide-spread PRs | 0 |

Functional surfaces:

None

File roles:

None

## Methodology Summary

- Pull requests are selected upstream by the collection or fixture workflow; this renderer explains the resulting metrics summary.
- File roles and functional surfaces come from repository-profile classification, not from language names alone.
- Profile suggestions are optional interpretation improvements derived from existing report evidence; they do not change scores, rankings, CSV exports, or JSON report fields.
- Bottlenecks are ranked by their strongest representative observed signal, with stable category order only used to break ties.
- Zero-score or no-positive-score bottlenecks are retained in no-signal context and excluded from top findings and recommendation category counts.
- Recommendations are inferred from transparent component evidence and representative PR examples; they are not automated changes.
- Missing or partial source evidence remains visible in coverage tables rather than being inferred from unrelated fields.
- Sensitivity analysis, when present, excludes one dominant representative PR at a time to show robustness context without changing the baseline ranking.
- PR class context is interpretation support only; it does not filter PRs or change bottleneck ranking.
- Full live analysis runs also write a detailed companion methodology artifact: `methodology.md`.

## Guardrails And Follow-Up

| Guardrail | Value |
| --- | --- |
| Avoids individual ranking | true |
| Separates observed, inferred, and suggested fields | true |
| Uses composite score | false |

Follow-up:

- Inspect recommendations against real PR history before turning them into automated repository changes.
- Collect PR-open snapshots in a future GitHub App flow when diff-growth coverage matters.

Artifact sensitivity:

Generated artifacts may include repository names, PR URLs, titles, file paths, and comment metadata. Treat them as local/private unless intentionally shared.

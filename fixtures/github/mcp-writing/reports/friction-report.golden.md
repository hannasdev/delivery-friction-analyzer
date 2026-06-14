# Repository Friction Report: hannasdev/mcp-writing

Report version: friction-report.v1
Metric version: friction-metrics.v1
Pull requests analyzed: 3

## Executive Summary

| Metric | Value |
| --- | --- |
| Pull requests analyzed | 3 |
| Changed lines | 2454 |
| Non-generated changed lines | 2433 |
| Review comments | 30 |
| Review threads | 25 |
| Failed checks | 0 |
| Cancelled workflow runs | 1 |
| Top bottlenecks | review-churn, repo-guidance-gap, changed-file-spread |

## How To Read This Report

- Observed evidence is measured from GitHub data and repository-profile classifications.
- Interpretation is the analyzer's explanation of what the observed evidence suggests.
- Recommendation is a workflow intervention to consider; the report does not modify repositories.
- Confidence and caveats call out outliers, missing coverage, and evidence-quality limits before you act.

## Evidence Quality And Coverage

| Evidence area | Observed coverage |
| --- | --- |
| PR-open diff | unavailable: 3 |
| Workflow runs | unavailable: 2, observed: 1 |
| Review thread sources | graphql:repository.pullRequest.reviewThreads: 1, not\_sampled\_for\_broad\_file\_spread: 1, not\_sampled\_low\_friction: 1 |

Coverage notes:

- PR-open diff growth is unavailable for PRs without captured or reconstructed open-time snapshots; it is not inferred from merge-time data.
- Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.

## Key Findings

- Top bottlenecks: review-churn, repo-guidance-gap, changed-file-spread.
- Strongest displayed signal: Review churn (iteration drag).
- Outlier caveat: Review churn: PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing. Repo guidance gap: PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing. Review surprise: PR #221 contributes 56% of the displayed signal; inspect raw evidence before generalizing. Fix amplification: PR #239 contributes 83% of the displayed signal; inspect raw evidence before generalizing.
- PR class caveat: only one PR class appears in the analyzed sample, so class dominance comparison is not meaningful.
- Coverage caveat: PR-open diff growth is unavailable for PRs without captured or reconstructed open-time snapshots; it is not inferred from merge-time data. Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.

## PR Class Context

PR classes are repository-profile evidence for interpretation only; they do not change rankings or exclude PRs.

| Class | PRs | Changed lines | Share | Sources |
| --- | --- | --- | --- | --- |
| unknown | 3 | 2454 | 100% | fallback\_rule=3 |

## Shared Signal Interpretation

Shared-signal groups are report interpretation only; they do not change scores, ranking, or recommendation categories.

- Review churn, Repo guidance gap share the review churn ranking signal; treat them as related interpretations, not separate independent findings. Recommendation categories remain distinct: PR readiness gates, Repo-specific AI skills.
- Validation gap, Local hook gap, Test infrastructure gap share the validation gap ranking signal; treat them as related interpretations, not separate independent findings. Recommendation categories remain distinct: Preflight scripts, Hooks, Test infrastructure.
- Review churn, Repo guidance gap, Review surprise, Fix amplification display the same representative PR evidence (#221, #239); keep recommendation actions distinct while reading the shared evidence as one underlying signal. Recommendation categories remain distinct: PR readiness gates, Repo-specific AI skills, Smaller milestones.
- Changed-file spread, Planning gap display the same representative PR evidence (#221, #223, #239); keep recommendation actions distinct while reading the shared evidence as one underlying signal. Recommendation categories remain distinct: Smaller milestones, Planning artifacts.
- Validation gap, Local hook gap, Test infrastructure gap display the same representative PR evidence (#239); keep recommendation actions distinct while reading the shared evidence as one underlying signal. Recommendation categories remain distinct: Preflight scripts, Hooks, Test infrastructure.

## Outlier And Sensitivity Analysis

Sensitivity summaries are robustness context only. They do not remove PRs from the baseline report or replace the original ranking.

| Excluded PR | Title | Affected bottlenecks | Baseline top bottlenecks | Top bottlenecks without PR | Robustness interpretation |
| --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | Review surprise (56%) | review-churn, repo-guidance-gap, changed-file-spread | review-churn, repo-guidance-gap, changed-file-spread | Top bottleneck ordering is unchanged when this dominant PR is excluded; the baseline appears more robust to this outlier. |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | Review churn (63%), Repo guidance gap (63%), Fix amplification (83%) | review-churn, repo-guidance-gap, changed-file-spread | changed-file-spread, review-churn, repo-guidance-gap | Top bottleneck ordering changes when this dominant PR is excluded; treat the baseline as outlier-sensitive. |

## How Bottlenecks Are Prioritized

- Bottlenecks are ordered by their strongest displayed representative score, not by an opaque composite priority score.
- Each score comes from one metric family, such as review-loop drag, validation failures, changed-file spread, planning signals, review surprise, or post-review commits.
- PR size columns show final/current additions, deletions, changed files, and changed lines so readers can compare size against the detected friction signals.
- PR size is context for interpretation; it only affects ordering when the bottleneck metric itself is about changed-file spread.
- Coverage caveats and outlier dominance should be considered before treating the first bottleneck as the most important repository problem.

## Ranked Bottlenecks

### Review churn

Recommendation category: pr_readiness_gate

#### Review churn Observed Evidence (iteration drag)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 20 | unknown | 1168 | 77 | 13 | 1245 |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 12 | unknown | 1149 | 58 | 15 | 1207 |

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

Evidence details for PR #221:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_for\_broad\_file\_spread
- Threads: 10
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

#### Review churn Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Review loops are concentrated in a small set of PRs. |
| Suggested action | Add or tighten a PR readiness gate for changes that attract repeated review rounds. |

#### Review churn Confidence And Caveats

- PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Repo guidance gap, Review surprise, Fix amplification.

### Repo guidance gap

Recommendation category: repo_specific_ai_skills

#### Repo guidance gap Observed Evidence (iteration drag)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 20 | unknown | 1168 | 77 | 13 | 1245 |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 12 | unknown | 1149 | 58 | 15 | 1207 |

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

Evidence details for PR #221:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_for\_broad\_file\_spread
- Threads: 10
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

#### Repo guidance gap Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Repeated review loops suggest some repository expectations are not yet available at implementation time. |
| Suggested action | Add repo-specific AI skills or instructions for repeated review themes before opening the next PR. |

#### Repo guidance gap Confidence And Caveats

- PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Review churn, Review surprise, Fix amplification.

### Changed-file spread

Recommendation category: smaller_milestones

#### Changed-file spread Observed Evidence (spread score)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 17 | unknown | 1149 | 58 | 15 | 1207 |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 16 | unknown | 1168 | 77 | 13 | 1245 |
| [#223](https://github.com/hannasdev/mcp-writing/pull/223) | docs: accept architecture snapshot milestone | 2 | unknown | 1 | 1 | 1 | 2 |

Evidence details for PR #221:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_for\_broad\_file\_spread
- Threads: 10
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

Evidence details for PR #223:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_low\_friction
- Threads: 0
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

#### Changed-file spread Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Broad file and surface spread can hide review and validation risk. |
| Suggested action | Break broad changes into smaller milestones when core files, directories, or surfaces spread out. |

#### Changed-file spread Confidence And Caveats

- Displayed examples are not dominated by one PR.
- Shares the same representative PR evidence as Planning gap.

### Review surprise

Recommendation category: pr_readiness_gate

#### Review surprise Observed Evidence (surface surprise score)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 5 | unknown | 1149 | 58 | 15 | 1207 |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 4 | unknown | 1168 | 77 | 13 | 1245 |

Evidence details for PR #221:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_for\_broad\_file\_spread
- Threads: 10
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

#### Review surprise Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Changes spanning several functional surfaces are more likely to surprise reviewers. |
| Suggested action | Call out multi-surface scope in the PR description or split cross-surface work. |

#### Review surprise Confidence And Caveats

- PR #221 contributes 56% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Review churn, Repo guidance gap, Fix amplification.

### Fix amplification

Recommendation category: smaller_milestones

#### Fix amplification Observed Evidence (post-review commits)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 5 | unknown | 1168 | 77 | 13 | 1245 |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 1 | unknown | 1149 | 58 | 15 | 1207 |

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

Evidence details for PR #221:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_for\_broad\_file\_spread
- Threads: 10
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

#### Fix amplification Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Post-review commits show where initial PR shape did not stay stable. |
| Suggested action | Use smaller delivery slices when review feedback causes meaningful post-review change. |

#### Fix amplification Confidence And Caveats

- PR #239 contributes 83% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Review churn, Repo guidance gap, Review surprise.

### Validation gap

Recommendation category: preflight_scripts

#### Validation gap Observed Evidence (validation gap score)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | unknown | 1168 | 77 | 13 | 1245 |

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

#### Validation gap Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Validation friction appears where checks, workflows, or cancellations add corrective loops. |
| Suggested action | Add local preflight scripts for recurring CI or workflow interruptions. |

#### Validation gap Confidence And Caveats

- Not enough positive examples to evaluate outlier dominance.
- Shares the same representative PR evidence as Local hook gap, Test infrastructure gap.

### Local hook gap

Recommendation category: hooks

#### Local hook gap Observed Evidence (validation gap score)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | unknown | 1168 | 77 | 13 | 1245 |

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

#### Local hook gap Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Validation signals point to checks that may be cheaper to catch before a branch reaches CI. |
| Suggested action | Add or improve local hooks for recurring formatting, lint, typecheck, snapshot, or generated-output churn. |

#### Local hook gap Confidence And Caveats

- Not enough positive examples to evaluate outlier dominance.
- Shares the same representative PR evidence as Validation gap, Test infrastructure gap.

### Test infrastructure gap

Recommendation category: test_infrastructure

#### Test infrastructure gap Observed Evidence (validation gap score)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | unknown | 1168 | 77 | 13 | 1245 |

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

#### Test infrastructure gap Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Validation friction may indicate a missing or inconvenient local safety net. |
| Suggested action | Invest in test infrastructure when recurring CI or workflow signals are a primary delivery loop. |

#### Test infrastructure gap Confidence And Caveats

- Not enough positive examples to evaluate outlier dominance.
- Shares the same representative PR evidence as Validation gap, Local hook gap.

### Planning gap

Recommendation category: planning_artifacts

#### Planning gap Observed Evidence (planning gap score)

| PR | Title | Score | Class | Additions | Deletions | Files changed | Changed lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 1 | unknown | 1149 | 58 | 15 | 1207 |
| [#223](https://github.com/hannasdev/mcp-writing/pull/223) | docs: accept architecture snapshot milestone | 1 | unknown | 1 | 1 | 1 | 2 |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | unknown | 1168 | 77 | 13 | 1245 |

Evidence details for PR #221:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_for\_broad\_file\_spread
- Threads: 10
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

Evidence details for PR #223:

Validation:

- Workflow coverage: unavailable
- Workflow conclusions: none
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 0

Review:

- Review thread source: not\_sampled\_low\_friction
- Threads: 0
- Resolved threads: 0
- Outdated threads: 0
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: none

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: unavailable

Evidence details for PR #239:

Validation:

- Workflow coverage: observed
- Workflow conclusions: success=8, cancelled=1
- Failed checks: 0
- Failed workflows: 0
- Cancelled workflows: 1

Review:

- Review thread source: graphql:repository.pullRequest.reviewThreads
- Threads: 15
- Resolved threads: 15
- Outdated threads: 10
- Review decision: none (source: reviews)
- Human reviewers: 0
- Human approved: no
- Human changes requested: no
- Comment sources: author\_reply=15, copilot=15

Source labels:

- PR class: unknown (source=fallback\_rule)
- Workflow source: rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request

#### Planning gap Interpretation And Recommendation

| Field | Value |
| --- | --- |
| Inferred diagnosis | Planning-related changes show up in the same PRs as delivery friction. |
| Suggested action | Improve planning artifacts when planning or scope files are part of high-friction changes. |

#### Planning gap Confidence And Caveats

- Displayed examples are not dominated by one PR.
- Shares the same representative PR evidence as Changed-file spread.

## Recommendation Categories

| Category | Triggered bottlenecks | Meaning |
| --- | --- | --- |
| Hooks | 1 | Local hooks for repeated formatting, lint, typecheck, snapshot, or generated-output churn. |
| Preflight scripts | 1 | Local commands that catch CI or workflow failures before pushing. |
| Repo-specific AI skills | 1 | Repository guidance for repeated review themes around architecture, tests, docs, or unsafe APIs. |
| PR readiness gates | 2 | Review-before-review checks for scope, tests, descriptions, and evidence. |
| Smaller milestones | 2 | Smaller delivery slices for broad, unstable, or cross-surface changes. |
| Planning artifacts | 1 | Durable product or architecture notes when requirement or scope signals dominate. |
| Test infrastructure | 1 | Validation infrastructure when recurring failures or missing coverage create delivery loops. |

## Comment Sources

| Metric | Value |
| --- | --- |
| Total comments | 30 |
| Bot/scanner comments | 15 |
| Human reviewer comments | 0 |
| Author replies | 15 |
| Dominant source | author\_reply (15) |

By source:

| Name | Value |
| --- | --- |
| author\_reply | 15 |
| copilot | 15 |
| code\_scanning | 0 |
| dependency\_bot | 0 |
| github\_actions\_bot | 0 |
| human\_reviewer | 0 |
| unknown | 0 |
| unknown\_bot | 0 |

## Core And Support Surfaces

| Metric | Value |
| --- | --- |
| Core changed lines | 1257 |
| Low-signal changed lines | 87 |
| Low-signal files | 8 |
| Weighted changed lines | 2383.5 |
| Small-diff wide-spread PRs | 1 |

Functional surfaces:

| Name | Value |
| --- | --- |
| runtime | 1257 |
| test\_suite | 953 |
| user\_docs | 123 |
| planning | 50 |
| product\_docs | 34 |
| agent\_tool\_reference | 21 |
| release\_notes | 16 |

File roles:

| Name | Value |
| --- | --- |
| core\_product\_code | 1257 |
| tests | 953 |
| unknown | 157 |
| planning\_docs | 50 |
| generated\_docs | 21 |
| release\_notes | 16 |

## Methodology Summary

- Pull requests are selected upstream by the collection or fixture workflow; this renderer explains the resulting metrics summary.
- File roles and functional surfaces come from repository-profile classification, not from language names alone.
- Bottlenecks are ranked by their strongest representative observed signal, with stable category order only used to break ties.
- Recommendations are inferred from transparent component evidence and representative PR examples; they are not automated changes.
- Missing or partial GitHub data remains visible in coverage tables rather than being inferred from unrelated fields.
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

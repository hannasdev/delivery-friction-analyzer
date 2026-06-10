# Repository Friction Report: hannasdev/mcp-writing

Report version: friction-report.v1
Metric version: friction-metrics.v1
Analysis window: 30 days

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
- PR-open diff growth is unavailable for some PRs and is not inferred from merge-time data.
- Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.

## Key Findings

- Top bottlenecks: review-churn, repo-guidance-gap, changed-file-spread.
- Strongest displayed signal: Review churn (iteration drag).
- Outlier caveat: Review churn: PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing. Repo guidance gap: PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing. Review surprise: PR #221 contributes 56% of the displayed signal; inspect raw evidence before generalizing. Fix amplification: PR #239 contributes 83% of the displayed signal; inspect raw evidence before generalizing.
- Coverage caveat: PR-open diff growth is unavailable for some PRs and is not inferred from merge-time data. Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.

## Ranked Bottlenecks

### Review churn

Recommendation category: pr_readiness_gate

#### Observed Evidence (iteration drag)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 20 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 12 | 1207 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 10; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_for\_broad\_file\_spread |

#### Interpretation

Review loops are concentrated in a small set of PRs.

#### Recommendation

Add or tighten a PR readiness gate for changes that attract repeated review rounds.

#### Confidence And Caveats

- PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Repo guidance gap, Fix amplification.

### Repo guidance gap

Recommendation category: repo_specific_ai_skills

#### Observed Evidence (iteration drag)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 20 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 12 | 1207 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 10; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_for\_broad\_file\_spread |

#### Interpretation

Repeated review loops suggest some repository expectations are not yet available at implementation time.

#### Recommendation

Add repo-specific AI skills or instructions for repeated review themes before opening the next PR.

#### Confidence And Caveats

- PR #239 contributes 63% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Review churn, Fix amplification.

### Changed-file spread

Recommendation category: smaller_milestones

#### Observed Evidence (spread score)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 17 | 1207 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 10; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_for\_broad\_file\_spread |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 16 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |
| [#223](https://github.com/hannasdev/mcp-writing/pull/223) | docs: accept architecture snapshot milestone | 2 | 2 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 0; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_low\_friction |

#### Interpretation

Broad file and surface spread can hide review and validation risk.

#### Recommendation

Break broad changes into smaller milestones when core files, directories, or surfaces spread out.

#### Confidence And Caveats

- Displayed examples are not dominated by one PR.

### Review surprise

Recommendation category: pr_readiness_gate

#### Observed Evidence (surface surprise score)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 5 | 1207 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 10; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_for\_broad\_file\_spread |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 4 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |

#### Interpretation

Changes spanning several functional surfaces are more likely to surprise reviewers.

#### Recommendation

Call out multi-surface scope in the PR description or split cross-surface work.

#### Confidence And Caveats

- PR #221 contributes 56% of the displayed signal; inspect raw evidence before generalizing.

### Fix amplification

Recommendation category: smaller_milestones

#### Observed Evidence (post-review commits)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 5 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 1 | 1207 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 10; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_for\_broad\_file\_spread |

#### Interpretation

Post-review commits show where initial PR shape did not stay stable.

#### Recommendation

Use smaller delivery slices when review feedback causes meaningful post-review change.

#### Confidence And Caveats

- PR #239 contributes 83% of the displayed signal; inspect raw evidence before generalizing.
- Shares the same representative PR evidence as Review churn, Repo guidance gap.

### Validation gap

Recommendation category: preflight_scripts

#### Observed Evidence (validation gap score)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |

#### Interpretation

Validation friction appears where checks, workflows, or cancellations add corrective loops.

#### Recommendation

Add local preflight scripts for recurring CI or workflow interruptions.

#### Confidence And Caveats

- Not enough positive examples to evaluate outlier dominance.
- Shares the same representative PR evidence as Local hook gap, Test infrastructure gap.

### Local hook gap

Recommendation category: hooks

#### Observed Evidence (validation gap score)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |

#### Interpretation

Validation signals point to checks that may be cheaper to catch before a branch reaches CI.

#### Recommendation

Add or improve local hooks for recurring formatting, lint, typecheck, snapshot, or generated-output churn.

#### Confidence And Caveats

- Not enough positive examples to evaluate outlier dominance.
- Shares the same representative PR evidence as Validation gap, Test infrastructure gap.

### Test infrastructure gap

Recommendation category: test_infrastructure

#### Observed Evidence (validation gap score)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |

#### Interpretation

Validation friction may indicate a missing or inconvenient local safety net.

#### Recommendation

Invest in test infrastructure when recurring CI or workflow signals are a primary delivery loop.

#### Confidence And Caveats

- Not enough positive examples to evaluate outlier dominance.
- Shares the same representative PR evidence as Validation gap, Local hook gap.

### Planning gap

Recommendation category: planning_artifacts

#### Observed Evidence (planning gap score)

| PR | Title | Score | Changed lines | Validation evidence | Review evidence | Source labels |
| --- | --- | --- | --- | --- | --- | --- |
| [#221](https://github.com/hannasdev/mcp-writing/pull/221) | feat(backup): apply project restores transactionally | 1 | 1207 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 10; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_for\_broad\_file\_spread |
| [#223](https://github.com/hannasdev/mcp-writing/pull/223) | docs: accept architecture snapshot milestone | 1 | 2 | coverage unavailable; conclusions none; failed checks 0; failed workflows 0; cancelled workflows 0 | threads 0; resolved 0; outdated 0; comments none | workflow unavailable; review not\_sampled\_low\_friction |
| [#239](https://github.com/hannasdev/mcp-writing/pull/239) | feat: resolve scene vocabulary variants | 1 | 1245 | coverage observed; conclusions success=8, cancelled=1; failed checks 0; failed workflows 0; cancelled workflows 1 | threads 15; resolved 15; outdated 10; comments author\_reply=15, copilot=15 | workflow rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&amp;event=pull\_request; review graphql:repository.pullRequest.reviewThreads |

#### Interpretation

Planning-related changes show up in the same PRs as delivery friction.

#### Recommendation

Improve planning artifacts when planning or scope files are part of high-friction changes.

#### Confidence And Caveats

- Displayed examples are not dominated by one PR.

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

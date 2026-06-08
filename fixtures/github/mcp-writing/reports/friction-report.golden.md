# Repository Friction Report: hannasdev/mcp-writing

Report version: friction-report.v1
Metric version: friction-metrics.v1
Analysis window: 30 days

## Summary

- Pull requests analyzed: 3
- Changed lines: 2454
- Non-generated changed lines: 2433
- Review comments: 30
- Review threads: 25
- Top bottlenecks: review-churn, repo-guidance-gap, changed-file-spread

## Ranked Bottlenecks

### Review churn

Observed data (iteration drag):
- PR #239: feat: resolve scene vocabulary variants (20; 1245 changed lines)
- PR #221: feat(backup): apply project restores transactionally (12; 1207 changed lines)

Inferred diagnosis: Review loops are concentrated in a small set of PRs.
Suggested action: Add or tighten a PR readiness gate for changes that attract repeated review rounds.

### Repo guidance gap

Observed data (iteration drag):
- PR #239: feat: resolve scene vocabulary variants (20; 1245 changed lines)
- PR #221: feat(backup): apply project restores transactionally (12; 1207 changed lines)

Inferred diagnosis: Repeated review loops suggest some repository expectations are not yet available at implementation time.
Suggested action: Add repo-specific AI skills or instructions for repeated review themes before opening the next PR.

### Changed-file spread

Observed data (spread score):
- PR #221: feat(backup): apply project restores transactionally (17; 1207 changed lines)
- PR #239: feat: resolve scene vocabulary variants (16; 1245 changed lines)
- PR #223: docs: accept architecture snapshot milestone (2; 2 changed lines)

Inferred diagnosis: Broad file and surface spread can hide review and validation risk.
Suggested action: Break broad changes into smaller milestones when core files, directories, or surfaces spread out.

### Review surprise

Observed data (surface surprise score):
- PR #221: feat(backup): apply project restores transactionally (5; 1207 changed lines)
- PR #239: feat: resolve scene vocabulary variants (4; 1245 changed lines)

Inferred diagnosis: Changes spanning several functional surfaces are more likely to surprise reviewers.
Suggested action: Call out multi-surface scope in the PR description or split cross-surface work.

### Fix amplification

Observed data (post-review commits):
- PR #239: feat: resolve scene vocabulary variants (5; 1245 changed lines)
- PR #221: feat(backup): apply project restores transactionally (1; 1207 changed lines)

Inferred diagnosis: Post-review commits show where initial PR shape did not stay stable.
Suggested action: Use smaller delivery slices when review feedback causes meaningful post-review change.

### Validation gap

Observed data (validation gap score):
- PR #239: feat: resolve scene vocabulary variants (1; 1245 changed lines)

Inferred diagnosis: Validation friction appears where checks, workflows, or cancellations add corrective loops.
Suggested action: Add local preflight scripts for recurring CI or workflow interruptions.

### Local hook gap

Observed data (validation gap score):
- PR #239: feat: resolve scene vocabulary variants (1; 1245 changed lines)

Inferred diagnosis: Validation signals point to checks that may be cheaper to catch before a branch reaches CI.
Suggested action: Add or improve local hooks for recurring formatting, lint, typecheck, snapshot, or generated-output churn.

### Test infrastructure gap

Observed data (validation gap score):
- PR #239: feat: resolve scene vocabulary variants (1; 1245 changed lines)

Inferred diagnosis: Validation friction may indicate a missing or inconvenient local safety net.
Suggested action: Invest in test infrastructure when recurring CI or workflow signals are a primary delivery loop.

### Planning gap

Observed data (planning gap score):
- PR #221: feat(backup): apply project restores transactionally (1; 1207 changed lines)
- PR #223: docs: accept architecture snapshot milestone (1; 2 changed lines)
- PR #239: feat: resolve scene vocabulary variants (1; 1245 changed lines)

Inferred diagnosis: Planning-related changes show up in the same PRs as delivery friction.
Suggested action: Improve planning artifacts when planning or scope files are part of high-friction changes.

## Recommendation Categories

- Hooks: 1 triggered bottleneck(s)
- Preflight scripts: 1 triggered bottleneck(s)
- Repo-specific AI skills: 1 triggered bottleneck(s)
- PR readiness gates: 2 triggered bottleneck(s)
- Smaller milestones: 2 triggered bottleneck(s)
- Planning artifacts: 1 triggered bottleneck(s)
- Test infrastructure: 1 triggered bottleneck(s)

## Comment Sources

- Total comments: 30
- Bot/scanner comments: 15
- Human reviewer comments: 0
- Author replies: 15

By source:
- author_reply: 15
- copilot: 15
- code_scanning: 0
- dependency_bot: 0
- github_actions_bot: 0
- human_reviewer: 0
- unknown: 0
- unknown_bot: 0

## Core And Support Surfaces

- Core changed lines: 1257
- Low-signal changed lines: 87
- Low-signal files: 8
- Weighted changed lines: 2383.5
- Small-diff wide-spread PRs: 1

Functional surfaces:
- runtime: 1257
- test_suite: 953
- user_docs: 123
- planning: 50
- product_docs: 34
- agent_tool_reference: 21
- release_notes: 16

File roles:
- core_product_code: 1257
- tests: 953
- unknown: 157
- planning_docs: 50
- generated_docs: 21
- release_notes: 16

## Coverage

PR-open diff:
- unavailable: 3

Workflow runs:
- unavailable: 2
- observed: 1

Review thread sources:
- graphql:repository.pullRequest.reviewThreads: 1
- not_sampled_for_broad_file_spread: 1
- not_sampled_low_friction: 1

Coverage notes:
- PR-open diff growth is unavailable for some PRs and is not inferred from merge-time data.
- Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.

## Guardrails

- Avoids individual ranking: true
- Separates observed, inferred, and suggested fields: true
- Uses composite score: false

## Follow-up

- Inspect recommendations against real PR history before turning them into automated repository changes.
- Collect PR-open snapshots in a future GitHub App flow when diff-growth coverage matters.

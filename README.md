# Delivery Friction Analyzer

Delivery Friction Analyzer is a product concept for measuring where AI-assisted software delivery still wastes time: review loops, CI churn, scope drift, missing validation, and repeated corrective work after a pull request opens.

The core idea is to use GitHub data as the first durable signal. Pull request diffs, review comments, Copilot review severities, check runs, commits, and merge timelines can reveal which teams, repositories, modules, and workflow stages create the most back-and-forth before work becomes mergeable.

## Product Direction

The first version should produce a repository-level friction report that answers:

- Where do PRs require the most corrective loops?
- Which feedback patterns repeat across PRs?
- Which issues are preventable with better local checks, repo-specific AI instructions, skills, hooks, or smaller delivery slices?
- Which changes create the largest gap between the PR opened state and the merged state?

The product should eventually combine GitHub delivery friction with token and model usage, but GitHub-only analytics are enough to validate the first product wedge.

## Planning Docs

- [PRD](docs/initiatives/backlog/delivery-friction-analyzer/prd.md)
- [Milestones](docs/initiatives/backlog/delivery-friction-analyzer/milestones.md)
- [Architecture Notes](docs/initiatives/backlog/delivery-friction-analyzer/architecture.md)


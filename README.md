# Delivery Friction Analyzer

Delivery Friction Analyzer is a product concept for measuring where AI-assisted software delivery still wastes time: review loops, CI churn, scope drift, missing validation, and repeated corrective work after a pull request opens.

The core idea is to use GitHub data as the first durable signal. Pull request diffs, review comments by source, check runs, commits, changed-file spread, file roles, and merge timelines can reveal which repositories, modules, and workflow stages create the most back-and-forth before work becomes mergeable.

## Product Direction

The MVP should be repo-source-agnostic and GitHub-connected. This repository is the builder repo for the analyzer; it is not expected to provide useful product analytics until it has meaningful PR history.

The first version should run locally from this project, fetch live GitHub data for a configured target repository, and produce a repository-level friction report. `hannasdev/mcp-writing` is the first validation target and fixture source, not product-specific scope.

The report should answer:

- Where do PRs require the most corrective loops?
- Which feedback patterns repeat across PRs?
- Which issues are preventable with better local checks, repo-specific AI instructions, skills, hooks, or smaller delivery slices?
- Which changes create the largest gap between the PR opened state and the merged state?
- Which changed files are part of the repository's configured product surface versus tests, docs, generated artifacts, release notes, marketing surfaces, or other support surfaces?

The product should eventually combine GitHub delivery friction with token and model usage, but GitHub-only analytics are enough to validate the first product wedge.

## Local GitHub Analysis

Run the live analyzer with local `gh` credentials:

```sh
npm run analyze:github -- \
  --repo hannasdev/mcp-writing \
  --limit 30 \
  --profile fixtures/github/mcp-writing/profile.json \
  --out reports/mcp-writing
```

The command writes:

- `source-bundle.json`
- `normalized.json`
- `metrics-summary.json`
- `friction-report.json`
- `friction-report.md`
- `methodology.md`
- `pr-metrics.csv`
- `bottleneck-examples.csv`
- `comment-sources.csv`
- `collection-coverage.csv`

Use `--dry-run` or `--metadata-only` to validate repository access, profile JSON, output directory writability, and sampled API coverage without writing full report artifacts. Use `--no-csv` when you want the Markdown, JSON, source, normalized, metrics, and methodology artifacts without spreadsheet-friendly CSV exports.

Successful runs print a concise completion message with `friction-report.md` first, followed by the key supporting artifacts and collection coverage status. Use `--json` when automation needs the full machine-readable completion receipt on stdout.

Read `friction-report.md` first, then inspect `methodology.md`, the CSV exports, `friction-report.json`, and `source-bundle.json` when a bottleneck looks surprising. Each ranked bottleneck example includes the workflow-run source, workflow-run conclusions, review-thread source, comment-source breakdown, and a dominance note when one PR contributes most of the displayed signal.

Ranked bottlenecks are ordered by their strongest displayed representative score, not by an opaque composite priority score. PR size columns show final/current additions, deletions, changed files, and changed lines so maintainers can compare size against review, validation, and planning signals.

Known MVP interpretation limits:

- PR-open diff growth is unavailable unless an open-time snapshot or reconstruction exists; the local historical collector does not infer it from merge-time diff data.
- Workflow runs are collected from branch-based pull-request Actions history, which can be unavailable or partial for deleted, renamed, reused, or inaccessible branches.
- Review-thread counts depend on GraphQL review-thread coverage; unavailable thread access is reported instead of silently treated as zero review churn.
- A single dependency, bot, or unusually broad feature PR can dominate validation or review findings. Treat dominance notes as a prompt to inspect the raw PR evidence before generalizing.

Generated artifacts may contain repository names, PR URLs, PR titles, file paths, comment metadata, curated CSV evidence, and coverage diagnostics. Treat source bundles, normalized data, metrics summaries, reports, methodology, and CSV exports as local/private unless you intentionally review and share them.

The existing metrics-summary-only report command remains available for fixture and advanced workflows:

```sh
npm run report:fixture
```

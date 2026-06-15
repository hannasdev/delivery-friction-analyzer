# Delivery Friction Analyzer

Delivery Friction Analyzer is a product concept for measuring where AI-assisted software delivery still wastes time: review loops, CI churn, scope drift, missing validation, and repeated corrective work after a pull request opens.

The core idea is to use GitHub data as the first durable signal. Pull request diffs, review comments by source, check runs, commits, change scope, file roles, and merge timelines can reveal which repositories, modules, and workflow stages create the most back-and-forth before work becomes mergeable.

## Product Direction

Delivery Friction Analyzer is currently a local, GitHub-connected analyzer that produces repository-level friction reports from live pull request data. It is repo-source-agnostic: repository-specific assumptions live in profiles, while generated artifacts preserve source evidence, coverage caveats, and interpretation limits.

`hannasdev/mcp-writing` remains the first validation target and fixture source, not product-specific scope.

The current product wedge is a maintainer workflow:

- collect the latest merged PR sample from a target repository;
- classify files and PRs through repository profiles;
- generate Markdown, JSON, methodology, and CSV artifacts;
- explain review, validation, scope, planning, PR-size, and PR-class friction with traceable evidence;
- support explicit follow-up filtering when maintainers want to inspect a configured PR population separately.

The report helps answer:

- Where do PRs require the most corrective loops?
- Which feedback patterns repeat across PRs?
- Which issues are preventable with better local checks, repo-specific AI instructions, skills, hooks, or smaller delivery slices?
- Which changes create the largest gap between the PR opened state and the merged state?
- Which changed files are part of the repository's configured product surface versus tests, docs, generated artifacts, release notes, marketing surfaces, or other support surfaces?

The product should eventually combine GitHub delivery friction with token and model usage, but GitHub-only analytics remain the active validation surface.

## Local GitHub Analysis

Run the live analyzer with local `gh` credentials:

```sh
npm run analyze:github -- \
  --repo hannasdev/mcp-writing \
  --limit 30 \
  --profile fixtures/github/mcp-writing/profile.json \
  --out reports/mcp-writing
```

After installing from npm, the same analyzer is available as a CLI:

```sh
npx delivery-friction-analyzer \
  --repo hannasdev/mcp-writing \
  --limit 30 \
  --profile path/to/repository-profile.json \
  --out reports/mcp-writing
```

The npm CLI still expects a local repository profile JSON. Use the sample profile from this repository as a starting point, then save a copy for the repository you want to analyze.

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

Use `--dry-run` or `--metadata-only` to validate repository access, profile JSON, output directory writability, and sampled API coverage without writing full report artifacts. Use `--no-csv` when you want the Markdown, JSON, source, normalized, metrics, and methodology artifacts without spreadsheet-friendly CSV exports. Use `--exclude-pr-class <class>` to explicitly remove a configured PR class from downstream normalized, metrics, report, methodology, and CSV artifacts; `source-bundle.json` still preserves the full collected sample for auditability.

Successful runs print a concise completion message with `friction-report.md` first, followed by the key supporting artifacts and collection coverage status. Use `--json` when automation needs the full machine-readable completion receipt on stdout.

Read `friction-report.md` first, then inspect `methodology.md`, the CSV exports, `friction-report.json`, and `source-bundle.json` when a bottleneck looks surprising. Each ranked bottleneck example includes the workflow-run source, workflow-run conclusions, review-thread source, comment-source breakdown, and a dominance note when one PR contributes most of the displayed signal.

Ranked bottlenecks are ordered by their strongest displayed representative score, not by an opaque composite priority score. PR size columns show final/current additions, deletions, changed files, and changed lines so maintainers can compare size against review, validation, and planning signals.

Known MVP interpretation limits:

- PR-open diff growth is unavailable unless an open-time snapshot or reconstruction exists; the local historical collector does not infer it from merge-time diff data.
- Workflow runs are collected from branch-based pull-request Actions history, which can be unavailable or partial for deleted, renamed, reused, or inaccessible branches.
- Review-thread counts depend on GraphQL review-thread coverage; unavailable thread access is reported instead of silently treated as zero review churn.
- A single PR or PR class, such as release, dependency, bot-driven, or unusually broad feature work, can dominate validation or review findings. Treat PR and class dominance notes as prompts to inspect the raw evidence before generalizing; use `--exclude-pr-class` only when you intentionally want a filtered follow-up view.

Generated artifacts may contain repository names, PR URLs, PR titles, file paths, comment metadata, curated CSV evidence, and coverage diagnostics. Treat source bundles, normalized data, metrics summaries, reports, methodology, and CSV exports as local/private unless you intentionally review and share them.

The existing metrics-summary-only report command remains available for fixture and advanced workflows:

```sh
npm run report:fixture
```

Maintainer release automation is documented in `docs/reference/release-automation.md`.

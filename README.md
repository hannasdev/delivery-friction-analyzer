# Delivery Friction Analyzer

Delivery Friction Analyzer is a local CLI for GitHub pull request analytics. It samples merged PRs from a repository and writes delivery-friction reports that show where work slowed down: review loops, CI churn, scope spread, validation gaps, planning signals, and repeated corrective work.

Use it when you want to answer questions like:

- Where do PRs require the most corrective loops?
- Which feedback patterns repeat across PRs?
- Which files, surfaces, or PR classes create the most back-and-forth?
- Which issues look preventable with better local checks, repo-specific AI instructions, skills, hooks, or smaller delivery slices?

The analyzer runs locally with your GitHub credentials. Generated artifacts preserve source evidence, coverage caveats, and interpretation limits so reports can be inspected before they are shared.

## Requirements

- Node.js 20 or newer.
- GitHub CLI (`gh`) installed and authenticated with access to the target repository.
- A repository profile JSON for the repository you want to analyze.

For public repositories, ordinary read access is usually enough. Private repositories need a `gh` token with enough read access for the requested API families. With a classic PAT, that usually means the `repo` scope. With a fine-grained token or GitHub App, grant read permissions for repository metadata and contents, pull requests, Actions, and checks where available. Missing or partial API coverage is recorded in the generated methodology and coverage artifacts instead of being treated as complete data.

## Quickstart

From this repository, install dependencies and run the analyzer against the sample validation target:

```sh
npm install
npm run analyze:github -- \
  --repo hannasdev/mcp-writing \
  --limit 30 \
  --profile fixtures/github/mcp-writing/profile.json \
  --out reports/mcp-writing
```

From another project or script, run the published CLI with `npx`:

```sh
npx delivery-friction-analyzer \
  --repo hannasdev/mcp-writing \
  --limit 30 \
  --profile path/to/repository-profile.json \
  --out reports/mcp-writing
```

Open `reports/mcp-writing/friction-report.md` first. It is the main human-readable report. Use the JSON and CSV files when you want to audit a finding, compare PRs, or build follow-up analysis.

For a guided first run in a local terminal, use the opt-in interactive flow:

```sh
npm run analyze:github -- --interactive
```

Interactive mode asks for the same run choices supported by flags, including repository, PR limit, profile path, output directory, dry-run mode, CSV exports, JSON completion output, and configured PR class exclusions. It can also create a missing repository profile path or write a generated profile copy with confirmed workflow context and release PR title rules. Scripted and CI usage should keep passing explicit flags; missing required flags without `--interactive` fail deterministically instead of waiting for input.

## Repository Profiles

Every run needs a repository profile. Profiles keep repository-specific assumptions out of the analyzer code by describing how paths and pull request titles should be classified.

Profiles can define:

- file categories such as code, tests, docs, generated files, infrastructure, or config;
- file roles such as core product code, release notes, fixtures, planning docs, or generated docs;
- functional surfaces such as runtime, test suite, release notes, or user docs;
- PR classes such as release, dependency, feature, or other repository-specific groups;
- workflow context such as merge method, release strategy, and branch strategy.

For a new repository, the easiest path is to let interactive setup create the profile file you plan to use:

```sh
npm run analyze:github -- \
  --interactive \
  --repo owner/name \
  --limit 30 \
  --profile profiles/owner-name.json \
  --out reports/owner-name \
  --dry-run
```

If `profiles/owner-name.json` does not exist, interactive setup asks whether to create it, then writes a minimal `repository-profile.v1` profile with confirmed workflow context and optional release PR title rules. `--dry-run` still validates repository access, profile JSON, output directory writability, and a small sample of GitHub API coverage, but it does not write the full report bundle. When interactive setup saves or generates a profile during a dry run, the completion output prints the saved profile path so you can inspect and edit it before a full run.

Use `fixtures/github/mcp-writing/profile.json` as a starting point when you prefer to copy an existing profile by hand. The full profile format is documented in `docs/reference/repository-profile.md`, and the schema lives at `schemas/repository-profile.schema.json`.

## Outputs

A successful run writes a report bundle to the output directory:

- `friction-report.md`: the main report to read first.
- `methodology.md`: data coverage, caveats, and interpretation notes.
- `friction-report.json`: machine-readable report data.
- `metrics-summary.json`: computed metrics used by the report.
- `normalized.json`: normalized repository, PR, file, review, and validation entities.
- `source-bundle.json`: collected source data for auditability.
- `pr-metrics.csv`: per-PR metrics for spreadsheet review.
- `bottleneck-examples.csv`: representative bottleneck examples.
- `comment-sources.csv`: review-comment source breakdowns.
- `collection-coverage.csv`: API coverage diagnostics.

Each ranked bottleneck example includes source references, workflow-run conclusions, review-thread source information, comment-source breakdowns, and a dominance note when one PR contributes most of the displayed signal.

## Common Options

Use `--dry-run` or `--metadata-only` to validate repository access, profile JSON, output directory writability, and sampled API coverage without writing full report artifacts.

Use `--no-csv` when you want the Markdown, JSON, source, normalized, metrics, and methodology artifacts without spreadsheet-friendly CSV exports.

Use `--exclude-pr-class <class>` to remove a configured PR class from downstream normalized, metrics, report, methodology, and CSV artifacts. `source-bundle.json` still preserves the full collected sample for auditability.

Use `--json` when automation needs the full machine-readable completion receipt on stdout.

Use `--interactive` only in a terminal when you want prompts. When combined with `--json`, prompts and progress stay off stdout so the final completion receipt remains parseable JSON.

## How To Read A Report

Start with `friction-report.md`. If a bottleneck looks surprising, inspect `methodology.md`, the CSV exports, `friction-report.json`, and `source-bundle.json`.

Ranked bottlenecks are ordered by their strongest displayed representative score, not by an opaque composite priority score. PR size columns show final or current additions, deletions, changed files, and changed lines so maintainers can compare size against review, validation, and planning signals.

Generated artifacts may contain repository names, PR URLs, PR titles, file paths, comment metadata, curated CSV evidence, and coverage diagnostics. Treat source bundles, normalized data, metrics summaries, reports, methodology, and CSV exports as local or private unless you intentionally review and share them.

## Interpretation Limits

Known MVP limits:

- PR-open diff growth is unavailable unless an open-time snapshot or reconstruction exists; the local historical collector does not infer it from merge-time diff data.
- Workflow runs are collected from branch-based pull-request Actions history, which can be unavailable or partial for deleted, renamed, reused, or inaccessible branches.
- Review-thread counts depend on GraphQL review-thread coverage; unavailable thread access is reported instead of silently treated as zero review churn.
- A single PR or PR class, such as release, dependency, bot-driven, or unusually broad feature work, can dominate validation or review findings. Treat PR and class dominance notes as prompts to inspect the raw evidence before generalizing.

More detail on GitHub API coverage is documented in `docs/reference/github-access-coverage.md`.

## Optional Narrative Drafting

The generated artifacts are enough context for an optional local workflow where a separate model drafts a narrative report. Use `friction-report.json` as the structured source of truth, `friction-report.md` as the human-readable source of truth, and the curated CSV exports only as supporting evidence when the draft needs per-PR detail.

When using a model this way, keep the deterministic artifacts authoritative: preserve coverage, outlier, PR-class, and analysis-filter caveats; distinguish observed evidence from inferred diagnosis and suggested action; do not invent missing data; and do not rank individuals. Review any generated prose against the Markdown, JSON, and CSV evidence before sharing it.

No separate model-ready context artifact is required for this workflow. Reconsider a new artifact only if a concrete consumer needs a smaller single-file context, machine-readable prompt packaging, or fields that cannot be represented clearly by `friction-report.json` plus curated CSV evidence.

## Current Direction

Delivery Friction Analyzer is currently a local, GitHub-connected analyzer that produces repository-level friction reports from live pull request data. It is repo-source-agnostic: repository-specific assumptions live in profiles.

The current product wedge is a maintainer workflow:

- collect the latest merged PR sample from a target repository;
- classify files and PRs through repository profiles;
- generate Markdown, JSON, methodology, and CSV artifacts;
- explain review, validation, scope, planning, PR-size, and PR-class friction with traceable evidence;
- support explicit follow-up filtering when maintainers want to inspect a configured PR population separately.

The product should eventually combine GitHub delivery friction with token and model usage, but GitHub-only analytics remain the active validation surface.

`hannasdev/mcp-writing` remains the first validation target and fixture source, not product-specific scope.

## Development Notes

The existing metrics-summary-only report command remains available for fixture and advanced workflows:

```sh
npm run report:fixture
```

Maintainer release automation is documented in `docs/reference/release-automation.md`.

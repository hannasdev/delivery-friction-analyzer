# Release Log

## Unreleased

### 2026-06-21 — Source Bundle Schema Contract

- What changed: Live GitHub `source-bundle.json` artifacts now have a documented analyzer-owned schema that covers the canonical fields used downstream, including coverage metadata and sanitized contributor-source context.
- Why it matters: Maintainers can tell when collector output drifts from the supported contract without treating the bundle as a complete raw GitHub API dump.
- Who is affected: Maintainers reviewing source bundles, contract tests, collector changes, or packaged schema/docs.
- Action needed: None.
- PR: TBD

### 2026-06-21 — Runtime Contract Preflight

- What changed: GitHub analysis now rejects this tool's product repository before collection and validates repository profiles more completely before provider calls, including file-rule shape, duplicate IDs, unsupported keys, invalid values, and malformed regexes.
- Why it matters: Maintainers get clearer failures before rate-limited GitHub work begins, so invalid targets or profiles are fixed at the input boundary instead of producing misleading reports.
- Who is affected: Maintainers running live GitHub analysis, dry runs, or preset-based runs, and contributors authoring repository profiles.
- Action needed: If a run now fails preflight, choose the repository you want to measure with `--repo owner/name` or fix the named profile field or rule before rerunning.
- PR: #55

### 2026-06-21 — Repo-Specific Review Guidance

- What changed: Added repo-local maintainer and agent guidance for recurring review themes, broad-change tripwires, and validation command selection, with self-profile coverage for the new guidance file.
- Why it matters: Maintainers and agents can catch known review-readiness issues before opening PRs without applying heavy process to tiny docs or test changes, and future self-analysis can classify the guidance surface.
- Who is affected: Maintainers and agents preparing changes in this repository.
- Action needed: Optional; review `AGENTS.md` before broad, report/contract, profile, docs, or release/package changes.
- PR: #52

### 2026-06-21 — Local Preflight Commands

- What changed: Added `npm run preflight` for ordinary PR checks and `npm run preflight:release` for focused release/package validation, with release automation docs describing when to use each command.
- Why it matters: Maintainers and agents can catch recurring test, whitespace, release-versioning, and package dry-run issues before opening review.
- Who is affected: Maintainers preparing ordinary PRs, release automation changes, package metadata changes, package contents changes, or publish workflow changes.
- Action needed: Optional; run `npm run preflight` before ordinary review and `npm run preflight:release` before release/package review.
- PR: #51

### 2026-06-21 — Maintainer Self-Profile Baseline

- What changed: Added a repository self-profile for delivery-friction-analyzer so local self-analysis can classify normal development paths, functional surfaces, workflow context, and Conventional Commit-style PR classes.
- Why it matters: Maintainers can review future self-analysis with fewer `unknown` classifications before changing process or opening follow-up workflow PRs.
- Who is affected: Maintainers running local analysis against this repository or reviewing profile validation.
- Action needed: Optional; rerun local self-analysis with `profiles/delivery-friction-analyzer.json` when validating maintainer workflow changes.
- PR: #50

### 2026-06-20 — Reusable Run Presets

- What changed: GitHub analysis can now load local run settings from `--preset` and save reusable settings with `--save-preset` or the interactive setup flow, with explicit CLI flags taking precedence.
- Why it matters: Maintainers can rerun an interactive setup non-interactively without moving repository semantics out of repository profiles.
- Who is affected: Maintainers using `--interactive` or repeated local analysis commands.
- Action needed: Optional; save a local preset for repeated runs and delete stale preset files when they no longer match the desired analysis settings.
- PR: #48

### 2026-06-20 — Contributor Source Configuration

- What changed: Repository profiles can now configure `.all-contributorsrc` as a structured contributor source, and analysis records contributor-source coverage while using sanitized hints only for aggregate comment-source classification.
- Why it matters: Maintainers can improve comment-source coverage without parsing Markdown contributor files, changing scores, or emitting raw contributor contents or person rankings in reports or CSVs.
- Who is affected: Maintainers authoring repository profiles or reviewing generated reports, methodology, and coverage artifacts.
- Action needed: Optional; add `contributors.sourceType: "all_contributors"` and a repository-relative `contributors.path` when a target repository has a trusted `.all-contributorsrc`.
- PR: #47

### 2026-06-20 — Workflow Data Caveats

- What changed: Markdown friction reports and methodology now explain PR-open diff and workflow-run coverage limits with configured workflow context when it is available, and suggest adding workflow context when omitted context would clarify unavailable evidence.
- Why it matters: Maintainers can distinguish final GitHub PR metadata from unreconstructable open-time PR size without mistaking merge strategy for observed evidence or a scoring input.
- Who is affected: Maintainers and contributors reviewing generated reports or authoring repository profiles with workflow context.
- Action needed: Optional; add repository-profile workflow context when unavailable coverage would be easier to interpret with maintainer-confirmed merge or branch assumptions.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/46

### 2026-06-20 — Profile Improvement Suggestions

- What changed: Markdown friction reports and methodology now suggest PR class or file/path profile improvements when fallback `unknown` evidence dominates the analyzed sample.
- Why it matters: Maintainers can see where repository profile rules would improve interpretation without treating the suggestions as score changes or required fixes.
- Who is affected: Maintainers and contributors reviewing generated reports or authoring repository profiles.
- Action needed: Optional; add or refine profile rules when the suggestions match repository conventions.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/45

### 2026-06-20 — Report Evidence Status Tables

- What changed: Markdown friction reports now show representative validation, review, and source-label evidence in compact tables with text status labels for observed, partial, unavailable, configured, warning, and healthy states.
- Why it matters: Maintainers can compare bottleneck evidence more quickly while still seeing when evidence is configured, incomplete, unavailable, or directly observed.
- Who is affected: Maintainers and contributors reviewing generated Markdown friction reports.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/44

### 2026-06-19 — Interactive Setup Choice Presets

- What changed: Interactive setup now shows workflow profile choices as labeled selections and can add an opt-in Conventional Commit PR class preset to generated or updated repository profiles.
- Why it matters: Maintainers can capture common repository assumptions without typing schema identifiers or hand-writing the first set of title-based PR class rules.
- Who is affected: Maintainers running `--interactive` to create or update repository profiles.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/40

### 2026-06-19 — Workflow Context Surfacing

- What changed: Friction reports and methodology now show configured repository workflow context from the profile when it is present.
- Why it matters: Maintainers can see merge, release, and branch assumptions beside report evidence without mistaking them for observed GitHub data or scoring inputs.
- Who is affected: Maintainers and contributors reviewing generated reports or authoring repository profiles with `workflow` context.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/37

### 2026-06-18 — Workflow Profile Wizard

- What changed: Interactive setup can now create repository profiles or generated profile copies with confirmed workflow context and release PR title rules.
- Why it matters: Maintainers can capture reusable workflow assumptions during guided setup without hand-editing profile JSON or risking silent rewrites of existing profiles.
- Who is affected: Maintainers running `--interactive` for first-time repository setup or profile updates.
- Action needed: Review the generated or updated profile path printed in completion output before reusing it in automation.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/36

### 2026-06-17 — Workflow Profile Contract

- What changed: Repository profiles can now declare optional workflow context for merge method, release strategy, and branch strategy using validated stable identifiers.
- Why it matters: Future interactive setup and report milestones can rely on a documented profile contract without inferring workflow assumptions from GitHub history or changing scoring.
- Who is affected: Maintainers authoring or validating repository profiles.
- Action needed: Add `workflow` context only when you want to record repository workflow assumptions; existing profiles remain valid without it.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/35

### 2026-06-17 — Opt-In Interactive CLI Setup

- What changed: GitHub analysis now supports `--interactive` to prompt for existing run options such as repository, PR limit, profile path, output directory, dry-run mode, CSV exports, JSON completion output, and configured PR class exclusions.
- Why it matters: First-time maintainers can complete a guided local analysis without memorizing every required flag, while scripts and CI keep deterministic flag-based behavior.
- Who is affected: Maintainers and contributors running local GitHub analysis from a terminal.
- Action needed: Use `--interactive` for guided local setup; keep explicit flags for automation.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/34

### 2026-06-15 — Review Decision Author Detection

- What changed: Review decision evidence now recognizes human approvals from live `gh pr view` review events that include only an author login.
- Why it matters: Maintainers can trust `review_decision`, `human_approved`, and `human_reviewer_count` for zero-thread PRs instead of seeing approved PRs reported as having no human review.
- Who is affected: Maintainers and contributors running or inspecting live GitHub analysis outputs.
- Action needed: Re-run affected reports to refresh the corrected review decision evidence.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/32

### 2026-06-15 — Optional Narrative Drafting Guidance

- What changed: The README and friction report contract now document how to use `friction-report.json` with curated CSV evidence as sufficient context for optional downstream narrative drafting, without adding a separate model-ready artifact.
- Why it matters: Maintainers can draft narrative summaries from existing analyzer outputs while keeping deterministic reports authoritative and avoiding extra artifact surface area.
- Who is affected: Maintainers and contributors using generated friction reports as input for narrative summaries.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/31

### 2026-06-15 — First-Glance Report Opening

- What changed: Friction reports now open with a focus snapshot, early recommendation-category summary, reviewed-evidence counts, and confidence caveats before detailed bottleneck evidence.
- Why it matters: Maintainers can see what deserves attention, why the report is confident or caveated, and which action themes apply without reading through the full ranked bottleneck details first.
- Who is affected: Maintainers and contributors reviewing generated friction reports.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/30

### 2026-06-14 — NPM Release Automation

- What changed: The package is prepared for public npm distribution with CLI metadata, a tight npm package allowlist, CI package dry-runs, automated conventional-commit versioning, GitHub release creation, and tag-triggered npm publishing.
- Why it matters: Maintainers can validate the release artifact on every PR and publish versioned CLI releases without manually editing package metadata or uploading ad hoc tarballs.
- Who is affected: Maintainers preparing releases and users installing the analyzer from npm.
- Action needed: Configure `RELEASE_DEPLOY_KEY` and npm trusted publishing before the first tag-triggered release.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/28

### 2026-06-14 — Explicit PR Class Filtering

- What changed: GitHub analysis now accepts `--exclude-pr-class` to recompute normalized data, metrics, reports, methodology, and CSV exports for an explicitly filtered PR class sample while preserving the full collected `source-bundle.json`.
- Why it matters: Maintainers can inspect development-oriented reports separately from release, dependency, or repository-specific PR populations without losing auditability of the collected sample.
- Who is affected: Maintainers and contributors running `npm run analyze:github`.
- Action needed: Use `--exclude-pr-class <class>` when a class should be excluded from downstream analysis artifacts.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/27

### 2026-06-14 — PR Class Report Context

- What changed: Markdown and JSON friction reports now include PR class distribution, PR class evidence in representative bottleneck examples, and caveats when displayed bottleneck examples are concentrated in one PR class.
- Why it matters: Maintainers can see when release, dependency, development, or repository-specific PR populations are shaping report interpretation without filtering the default analysis.
- Who is affected: Maintainers and contributors reviewing generated friction reports.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/26

### 2026-06-14 — PR Class Evidence

- What changed: Repository profiles can now classify pull requests by title rules, and normalized data, metrics summaries, and `pr-metrics.csv` carry PR class evidence.
- Why it matters: Maintainers can segment release, dependency, or repository-specific PR populations downstream without manually parsing PR titles.
- Who is affected: Maintainers and contributors running or inspecting delivery-friction analysis artifacts.
- Action needed: Add optional `prClasses` rules to repository profiles when PR populations should be labeled.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/25

### 2026-06-14 — PR Sample Contract Alignment

- What changed: Target repository metadata now records the latest-N pull request sample size, and Markdown reports label the analyzed pull request count instead of a day window.
- Why it matters: Maintainers can trust that report headers, fixtures, and schemas describe the actual analysis selection model.
- Who is affected: Maintainers and contributors reviewing generated reports, fixtures, or target repository metadata.
- Action needed: Update consumers that read `analysisWindowDays` to use `analysisPullRequestLimit`.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/23

### 2026-06-13 — Shared Signal Interpretation

- What changed: Markdown and JSON friction reports now call out when displayed bottlenecks share the same ranking signal or representative PR evidence while keeping their recommendation categories distinct.
- Why it matters: Maintainers can tell when several ranked findings are related interpretations of one underlying pattern instead of treating them as independent repository problems.
- Who is affected: Maintainers and contributors reviewing generated friction reports.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/20

### 2026-06-12 — Review Decision Evidence

- What changed: Friction metrics, Markdown reports, and `pr-metrics.csv` now include review decision evidence derived from review events, including human approval, changes-requested, reviewer count, and unavailable review-event coverage.
- Why it matters: Maintainers can distinguish zero inline review threads from missing review evidence or clean human approval, so `review_threads = 0` is less likely to be misread as "unreviewed."
- Who is affected: Maintainers and contributors reviewing delivery-friction reports or CSV evidence exports.
- Action needed: Treat `review_threads` as review churn and use the adjacent review-decision fields for review coverage context.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/18

### 2026-06-10 — Report Evidence Readability

- What changed: Markdown friction reports now show final/current PR additions, deletions, changed files, and changed lines in representative evidence tables, with validation and review details rendered as plain Markdown lists.
- Why it matters: Maintainers can compare PR size against review, validation, and planning friction without reading dense semicolon-packed table cells.
- Who is affected: Maintainers and contributors reviewing delivery-friction reports.
- Action needed: None.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/12

### 2026-06-10 — CLI Report Delivery Experience

- What changed: Successful GitHub analysis runs now print a concise human-readable completion message by default, with the Markdown report path first; pass `--json` to print the full machine-readable completion receipt on stdout. Live collection also retries transient `gh pr view` GraphQL authentication failures.
- Why it matters: Maintainers can jump straight to the main report, automation can keep parsing the existing receipt by opting into `--json`, and larger live samples are less likely to fail on brief GitHub CLI throttling/auth hiccups.
- Who is affected: Maintainers and scripts running `npm run analyze:github`.
- Action needed: Update scripts that parse default stdout JSON to pass `--json`.

### 2026-06-10 — Methodology And Evidence Exports

- What changed: Full GitHub analysis now writes a detailed `methodology.md` artifact and curated CSV evidence exports by default, with `--no-csv` available to suppress CSV files.
- Why it matters: Maintainers can understand the report methodology, inspect spreadsheet-friendly evidence, and see outlier sensitivity without reading nested JSON first.
- Who is affected: Maintainers and contributors running local GitHub analysis.
- Action needed: Use `--no-csv` for runs where spreadsheet-friendly artifacts should not be produced.
- PR: https://github.com/hannasdev/delivery-friction-analyzer/pull/10

### 2026-06-10 — Report Readability And Evidence Transparency

- What changed: Markdown friction reports now use a clearer reader path with executive summary, evidence-quality coverage, key findings, labeled bottleneck sections, scannable PR evidence tables, methodology summary, guardrails, and artifact-sensitivity guidance.
- Why it matters: Maintainers can distinguish observed data, analyzer interpretation, recommendations, and caveats more quickly before acting on report findings.
- Who is affected: Maintainers and contributors reviewing delivery-friction reports from fixture or live GitHub analysis.
- Action needed: None.
- PR: #9

### 2026-06-09 — Live Report Calibration

- What changed: Report bottleneck examples now show validation sources, workflow conclusions, review-thread sources, comment-source evidence, and outlier dominance notes, with a redacted 30-PR calibration sample protecting the output shape.
- Why it matters: Maintainers can trust and inspect live report recommendations more easily before turning them into process changes.
- Who is affected: Maintainers and contributors reviewing delivery-friction reports from live GitHub analysis.
- Action needed: None.
- PR: #7

### 2026-06-09 - Local GitHub Analysis Command

- What changed: Added a documented local command that runs live GitHub collection, normalization, metrics, and Markdown/JSON report generation in one workflow.
- Why it matters: Maintainers can now point the analyzer at a GitHub repository and generate the MVP report artifacts without preparing a metrics summary by hand.
- Who is affected: Maintainers and contributors running repository delivery-friction analysis locally.
- Action needed: Authenticate with `gh`, provide a repository profile, and choose a local output directory for generated artifacts.
- PR: #6

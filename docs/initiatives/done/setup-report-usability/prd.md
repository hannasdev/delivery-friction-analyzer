# Setup And Report Usability

## Status

Status: Completed; final milestone implemented for PR preparation on 2026-06-20.

- State: Done
- Owner: Hanna
- Created: 2026-06-19
- Completed: 2026-06-20
- Current milestone state: M1 merged in PR #39; M2 merged in PR #40; M3 merged in PR #44; M4 merged in PR #45; M5 implemented for final review.
- Related issue:
  - None yet.
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Repository Profile Format](../../../reference/repository-profile.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [PR Class Segmentation](../../done/pr-class-segmentation/prd.md)
  - [Interactive CLI Setup](../interactive-cli-setup/prd.md)
  - [Report First-Glance Actionability](../../done/report-first-glance-actionability/prd.md)

## Problem

Interactive setup and generated reports are becoming useful enough for real maintainer review, but recent hands-on use surfaced several comprehension and workflow gaps. The core opportunity is to make first-run setup and report interpretation self-correcting: the CLI captures repository assumptions, and the report tells users which profile gaps would improve interpretation.

- profile generation exists, but the docs do not clearly explain how a new user should create a profile or how profile-driven PR classes make `unknown` class values meaningful;
- interactive setup asks about closed workflow choices that should feel like selecting from a list, not typing schema identifiers;
- PR class setup still requires users to know that title conventions, including Conventional Commit-style PR titles, can be encoded as profile rules;
- reports show repeated evidence details that would be easier to compare as tables;
- reports could use compact status markers for observed, partial, unavailable, configured, healthy, or warning states, as long as text labels remain present;
- reports can show missing or weak profile evidence, but they do not yet connect that gap to concrete profile improvements the user can make;
- configured workflow context, especially squash merge or trunk-based flows, should explain which historical PR data can and cannot be reconstructed after merge.

These are usability improvements, not new scoring semantics. They should make setup and report interpretation more obvious while preserving the analyzer's evidence boundaries.

## Goals

- Make profile creation and PR class configuration understandable without reading source code or hand-writing regexes first.
- Let interactive setup generate useful title-based PR class rules from user-confirmed conventions such as Conventional Commit PR titles.
- Render closed-choice interactive prompts as clear numbered or selectable lists, while keeping free text only for genuinely open inputs such as release title substrings.
- Improve Markdown report scanability by rendering repeated evidence details as comparable tables where the fields are stable.
- Add text-backed status markers for coverage, caveats, configured context, healthy evidence, and warning states without implying individual PR blame.
- Add profile improvement suggestions when report evidence shows useful profile configuration is missing, such as all PR classes falling back to `unknown` or important file paths relying on fallback rules.
- Preserve maintainer-confirmed workflow assumptions, including merge strategy, so downstream analysis logic can make safe interpretation decisions without guessing from repository history.
- Explain workflow-specific data limits where they help interpretation, while making clear that merge strategy is not a score input and current final PR size comes from GitHub PR metadata.
- Keep repository-specific assumptions in the profile and keep scoring, ranking, CSV, and PR class filtering behavior stable unless explicitly changed by a separate initiative.

## Non-Goals

- Do not infer repository workflow or PR classes silently without user confirmation.
- Do not add branch-based PR class matching in this initiative unless a separate profile contract change is accepted.
- Do not change metric formulas, ranking semantics, recommendation categories, or filtering behavior.
- Do not add a hosted UI, web dashboard, or external model integration.
- Do not rank contributors, reviewers, authors, teams, or individual PRs as morally good or bad.
- Do not make Unicode icons the only source of meaning; every marker must have a text label.
- Do not parse arbitrary branch names or commit histories as reliable open-time PR snapshots.
- Do not present profile suggestions as required fixes; they are optional ways to improve interpretation.
- Do not imply merge strategy is used to compute final PR size in the current analyzer.

## Product And Design Alignment

Delivery Friction Analyzer is a local, evidence-preserving maintainer tool. The user should be able to configure repository assumptions once, understand which assumptions are configured versus observed, and read a report without decoding internal implementation terms.

This initiative keeps the existing product posture:

- repository-specific semantics live in repository profiles;
- interactive prompts help users express supported profile data without exposing schema syntax;
- reports distinguish observed GitHub evidence, configured profile context, inferred diagnosis, suggested action, and caveats;
- missing or unreconstructable data is explicit rather than invented;
- presentation improvements support interpretation without creating a hidden scorecard.

## Proposed Solution

Improve setup and reports in five connected but independently reviewable slices.

First, clarify documentation. The README and repository profile reference should explain:

- how to generate a missing profile through `--interactive`;
- why `prClass.class: "unknown"` is the fallback when no profile rule matches;
- how title-based `prClasses` work;
- examples for release PRs, dependency PRs, and Conventional Commit-style PR titles;
- why branch-based class matching is not currently supported unless a future profile matcher contract adds it.

Second, improve interactive setup. Closed enum prompts should render as numbered or selectable choices with display labels. They should store stable schema identifiers, but users should not need to type identifiers such as `squash_merge`. The prompt flow should not include "Other" for enum fields because unsupported values cannot be represented. It should offer supported choices such as `unknown` or `mixed` instead.

Interactive setup should also offer a user-confirmed PR title convention preset. If the user says PR titles usually follow Conventional Commits, setup can add title-based `prClasses` using validated regex rules. The first preset generates these classes in this order:

1. `dependency`: dependency-specific titles such as `deps:`, `chore(deps):`, `build(deps):`, or `fix(deps):`.
2. `feature`: `feat:` and scoped or breaking variants such as `feat(cli):` or `feat!:`.
3. `fix`: `fix:` and scoped or breaking variants, excluding dependency-scoped titles already caught by the dependency rule.
4. `docs`: `docs:` and scoped variants.
5. `test`: `test:` and scoped variants.
6. `maintenance`: `refactor:`, `perf:`, `style:`, `build:`, `ci:`, or `chore:` variants not already caught by the dependency rule.

This should be opt-in and profile-owned, not automatic inference. Release PR title configuration remains separate free text because release conventions are repository-specific and often do not map cleanly to Conventional Commit types.

Third, improve report evidence presentation. The first table target is the representative PR evidence inside ranked bottlenecks: keep the current PR-size table, and replace the repeated validation, review, and source-label detail lists with one compact evidence table per bottleneck when representative examples are present. Tables should stay narrow enough for Markdown readers. Dominance, sensitivity, unavailable-data caveats, and explanatory source notes should remain prose below the table instead of being squeezed into columns.

Fourth, add report status markers. Markdown reports and methodology should use text-backed status labels such as:

- observed;
- partial;
- unavailable;
- configured;
- warning;
- healthy.

Rendering may use visual markers when the output format supports them, but every marker must include text. Status markers are renderer-local Markdown labels unless a later contract explicitly adds structured status fields.

Fifth, connect profile and workflow gaps to concrete next steps. Profile suggestions are Markdown and methodology text derived from existing report data; they do not add `friction-report.v1` fields in this initiative. Deterministic trigger rules:

- PR class suggestion: render when the analyzed sample has at least 3 PRs and fallback `unknown` accounts for at least 80% of PRs, or when every analyzed PR uses fallback `unknown` PR class evidence. Because this milestone does not add profile-rule inventory to `friction-report.v1`, all-fallback-unknown is the report-layer proxy for no configured PR class rule producing usable classification evidence.
- File/path suggestion: render when at least 25% of non-generated changed lines have role `unknown` or functional surface `unknown`, using existing metrics/report surface evidence.
- Workflow-context suggestion: render when workflow context is omitted and the report also has unavailable PR-open diff coverage or workflow-run coverage caveats that configured workflow context could help explain.
- Suppression: render each suggestion category at most once per report. Omit class and path suggestions when the profile already has the relevant configured evidence and the fallback threshold is not met. Omit workflow-context suggestions when workflow context is configured or when the relevant coverage caveats are absent.

These suggestions should be framed as profile-quality improvements, not mandatory remediation. They should not affect scores by themselves.

Reports should also explain when configured workflow context affects data interpretation. For example, squash-merge repositories can still expose final PR metadata through GitHub PR APIs, but original branch commit topology is not preserved in `main`, and PR-open diff growth remains unavailable unless an open-time snapshot exists. Because current analysis reads final/current PR size from GitHub PR metadata rather than mining merge commits, merge strategy is not a score input today. It remains useful as maintainer-confirmed context that lets current and future downstream analysis logic choose safe interpretation paths instead of guessing from repository history.

## User / Maintainer Workflows

- A maintainer runs interactive setup for a repository without a profile and sees list-style workflow choices instead of typing raw schema identifiers.
- A maintainer who uses Conventional Commit PR titles can opt into generated title-based PR class rules during setup.
- A maintainer sees `unknown` class in a report and understands it means no profile PR class rule matched, not that analysis failed.
- A maintainer compares bottleneck evidence in a table instead of reading repeated prose lines.
- A maintainer sees status labels that make coverage and caveats easier to scan while preserving textual meaning.
- A maintainer sees a report note that `unknown` PR classes can be improved by adding profile title rules, with a pointer to the profile docs.
- A maintainer with squash-merge workflow context sees an explicit note that PR-open diff growth requires open-time snapshots and is not reconstructed from squash history.

## Acceptance Criteria

- [x] Documentation explains profile generation, `unknown` PR class fallback, and title-based PR class rules with copyable examples.
- [x] Interactive workflow enum prompts render as numbered or selectable choices and persist supported schema identifiers.
- [x] Interactive setup can generate opt-in Conventional Commit-style title-based PR class rules.
- [x] Reports render stable repeated evidence details as tables without losing caveats or source labels.
- [x] Reports use text-backed status markers for observed, partial, unavailable, configured, warning, and healthy states where they improve scanability.
- [x] Reports suggest concrete profile improvements when missing profile configuration limits interpretation.
- [x] Reports and methodology explain workflow-specific data limits only where relevant, without implying merge commits are currently used to compute PR size.
- [x] Existing JSON, CSV, metrics, ranking, and filtering contracts remain backward-compatible unless a later explicit contract change is accepted.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Conventional Commit presets overfit one naming style. | Users may get misleading class groupings. | Make presets opt-in, show generated rules, and keep custom profile editing documented. |
| "Other" answers for enum prompts create unsupported data. | Users may expect arbitrary values to work. | Do not offer "Other" for enum fields; offer `unknown`, `mixed`, or skip where supported. |
| Icons can look like moral judgment on PRs. | Reports could feel blame-oriented. | Pair every marker with neutral text and use markers for evidence status, not people or PR worth. |
| Tables can become too wide. | Markdown reports may get harder to read. | Use stable, high-value columns and move verbose caveats below the table. |
| Workflow caveats could sound like missing data is a bug. | Users may distrust valid reports. | Explain that unavailable PR-open growth is an honest coverage state unless open-time snapshots were captured. |
| Branch-based class inference is tempting. | It could broaden schema and collection assumptions prematurely. | Keep branch matching out of scope until a future profile matcher contract accepts it. |
| Profile suggestions could feel like required remediation. | Users may over-tune profiles before the report is useful. | Label suggestions as optional interpretation improvements and keep scores unchanged. |
| Merge strategy context may look unused today. | Users may question why setup asks for it. | Explain that it is maintainer-confirmed context for safe interpretation and future reconstruction paths, not a score input. |

## Testing Strategy

- Documentation review for README and repository profile examples.
- CLI prompt tests with injected adapters for select choices, no-`Other` enum behavior, and generated profile output.
- Profile/schema tests for generated Conventional Commit-style `prClasses`.
- Report golden tests for evidence detail tables, status label rendering, and workflow caveats.
- Report tests for profile suggestions when PR classes or file roles rely on fallback evidence.
- CLI artifact tests proving generated PR class presets do not change scoring, ranking, CSV export shape, or filtering unless explicit class filters are used.
- Manual interactive smoke test creating a profile for a repository with Conventional Commit-style PR titles.
- Manual report inspection for a squash-merge profile to confirm limitations are clear and not overstated.

## Open Questions

- [x] Which Conventional Commit types should the first preset generate? Generate `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance` in that order, with dependency-scoped titles matched before broad maintenance titles.
- [x] Should the generated PR class identifiers use `feature`/`fix`/`docs` labels or mirror Conventional Commit types exactly, such as `feat`? Use reader-facing classes: `feature`, `fix`, `docs`, `test`, `maintenance`, and `dependency`.
- [x] Should visual markers use Unicode symbols in Markdown, ASCII labels only, or a renderer helper that can switch based on output target? Use ASCII text labels only for M3, such as `[observed]`, `[partial]`, `[unavailable]`, `[configured]`, `[warning]`, and `[healthy]`.
- [ ] Future decision: Should workflow-limit caveats live in the main report opening, the methodology, the configured workflow section, or all three at different levels of detail?
- [ ] Future decision: Is there enough value in future branch-based PR class matching to plan a separate profile matcher initiative?
- [x] Should merge strategy remain an interactive profile question even though current metrics do not use it as a score input? Yes. Interactive setup should capture maintainer-confirmed workflow assumptions so downstream analysis logic can avoid unsafe inference and choose conservative interpretation or future reconstruction paths.

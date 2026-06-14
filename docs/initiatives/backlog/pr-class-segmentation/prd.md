# PR Class Segmentation

## Status

Status: Backlog.

- State: Backlog
- Owner: Hanna
- Created: 2026-06-12
- Related issue:
  - [#16: Release PRs are a different population and skew the ranking](https://github.com/hannasdev/delivery-friction-analyzer/issues/16)
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Repository Profile Format](../../../reference/repository-profile.md)
  - [Friction Metrics Contract](../../../contracts/friction-metrics.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)

## Problem

Field feedback found that release PRs can behave like a different population from ordinary development PRs. In the sampled repository, release PRs were larger, had almost no inline review threads, and had more CI failures. Blending release and development PRs into one ranking made dominance caveats fire repeatedly and muddied the maintainer's interpretation of what to fix.

The analyzer currently classifies changed files through a repository profile, but it does not classify PRs. Users can inspect PR titles manually, but generated metrics, CSVs, and reports do not expose a first-class `pr_class` field or a supported way to segment report findings.

## Goals

- Let repository profiles classify PRs into coarse classes such as `development`, `release`, `dependency`, or repository-specific labels.
- Emit PR class evidence in normalized data, metrics, and `pr-metrics.csv`.
- Preserve a default class for repositories without profile rules.
- Support downstream segmentation without requiring users to manually parse titles.
- Add report interpretation that warns when one PR class materially drives top findings.
- Consider a local CLI option to exclude one or more configured PR classes from report ranking after class evidence is stable.

## Non-Goals

- Do not hardcode `Release` title semantics globally.
- Do not infer rich workflow taxonomy from arbitrary PR text.
- Do not change file-role classification rules except to connect them with the profile contract if needed.
- Do not remove release PRs from default reports without explicit user choice.
- Do not make cross-repository benchmark claims by PR class.
- Do not implement hosted dashboards or interactive filtering.

## Product And Design Alignment

The product is repository-source-agnostic and profile-driven. PR class segmentation should follow the same model as file roles:

- repository-specific workflow assumptions live in profile data;
- default behavior remains conservative and transparent;
- reports preserve original evidence and explain when a class affects conclusions;
- filtering, if added, is explicit and local rather than automatic.

## Proposed Solution

Extend repository profiles with optional PR classification rules. M1 should start with title-only matching through `titleRegex` and `titleIncludes`, because PR titles are already available in fixture and live collection paths and are enough to cover the release-PR field case. Branch, label, and author-source matchers remain later extensions unless implementation discovers that title matching cannot support the validation target.

Each normalized PR should get a nested class summary:

- `prClass.class`: lower-kebab-case or lower-snake-case class identifier, such as `development`, `release`, `dependency`, or `unknown`;
- `prClass.classificationSource`: repository profile rule, fallback rule, or unavailable;
- `prClass.ruleId`: matching profile rule identifier when applicable.

Metrics and reports should carry this class through without changing existing formulas at first. `pr-metrics.csv` should include `pr_class` so users can segment downstream immediately. Reports should add class distribution context and warn when a top bottleneck or sensitivity summary is dominated by one PR class. A class is dominant when one class contributes more than 50% of the displayed bottleneck example score value; if score values are unavailable or not positive, fall back to displayed example count. Reports should caveat dominance for classes represented by fewer than 3 PRs in the analyzed sample.

After class evidence is present and tested, add an explicit CLI filtering path such as `--exclude-pr-class release` if the implementation remains reviewable. Filtering should recompute metrics/report outputs for the filtered set and clearly label the analysis as filtered.

## User / Maintainer Workflows

- A maintainer adds a profile rule that marks release PRs by title.
- A maintainer runs live analysis and sees `pr_class` in `pr-metrics.csv`.
- A maintainer reads the report and understands whether release PRs are dominating validation or review findings.
- A maintainer optionally runs a filtered analysis that excludes release PRs when they want a development-only view.

## Acceptance Criteria

- [ ] Repository profile schema supports optional PR classification rules.
- [ ] Normalized PRs carry a stable PR class and classification source.
- [ ] Metrics and CSV artifacts expose PR class without changing existing metric formulas.
- [ ] Reports include PR class distribution context.
- [ ] Reports warn when displayed bottlenecks are dominated by a single PR class.
- [ ] Optional filtering, if included, is explicit in CLI input and report output.
- [ ] Default behavior remains backwards-compatible for profiles without PR class rules.
- [ ] Tests cover profile validation, rule matching, normalization, metrics/artifacts, and report output.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| PR classes become too repository-specific. | The profile schema could become hard to use across repositories. | Keep the matcher small and transparent; support generic title/branch/label rules before custom code. |
| Filtering can hide important release friction. | Users may miss real delivery problems in release workflow. | Default to inclusion; label filtered reports clearly and keep unfiltered analysis available. |
| Class segmentation changes sample sizes. | Small classes may produce unstable conclusions. | Show class counts and avoid strong claims for tiny samples. |
| Schema changes broaden implementation scope. | Work may sprawl across profile validation, normalization, CLI, reports, and tests. | Split into class evidence first, report interpretation second, filtering last. |

## Testing Strategy

- Schema validation tests for profile PR class rules.
- Unit tests for PR class rule matching and fallback behavior.
- Normalization tests showing class, rule ID, and source fields.
- Metrics and CSV tests proving class fields are carried through without formula changes.
- Golden report tests for class distribution and class dominance notes.
- CLI tests if `--exclude-pr-class` or equivalent filtering is added.
- Manual smoke test against the repository that produced issue #16 using release-title rules.

## Resolved Decisions

- [x] Which PR metadata should the first rule matcher support: title, base branch, head branch, labels, author source, or all of these? M1 supports title matching only through `titleRegex` and `titleIncludes`; other matchers are later extensions.
- [x] Should PR class values be free-form strings or a small enum with optional custom labels? M1 supports validated free-form lower-kebab-case or lower-snake-case identifiers, with documented conventional values such as `development`, `release`, `dependency`, and `unknown`.
- [x] Should filtering happen during collection, normalization, metrics computation, or report generation? Prefer metrics-time filtering for M3 so filtered artifacts are internally consistent.
- [x] Is `--exclude-pr-class release` needed in the first implementation, or is a CSV/report class field enough for the first milestone? M1 is class evidence only; explicit filtering remains M3.

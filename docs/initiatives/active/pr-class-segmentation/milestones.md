# PR Class Segmentation Milestones

## M1: Profile-Driven PR Class Evidence

### Outcome

Add first-class PR class evidence to profiles, normalized PRs, metrics, and CSV artifacts without changing report ranking behavior.

### Scope

- Extend the repository profile schema with optional PR class rules.
- Implement deterministic PR class matching for PR titles using `titleRegex` and `titleIncludes`.
- Add class, source, and rule ID fields to normalized PRs.
- Carry PR class into metrics output.
- Add `pr_class` and source/rule columns to `pr-metrics.csv`.
- Update repository profile docs and contracts.
- Add fixture/profile coverage for at least one release PR rule.

### Non-Goals

- Do not filter PRs in this milestone.
- Do not change bottleneck ranking formulas.
- Do not add report class dominance interpretation yet except for minimal field display if needed by tests.
- Do not hardcode title text such as `Release` outside profile data or fixtures.
- Do not add branch, label, or author-source matchers in this milestone unless title-only matching proves insufficient for the validation target.

### Acceptance Criteria

- [ ] Profiles can define optional PR class rules and still validate when the field is omitted.
- [ ] Rule matching is deterministic and records the winning rule ID.
- [ ] PRs without matching rules receive a documented fallback class.
- [ ] Normalized and metrics outputs include PR class evidence.
- [ ] `pr-metrics.csv` includes PR class evidence.
- [ ] Tests cover matching, fallback, schema validation, and CSV output.
- [ ] Existing fixture outputs remain deterministic after golden updates.

### Required Validation

- `npm test`
- `node --test test/schema-validation.test.mjs`
- `node --test test/fixture-normalization.test.mjs`
- `node --test test/metrics.test.mjs`
- `node --test test/report.test.mjs`

### Scope Budget

- Acceptance criteria: 7
- Major subsystem boundaries: profile/normalization and metrics/artifacts
- Estimated non-generated diff: under 800 changed lines
- Validation story: schema, unit, fixture, and CSV tests
- Split rationale: M1 deliberately includes profile schema, normalization, metrics pass-through, and CSV exposure so the new class evidence is durable and immediately inspectable. If implementation approaches the diff budget, split after schema/normalization and defer metrics/CSV propagation.

### Risks / Watchpoints

- The matcher should stay small; M1 is title-only.
- Free-form class identifiers are allowed, but validation should restrict them to lower-kebab-case or lower-snake-case to keep downstream grouping sane.
- Profile validation should reject duplicate `prClasses[].id`, empty or missing `match`, and empty or invalid `class` values.
- A default class should be useful without pretending to know repository workflow.

### Status

- [x] Active

## M2: Report Class Context And Dominance

### Outcome

Make class distribution and class-driven dominance visible in the Markdown and JSON reports.

### Scope

- Summarize PR counts and changed lines by class.
- Add report context when top bottleneck examples are concentrated in one PR class.
- Treat a class as dominant when it contributes more than 50% of displayed bottleneck example score value, falling back to displayed example count when positive score values are unavailable.
- Add class fields to representative bottleneck evidence when useful.
- Update Markdown report sections and golden fixtures.
- Keep recommendations focused on workflow populations, not individuals.

### Non-Goals

- Do not exclude classes from rankings in this milestone.
- Do not create separate full reports per class.
- Do not make cross-repository claims about release PRs generally.

### Acceptance Criteria

- [ ] Reports show class distribution for the analyzed sample.
- [ ] Bottleneck evidence includes PR class where it helps interpretation.
- [ ] Reports warn when one PR class contributes more than 50% of displayed bottleneck example score value or, when needed, displayed example count.
- [ ] Class dominance language is caveated for small sample sizes.
- [ ] Golden report tests cover class distribution and dominance notes.

### Required Validation

- `npm test`
- `node --test test/report.test.mjs`
- Manual: inspect a report with release-class examples.

### Scope Budget

- Acceptance criteria: 5
- Major subsystem boundaries: report generation and tests
- Estimated non-generated diff: under 600 changed lines
- Validation story: golden report assertions plus manual readability inspection

### Risks / Watchpoints

- Class notes should reduce confusion without making the report too busy.
- Release class concentration may be real friction, not noise; language should not dismiss it.

### Status

- [ ] Not started

## M3: Explicit Class Filtering

### Outcome

Allow users to run an explicitly filtered analysis when they want to inspect development PRs separately from release or other configured PR classes.

### Scope

- Add a CLI option such as `--exclude-pr-class release` or an equivalent explicit filter.
- Apply filtering at the chosen layer and recompute metrics/report outputs for the filtered sample.
- Preserve `source-bundle.json` as the full collected sample by default, while labeling `normalized.json`, metrics, reports, methodology, and CSV outputs as filtered artifacts.
- Clearly label filtered reports, methodology, and CLI output with included/excluded classes.
- Keep unfiltered default behavior unchanged.
- Add tests for filtering and report labeling.

### Non-Goals

- Do not make filtering the default.
- Do not silently drop PRs based on class.
- Do not support arbitrary boolean query languages in the first version.
- Do not mutate collected source bundles to hide excluded PRs unless the architecture decision explicitly chooses collection-time filtering.

### Acceptance Criteria

- [ ] Users can explicitly exclude at least one configured PR class.
- [ ] Filtered outputs clearly state the excluded class or classes.
- [ ] Metrics and rankings are recomputed for the filtered PR set.
- [ ] Source and methodology artifacts preserve enough context to audit what was filtered, including the full collected source bundle and filtered downstream artifact labels.
- [ ] Default unfiltered analysis remains unchanged.
- [ ] CLI and report tests cover filtered and unfiltered behavior.

### Required Validation

- `npm test`
- `node --test test/analyze-github-cli.test.mjs`
- Manual: run one unfiltered and one filtered analysis for a profile with release PR rules and compare report labels.

### Scope Budget

- Acceptance criteria: 6
- Major subsystem boundaries: CLI/filtering and report/methodology
- Estimated non-generated diff: under 800 changed lines
- Validation story: CLI tests plus manual paired output inspection

### Risks / Watchpoints

- Filtering may be better as a later feature if class evidence and report context are enough.
- Filtering is metrics-time by default; report-time filtering should only re-enter planning if M3 proves too large and can still preserve artifact consistency.
- If the milestone gets too large, split after CLI/filter plumbing and defer expanded artifact labeling to a follow-up.
- Users need clear labels so filtered outputs are not mistaken for full-repository analysis.

### Status

- [ ] Not started

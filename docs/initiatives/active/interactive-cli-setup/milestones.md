# Interactive CLI Setup Milestones

## M1: Opt-In Interactive Run Flow

### Outcome

Users can run a guided analysis setup from the terminal for options the CLI already supports, while existing flag-based usage remains deterministic.

### Scope

- Add an explicit interactive entry point, such as `--interactive`.
- Prompt for target repository, latest merged PR limit, profile path, output directory, dry-run/metadata-only mode, CSV exports, and JSON output behavior when applicable.
- Prompt for PR class exclusions only after a selected profile declares configured PR classes.
- Keep equivalent prompt answers mapped to the existing `runAnalyzeGithub` option shape.
- Detect non-TTY contexts and fail with actionable validation errors instead of prompting.
- Keep `--json --interactive` stdout machine-readable by sending all prompt UI and progress text to stderr or another non-stdout channel.
- Update README usage guidance for interactive and non-interactive runs.
- Add focused tests with injectable prompt input/output, including a test that asserts `--json --interactive` stdout contains only the final JSON receipt.

### Non-Goals

- Do not add new profile schema fields in this milestone.
- Do not create or update profile files automatically.
- Do not add contributor-source parsing.
- Do not change report scoring, ranking, or artifact contracts.
- Do not remove or rename existing CLI flags.

### Acceptance Criteria

- [x] `delivery-friction-analyzer --interactive` can collect required existing run options and complete an analysis or dry run.
- [x] Missing required flags without `--interactive` still fail deterministically and do not wait for input.
- [x] Interactive CSV selection is equivalent to passing or omitting `--no-csv`.
- [x] Interactive PR class exclusion validates against classes configured in the selected profile.
- [x] `--json --interactive` keeps stdout reserved for the final JSON receipt and sends prompts/progress elsewhere.
- [x] Tests cover prompt option mapping, non-TTY behavior, missing-option behavior, JSON stdout cleanliness with prompt/progress injection, and existing parse behavior.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `npm test`
- Manual: run `npm run analyze:github -- --interactive` in a local terminal using a fixture-sized sample.
- Manual: run an interactive JSON-output smoke test and confirm stdout contains only the completion JSON.

### Scope Budget

- Primary behavior change: first-run users can answer prompts for existing analyzer options.
- Major subsystem boundaries touched: CLI argument/prompt adapter and README usage docs.
- Acceptance criteria count: 6.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: CLI tests plus manual TTY and JSON-output smoke tests.
- Split rationale: This intentionally exceeds the 5-criterion preference because JSON stdout cleanliness is inseparable from safe interactive CLI behavior. The implementation still touches only the CLI adapter and docs, with no analysis contract changes.

### Risks / Watchpoints

- Keep prompting isolated from `runAnalyzeGithub` so tests and programmatic callers stay simple.
- Avoid prompt UI on stdout when `--json` is active; machine-readable output must remain clean.
- The prompt adapter should be injectable so tests do not depend on a real terminal.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M2: Workflow Profile Contract

### Outcome

Repository workflow context has an additive, validated profile contract before interactive setup or reports rely on it.

### Scope

- Add additive `repository-profile.v1` fields for workflow context, without bumping the schema version unless implementation discovers an incompatible requirement and returns to planning.
- Define allowed values for primary merge method, release strategy, and branch strategy.
- Document that workflow fields are user-configured context, not observed GitHub evidence.
- Document that merge method and branch strategy do not change scoring formulas in this initiative.
- Add profile and schema validation tests for valid, omitted, and invalid workflow fields.

### Non-Goals

- Do not add interactive profile generation in this milestone.
- Do not surface workflow context in reports or methodology yet.
- Do not implement contributor-source fields.
- Do not add branch-based PR class matching.
- Do not change metrics, ranking, or collection behavior.

### Acceptance Criteria

- [x] Profile/schema validation accepts omitted workflow context and valid documented workflow fields.
- [x] Profile/schema validation rejects invalid merge-method, release-strategy, and branch-strategy values.
- [x] Repository profile docs describe workflow fields as configured context and state that they do not affect scoring.
- [x] Existing fixture profiles remain valid without workflow fields.

### Required Validation

- `node --test test/profile.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `npm test`

### Scope Budget

- Primary behavior change: repository workflow context becomes a validated profile contract.
- Major subsystem boundaries touched: profile schema/validation and repository profile docs.
- Acceptance criteria count: 4.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: schema/profile tests plus full suite.
- Split rationale: This isolates the contract decision from wizard writes and report wording so reviewers can validate the shape before behavior depends on it.

### Risks / Watchpoints

- Keep fields additive to `repository-profile.v1`; stop for planning if compatibility cannot hold.
- Use stable identifiers, not display labels, for profile values.
- Avoid implying that configured context was observed from GitHub history.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M3: Workflow Profile Wizard

### Outcome

Interactive setup can create or update validated repository workflow profile fields and supported release PR title rules.

### Scope

- Prompt for primary merge method: merge commit, squash merge, rebase merge, mixed, or unknown.
- Prompt whether releases are prepared through PRs and capture the user-visible release convention.
- Prompt for branch strategy at a coarse level, including default branch, release branches, long-lived development branches, mixed, or unknown.
- Generate or update profile workflow fields from confirmed answers.
- Generate or update profile PR class rules for currently supported release PR title conventions.
- Preserve existing profile formatting when the update can be applied deterministically; otherwise write a clearly named generated profile instead of rewriting the existing file.
- Print generated or updated profile paths in completion output.
- Document how generated profile fields relate to existing PR class filtering.

### Non-Goals

- Do not implement contributor-source parsing in this milestone.
- Do not change metric formulas based on merge method.
- Do not infer release strategy from GitHub history without user confirmation.
- Do not silently overwrite existing profile rules; show or require an explicit update path.
- Do not add branch-based PR class matching.
- Do not surface workflow context in reports or methodology yet beyond profile path/write confirmation.

### Acceptance Criteria

- [x] Interactive setup can write a new profile or update an existing profile with confirmed workflow fields.
- [x] Release PR title conventions can produce valid profile PR class rules using the current supported matcher shape.
- [x] Existing profile rules are preserved unless the user explicitly confirms an update.
- [x] Existing profile formatting is preserved when deterministic; otherwise a generated profile is written and named in completion output.
- [x] Generated or updated profile paths are printed in completion output.
- [x] Existing analysis behavior remains unchanged when workflow fields are omitted.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/profile.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `npm test`
- Manual: inspect a generated profile for a repository configured with release PRs and squash merges.

### Scope Budget

- Primary behavior change: setup captures durable repository workflow context and release class conventions.
- Major subsystem boundaries touched: interactive CLI profile generation and profile validation.
- Acceptance criteria count: 6.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: CLI generation tests plus schema/profile validation.
- Split rationale: This exceeds the 5-criterion preference only to make profile-write behavior explicit for reviewers. Report/methodology surfacing is separated into M4 so this milestone can focus on safe profile writes and current PR class matcher support.

### Risks / Watchpoints

- Existing profiles should not be rewritten in a surprising order or format.
- If profile formatting cannot be preserved confidently, prefer writing a generated profile and printing the path over rewriting user-owned formatting.
- Branch answers are easy to overpromise; label unsupported branch-based classification clearly until matchers exist.
- Completion output should name any profile written so users know which durable file now owns the assumptions.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M4: Workflow Context Surfacing

### Outcome

Generated methodology and report metadata can label configured workflow context without treating it as observed evidence or changing scoring.

### Scope

- Read validated workflow context from the repository profile.
- Add methodology/report metadata or prose that labels workflow context as user-configured.
- Preserve existing scoring, ranking, CSV, and PR class behavior.
- Add report/fixture tests for omitted workflow context and configured workflow context.
- Update docs to explain where workflow context appears and what it does not affect.

### Non-Goals

- Do not add new workflow profile fields in this milestone.
- Do not add profile generation prompts.
- Do not change metrics, ranking, or recommendations based on merge method, release strategy, or branch strategy.
- Do not add branch-based PR class matching.

### Acceptance Criteria

- [x] Methodology/report output can show configured workflow context when present.
- [x] Output clearly distinguishes configured workflow context from observed GitHub evidence.
- [x] Omitted workflow context produces no misleading empty or unknown-heavy report clutter.
- [x] Existing metrics, ranking, and PR class filtering remain unchanged.
- [x] Tests cover configured and omitted workflow context in generated artifacts.

### Required Validation

- `node --test test/report.test.mjs`
- `node --test test/analyze-github-cli.test.mjs`
- `npm test`
- Manual: inspect generated methodology/report text for configured workflow context.

### Scope Budget

- Primary behavior change: reports and methodology can explain configured workflow context.
- Major subsystem boundaries touched: report/methodology rendering and CLI artifact tests.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 650 changed lines.
- Validation shape: report and CLI artifact tests plus manual text inspection.
- Split rationale: Surfacing is reviewable after the profile contract and wizard writes exist; it no longer competes with schema and profile-generation changes.

### Risks / Watchpoints

- Report wording should avoid implying configured workflow context is observed evidence.
- Keep the top report concise; workflow context should not drown out friction findings.
- Do not introduce new scoring semantics by implication.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged in PR #37 on 2026-06-19

## M5: Contributor Source Configuration

Status: Implemented on 2026-06-20 for PR review.

### Outcome

Users can optionally configure `.all-contributorsrc` as a structured contributor source so analysis can improve contributor-aware comment-source classification and contributor-source coverage metadata while preserving repository-level, non-person-ranking guardrails.

### Scope

- Define additive profile fields for a contributor source with the only supported reusable source type `all_contributors` and path, defaulting to `.all-contributorsrc`.
- Record Markdown contributor files such as `CONTRIBUTORS.md` as unsupported/unparsed run feedback if the wizard encounters them; do not store them as supported contributor-source profile rules and do not parse Markdown in this milestone.
- Collect the configured `.all-contributorsrc` source from the target repository through GitHub access when available.
- Parse supported structured contributor data into hints for contributor-aware comment-source classification and contributor-source coverage metadata without emitting individual rankings.
- Keep contributor hints out of scoring formulas, PR authorship conclusions, reviewer attribution, and person-level report or CSV rows.
- Preserve unavailable, inaccessible, unsupported, malformed, and partial parsing states in coverage or methodology.
- Update report/methodology language and artifact sensitivity guidance for contributor-source metadata.
- Add tests for supported, missing, inaccessible, malformed, unsupported Markdown, and omitted contributor sources.

### Non-Goals

- Do not rank contributors, reviewers, authors, teams, or companies.
- Do not expose raw contributor file contents in reports or CSVs.
- Do not require a contributor file for analysis.
- Do not parse `CONTRIBUTORS.md` or other Markdown contributor files.
- Do not infer private identity data from names, emails, commit metadata, or external services.
- Do not add organization membership lookup unless separately planned.

### Acceptance Criteria

- [x] Profile/schema validation can name an optional `all_contributors` source path and rejects unsupported contributor-source profile types.
- [x] The collector records contributor-source coverage as available, unavailable, partial, malformed, or unsupported.
- [x] Contributor-aware comment-source classification and contributor-source coverage metadata can use configured `.all-contributorsrc` hints without changing individual-ranking guardrails.
- [x] Contributor hints do not alter scoring formulas, PR authorship conclusions, reviewer attribution, or person-level report/CSV output.
- [x] Reports and CSVs do not include raw contributor file contents or person rankings.
- [x] Tests cover structured source parsing, unsupported Markdown behavior, malformed content, inaccessible files, and omitted config.

### Required Validation

- `node --test test/profile.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/github-collector.test.mjs`
- `node --test test/report.test.mjs`
- `npm test`
- Manual: inspect generated artifacts for a configured contributor source and confirm no individual ranking output appears.

### Scope Budget

- Primary behavior change: optional `.all-contributorsrc` hints improve contributor-aware comment-source classification and contributor-source coverage metadata.
- Major subsystem boundaries touched: profile schema and GitHub collection/report metadata.
- Acceptance criteria count: 6.
- Estimated non-generated diff size: under 800 changed lines.
- Validation shape: schema/profile, collector, report, and manual artifact inspection.
- Split rationale: Contributor-source support touches a higher-risk identity boundary, so it remains independent from prompt and workflow setup despite needing a broader validation surface. The sixth criterion pins the identity boundary explicitly and is more reviewable than leaving it implicit.

### Risks / Watchpoints

- Markdown contributor files are intentionally unsupported in this milestone to avoid unreliable parsing.
- Contributor-source data should be treated as local/private artifact context.
- Keep source hints limited to contributor-aware comment-source classification and contributor-source coverage metadata; do not infer person-level conclusions.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M6: Reusable Presets And Rerun Guidance

### Outcome

Interactive setup can save reusable local run preferences so users can rerun analysis without re-answering prompts while keeping profiles responsible for repository semantics.

### Scope

- Decide and document whether reusable run choices use a separate local preset file or only generated command guidance.
- Support saving non-semantic run preferences such as output directory, CSV default, dry-run preference, and default PR limit when a preset file is chosen.
- Keep repository semantics such as PR classes, workflow strategy, and contributor source in the repository profile contract.
- Add docs that show how to rerun the same analysis non-interactively from a saved preset or printed command.
- Ensure preset loading composes predictably with explicit CLI flags, with flags taking precedence.
- Print generated or updated preset paths in completion output when a preset is written.

### Non-Goals

- Do not store GitHub tokens, secrets, or raw collected data in presets.
- Do not introduce global cloud sync or hosted account state.
- Do not make presets mandatory.
- Do not move repository profile semantics into run-only presets.

### Acceptance Criteria

- [ ] The initiative records and implements a clear ownership split between run presets and repository profiles.
- [ ] Users can rerun an interactive setup non-interactively from saved or printed settings.
- [ ] Explicit CLI flags override preset values predictably.
- [ ] Presets never store tokens, raw source bundles, or generated report content.
- [ ] Generated or updated preset paths are printed in completion output.
- [ ] Documentation explains preset paths, precedence, and cleanup.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `npm test`
- Manual: run from a saved preset, then override one option with a flag and inspect completion output.

### Scope Budget

- Primary behavior change: interactive choices become reusable without requiring repeated prompts.
- Major subsystem boundaries touched: CLI config loading and docs.
- Acceptance criteria count: 6.
- Estimated non-generated diff size: under 650 changed lines.
- Validation shape: CLI precedence tests plus manual rerun.
- Split rationale: This exceeds the 5-criterion preference only to make completion-output path disclosure explicit. Presets are deferred until prompt behavior and repository profile ownership are settled.

### Risks / Watchpoints

- Preset precedence can become confusing; flags should always win.
- Avoid hidden writes. Users should confirm the preset path before saving.
- Keep generated preset files out of target repositories unless the user intentionally chooses that location.

### Status

- [ ] Not started

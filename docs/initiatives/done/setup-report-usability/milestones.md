# Setup And Report Usability Milestones

## M1: Profile And PR Class Guidance

### Outcome

Users can understand how to create a repository profile, why PR class values may be `unknown`, and how to configure title-based classes without reading source code.

### Scope

- Update README profile-generation guidance with a command for creating a missing profile through `--interactive`.
- Update repository profile docs to explain `unknown` PR class fallback in report terms.
- Add title-based `prClasses` examples for release PRs, dependency PRs, and Conventional Commit-style PR titles.
- Explain that PR class rules are profile-owned assumptions and do not change scoring unless explicit filtering is used.
- Explain that branch-based class matching is not currently supported.

### Non-Goals

- Do not change CLI behavior in this milestone.
- Do not change profile schema or add new matcher fields.
- Do not add generated profile presets yet.
- Do not change reports or fixtures except for documentation references if needed.

### Acceptance Criteria

- [ ] README tells users how to generate a missing profile and what to expect from `--dry-run`.
- [ ] Repository profile docs define `unknown` class as the no-matching-rule fallback.
- [ ] Docs include copyable `prClasses` examples for release, dependency, and Conventional Commit-style title rules.
- [ ] Docs state that PR class evidence is interpretive/profile-driven and does not change default scoring.
- [ ] Docs state that branch-based class matching is deferred until a future matcher contract supports it.

### Required Validation

- `npm test`
- Manual: read README and repository profile docs as a first-time user and confirm profile generation and class configuration are understandable.

### Scope Budget

- Primary behavior change: users can self-serve profile and class setup from docs.
- Major subsystem boundaries touched: README and repository profile reference docs.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 350 changed lines.
- Validation shape: docs review plus existing test suite.
- Split rationale: Documentation comes first so later interactive behavior has a clear contract to implement.

### Risks / Watchpoints

- Examples should not imply globally correct PR taxonomy.
- Docs should avoid promising branch-based matching before the profile contract supports it.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged in PR #39 on 2026-06-19

## M2: Interactive Choice UX And PR Class Presets

### Outcome

Interactive setup presents closed profile choices as selectable lists and can generate opt-in title-based PR class rules for Conventional Commit-style repositories.

### Scope

- Render workflow enum prompts as numbered or selectable choices with display labels.
- Keep stored profile values as stable schema identifiers.
- Avoid `Other` for closed enum fields; use supported `unknown`, `mixed`, or skip options where appropriate.
- Add an opt-in Conventional Commit PR title preset prompt.
- Generate validated title-based `prClasses` from the selected preset in this order: `dependency`, `feature`, `fix`, `docs`, `test`, `maintenance`.
- Preserve existing release PR title rule behavior and generated profile write safety.
- Print the saved profile path and enough completion detail for users to know what profile assumptions were written.

### Non-Goals

- Do not silently infer PR classes from repository history without user confirmation.
- Do not add branch, label, author, or base/head matchers.
- Do not change report ranking, metrics, or filtering behavior.
- Do not overwrite existing custom `prClasses` without confirmation.

### Acceptance Criteria

- [x] Workflow enum prompts are list/select prompts in interactive mode and no longer require typing raw identifiers.
- [x] Enum prompts do not offer unsupported "Other" values.
- [x] Users can opt into a Conventional Commit-style PR class preset.
- [x] The preset generates exactly these classes, in order, with validated title regex rules: `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance`.
- [x] Generated PR class rules validate against `repository-profile.v1` and preserve existing custom rules unless the user confirms an update.
- [x] Completion output names the profile path and indicates that PR class rules were written when applicable.
- [x] Existing non-interactive CLI behavior remains deterministic and prompt-free.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/profile.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `npm test`
- Manual: run `npm run analyze:github -- --interactive --dry-run` and create a profile with the Conventional Commit preset.

### Scope Budget

- Primary behavior change: interactive setup becomes easier and can generate common PR class rules.
- Major subsystem boundaries touched: interactive CLI adapter and profile validation/generation.
- Acceptance criteria count: 7.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: CLI prompt tests plus profile/schema validation.
- Split rationale: Prompt rendering and PR class preset generation share the same interactive profile-write flow. Split if the preset expands beyond the six named title-based classes, adds branch/label matchers, or needs a preview/edit UI beyond simple confirmation.

### Risks / Watchpoints

- Presets should be transparent and editable, not magic inference.
- Existing profiles with hand-written class rules need careful update prompts.
- Prompt adapters in tests should prove user-facing labels and stored identifiers stay separate.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged in PR #40 on 2026-06-20

## M3: Evidence Tables And Status Labels

### Outcome

Markdown reports make repeated evidence details easier to compare through compact tables and text-backed status labels.

### Scope

- Keep the existing ranked-bottleneck PR-size table.
- Replace repeated ranked-bottleneck validation, review, and source-label detail lists with one compact evidence table per bottleneck when representative examples are present.
- Keep dominance, sensitivity, unavailable-data caveats, and explanatory source notes as prose below the table.
- Add status label helpers for observed, partial, unavailable, configured, warning, and healthy states.
- Use visual markers only when paired with text labels.
- Preserve existing detailed caveats, source labels, dominance notes, and methodology references.
- Update report contract docs and golden report fixtures.

### Non-Goals

- Do not change metrics, rankings, recommendations, or evidence collection.
- Do not make icons the only semantic signal.
- Do not widen CSV exports or change JSON report fields unless a focused renderer helper needs already-derived labels.
- Do not remove caveat prose that does not fit in a table.

### Acceptance Criteria

- [x] Ranked-bottleneck validation, review, and source-label details render as a compact evidence table when representative examples are present.
- [x] Tables include enough source/coverage context to remain auditable.
- [x] Dominance, sensitivity, unavailable-data caveats, and explanatory source notes remain prose rather than crowded table columns.
- [x] Status labels render consistently for observed, partial, unavailable, configured, warning, and healthy states.
- [x] Visual markers, if used, always appear with text labels.
- [x] Golden Markdown tests cover table output and marker labels for available, partial, unavailable, and configured states.

### Required Validation

- `node --test test/report.test.mjs`
- `npm test`
- Manual: inspect a generated `friction-report.md` in a narrow and normal-width Markdown viewer.

### Scope Budget

- Primary behavior change: report evidence becomes easier to compare visually.
- Major subsystem boundaries touched: report renderer and report contract docs.
- Acceptance criteria count: 6.
- Estimated non-generated diff size: under 650 changed lines.
- Validation shape: golden Markdown tests plus manual report inspection.
- Split rationale: Tables and status labels both affect the same report readability surface. Split if status marker semantics require new report JSON fields or if additional sections beyond ranked-bottleneck evidence tables are added.

### Risks / Watchpoints

- Tables can become too wide; choose fewer columns and keep caveats below.
- Red/green style markers should not imply individual blame or praise.
- Text labels must remain meaningful in plain terminals and copied Markdown.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged in PR #44 on 2026-06-20

## M4: Profile Improvement Suggestions

### Outcome

Reports connect missing profile evidence to concrete profile improvements without changing scoring or report JSON contracts.

### Scope

- Add report suggestions when the analyzed sample has at least 3 PRs and fallback `unknown` accounts for at least 80% of PR classes, or when every analyzed PR uses fallback `unknown` PR class evidence as the report-layer proxy for no configured PR class rule producing usable classification evidence.
- Add report suggestions when at least 25% of non-generated changed lines have role `unknown` or functional surface `unknown`.
- Point users toward profile docs, interactive setup, or concrete profile fields without requiring changes.
- Keep profile suggestions as Markdown and methodology text derived from existing report data; do not add `friction-report.v1` suggestion fields.
- Render each suggestion category at most once per report and suppress it when relevant profile evidence is already configured and the fallback threshold is not met.
- Update report contract docs and tests.

### Non-Goals

- Do not change scoring, ranking, CSV exports, or PR class matching.
- Do not add or require new profile fields.
- Do not make profile suggestions block report generation.
- Do not suggest every possible profile rule; focus on high-signal gaps surfaced by report evidence.
- Do not add structured profile-suggestion fields to `friction-report.v1` in this milestone.

### Acceptance Criteria

- [x] Reports suggest PR class profile improvements when fallback `unknown` is at least 80% of a sample of 3 or more PRs, or when every analyzed PR uses fallback `unknown` PR class evidence.
- [x] Reports suggest file/path profile improvements when at least 25% of non-generated changed lines have role `unknown` or functional surface `unknown`.
- [x] Profile suggestions render as Markdown and methodology text derived from existing report data, without adding `friction-report.v1` fields.
- [x] Each suggestion category renders at most once per report and stays omitted when relevant profile evidence is configured and the fallback threshold is not met.
- [x] Tests cover unknown-class suggestions, fallback-classification suggestions, and suppression when thresholds are not met.

### Required Validation

- `node --test test/report.test.mjs`
- `npm test`
- Manual: inspect generated methodology/report text for profile suggestions.

### Scope Budget

- Primary behavior change: reports tell users how profile configuration could improve interpretation.
- Major subsystem boundaries touched: report/methodology renderer and report contract docs.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: focused report tests plus manual text inspection.
- Split rationale: This milestone is limited to deterministic profile suggestions. Split if suggestion heuristics require more than the 80% PR-class threshold, 25% unknown-line threshold, or Markdown/methodology-only output surface named here.

### Risks / Watchpoints

- Profile suggestions should stay concrete and optional, not become a noisy checklist.
- Suggestions should not imply profile gaps make the report invalid.
- Suggestions should not repeat across multiple sections in a way that feels like nagging.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged in PR #45 on 2026-06-20

## M5: Workflow Data Caveats

Status: Implemented on 2026-06-20 for PR review.

### Outcome

Reports explain workflow-related data limits where configured workflow context clarifies unavailable evidence.

### Scope

- Add concise report wording for configured workflow context when it affects interpretation of unavailable or partial data.
- Add a workflow-context profile suggestion when workflow context is omitted and the report also has unavailable PR-open diff coverage or workflow-run coverage caveats that configured workflow context could help explain.
- Explain that final PR metadata can come from GitHub PR data, while PR-open diff growth requires an open-time snapshot or equivalent captured state.
- Explain squash merge and rebase merge limitations only when doing so clarifies unavailable evidence.
- Keep merge method as configured profile context, not observed evidence.
- Update report contract docs and tests.

### Non-Goals

- Do not implement PR-open snapshot capture.
- Do not reconstruct PR-open size from merge commits or branch history.
- Do not change scoring for squash, rebase, or merge commit repositories.
- Do not add Git history mining beyond existing GitHub collection paths.

### Acceptance Criteria

- [x] Reports or methodology mention PR-open diff growth limitations when relevant coverage is unavailable.
- [x] Reports suggest configuring workflow context when it is omitted and unavailable PR-open diff coverage or workflow-run coverage caveats would be clearer with maintainer-confirmed context.
- [x] Configured squash/rebase/merge workflow context is clearly labeled as profile context, not observed evidence.
- [x] Wording distinguishes final PR metadata from unreconstructable open-time size.
- [x] Tests cover at least omitted workflow context, squash-merge context, and unavailable PR-open diff coverage.

### Required Validation

- `node --test test/report.test.mjs`
- `node --test test/analyze-github-cli.test.mjs`
- `npm test`
- Manual: inspect generated methodology/report text for a squash-merge profile.

### Scope Budget

- Primary behavior change: reports explain workflow-related data limits and point to missing workflow profile context when it would clarify unavailable evidence.
- Major subsystem boundaries touched: report/methodology renderer and report contract docs.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: focused report tests plus manual text inspection.
- Split rationale: This milestone is limited to caveat wording for existing configured workflow context and coverage states. Split if implementation needs new data collection or score behavior.

### Risks / Watchpoints

- Caveats should not imply GitHub API data is wrong when it is simply unavailable.
- Merge strategy wording should avoid legalistic detail; methodology can carry the deeper explanation.
- The report should not blame squash merging; it should explain what history remains available.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

# Setup And Report Usability Architecture Notes

## Context

Recent hands-on use of interactive setup and generated reports raised several usability issues that cross current repository boundaries:

- interactive setup owns profile creation and workflow prompts;
- repository profiles own file classification, PR class rules, and workflow context;
- workflow context exists to reduce downstream analysis guessing by preserving maintainer-confirmed assumptions about how the repository works;
- the report renderer owns human-facing evidence layout, status language, and caveats;
- methodology and contracts explain what is observed, configured, inferred, unavailable, and safe to act on.

The improvements should make the existing product easier to use without changing scoring semantics or introducing hidden inference.

## Current State

- `src/cli/analyze-github.js` owns interactive prompt flow, generated profile writes, workflow profile fields, and release PR title rule generation.
- Repository profiles support optional title-based `prClasses` through `titleRegex` and `titleIncludes`.
- PRs without a matching class rule receive fallback `unknown` class evidence.
- `workflow` profile fields are configured context and do not affect scoring, ranking, CSV exports, or PR class matching.
- Final/current PR size is collected from GitHub PR metadata fields such as additions, deletions, changed files, and files; current metrics do not mine merge commits to compute merge size.
- PR-open diff growth remains unavailable unless normalized `prOpenDiff` has direct or reconstructed open-time counts.
- `src/report/friction-report.js` owns `friction-report.v1` generation and Markdown rendering.
- `src/report/evidence-artifacts.js` owns methodology and CSV artifact rendering.
- Reports already distinguish observed evidence, inferred diagnosis, suggested action, caveats, PR class context, configured workflow context, and artifact sensitivity, but some repeated evidence is still harder to scan than it needs to be.

## Target Shape

Interactive setup should present users with domain choices, not schema syntax:

- closed enums render as numbered/selectable choices with display labels;
- stored profile values remain stable identifiers;
- unsupported custom enum values are not offered;
- user-confirmed title convention presets can generate validated PR class rules.

Repository profiles should remain the source of truth for repository-specific assumptions:

- Conventional Commit PR class presets write explicit `prClasses` in this order: `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance`;
- branch-based class matching remains unsupported until a separate matcher contract adds it;
- `unknown` remains the transparent fallback when no rule matches.

Reports should become more scannable while preserving evidence meaning:

- stable repeated evidence fields render as tables;
- status markers have text labels and do not create a hidden moral scorecard;
- profile suggestions point users from report gaps to profile improvements such as title-based PR classes or path rules;
- configured workflow context provides safe assumptions for interpretation and future reconstruction paths, while caveats explain data availability limits where they clarify unavailable evidence.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Keep PR class convention support profile-driven and opt-in. | The product is repository-source-agnostic and should not silently infer semantics. | Automatically infer classes from titles or branch names. |
| Use title-based Conventional Commit presets before branch-based matching. | Title matching is already supported by the profile contract and live data. | Add branch, label, or author matchers immediately. |
| Generate a fixed first Conventional Commit preset. | A fixed class list keeps setup behavior documentable and testable. | Leave the preset scope for implementation to decide. |
| Do not offer `Other` for closed enum workflow prompts. | Unsupported enum values cannot be persisted safely. | Accept arbitrary text and later map it to `unknown`. |
| Keep visual markers text-backed. | Reports must remain meaningful in plain Markdown and accessible when icons or color are unavailable. | Use icons alone for compactness. |
| Treat profile suggestions as interpretation guidance, not required remediation. | Missing profile rules can make the report less specific, but analysis should still be useful. | Fail or warn loudly whenever profile data is incomplete. |
| Keep status labels and profile suggestions renderer-local in this initiative. | The feedback targets Markdown and methodology interpretation, and existing JSON/CSV compatibility should remain unchanged. | Add structured `friction-report.v1` fields for suggestions and status markers. |
| Keep merge strategy as maintainer-confirmed workflow context. | It lets downstream analysis logic avoid unsafe inference and choose conservative interpretation paths, even though current metrics use GitHub PR metadata for final size and do not mine merge commits. | Drop merge strategy until a metric consumes it. |
| Treat workflow caveats as interpretation guidance, not scoring input. | Merge strategy affects what can safely be inferred or reconstructed, but this initiative does not change formulas. | Adjust scores based on merge strategy. |
| Separate workflow-limit caveats from PR-open snapshot capture. | Explaining limitations is smaller and safer than collecting new historical snapshots. | Add webhook or snapshot persistence in this initiative. |

## Contracts And Boundaries

- Profile schema boundary:
  - `repository-profile.v1` remains valid with omitted `prClasses` and omitted `workflow`.
  - M2 should not add new matcher fields unless the milestone returns to planning.
  - Generated class presets must produce valid existing `titleRegex` or `titleIncludes` rules.
  - The first Conventional Commit preset uses `titleRegex` rules only, ordered so dependency-scoped titles match before broad maintenance titles.
  - Dependency titles include `deps:`, `chore(deps):`, `build(deps):`, and `fix(deps):`.
  - Feature, fix, docs, and test titles include the base Conventional Commit type plus scoped or breaking variants.
  - Maintenance titles include `refactor`, `perf`, `style`, `build`, `ci`, and `chore` variants not already matched by dependency.
- CLI boundary:
  - Interactive prompts may change user experience, but non-interactive flags remain deterministic and prompt-free.
  - Generated profile writes must keep existing safety behavior: avoid surprising rewrites and print generated profile paths.
- Report JSON boundary:
  - Existing `friction-report.v1` fields and stable IDs remain compatible.
  - M3 should prefer renderer-local labels; add JSON fields only if a real downstream consumer needs them.
  - M4 profile suggestions do not add `friction-report.v1` fields in this initiative.
  - M5 workflow-context suggestions do not add `friction-report.v1` fields in this initiative.
- Markdown boundary:
  - Tables and status labels are presentation changes.
  - Markdown must keep observed evidence, configured context, inferred diagnosis, suggested action, and caveats distinct.
  - Visual status markers must be paired with text.
  - Profile suggestions must say which profile evidence is missing or weak and what kind of profile rule would improve it.
  - PR class suggestions render when fallback `unknown` is at least 80% of a sample of 3 or more PRs, or when no PR class rules are configured and every analyzed PR is `unknown`.
  - File/path suggestions render when at least 25% of non-generated changed lines have role `unknown` or functional surface `unknown`.
  - Workflow-context suggestions render when workflow context is omitted and the report also has unavailable PR-open diff coverage or workflow-run coverage caveats that configured workflow context could help explain.
  - Suggestion categories render at most once per report.
  - Workflow-context suggestions are omitted when workflow context is configured or when the relevant coverage caveats are absent.
- Methodology boundary:
  - Methodology may carry deeper workflow-limit explanations than the main report.
  - Methodology should not imply unavailable open-time data was inferred.
- Metrics boundary:
  - No metric formulas, ranking keys, recommendation categories, or class filtering behavior change in this initiative.
  - Merge strategy may inform future data-source selection or reconstruction confidence, but it must not change scores without a separate metric contract decision.

## Migration / Compatibility

Existing profiles remain valid. Profiles with no `prClasses` continue producing `unknown` class fallback evidence.

Generated Conventional Commit presets are additive and opt-in. Existing custom `prClasses` should be preserved unless users confirm an update. If a generated rule ID conflicts with an existing rule, implementation should use the existing `nextPrClassRule` style or another deterministic conflict-avoidance path.

Existing JSON and CSV consumers should not need changes. Golden Markdown fixtures will change in milestones that update report presentation or caveat text.

Documentation updates can land before code changes. Interactive setup changes should include regression tests that prove non-interactive behavior is unchanged.

## Failure Modes

- User selects Conventional Commit preset but existing profile already has overlapping PR class rules:
  - Ask before updating or add only non-conflicting rules; never silently replace custom rules.
- User expects branch names to classify PRs:
  - Explain that branch matching is unsupported until a future profile matcher contract adds it.
- Prompt adapter cannot render rich select UI:
  - Fall back to numbered text choices while still storing schema identifiers.
- Report table would become too wide:
  - Use fewer columns and move verbose source/caveat text below the table.
- Status marker is ambiguous:
  - Render the text label first; the visual marker is optional decoration.
- Workflow caveat does not apply because coverage is observed:
  - Keep the caveat concise or omit it from the main report while preserving methodology context.
- Profile suggestions trigger for a repository that intentionally has no class rules:
  - Phrase suggestions as optional and suppress noisy repeated suggestions when the report already explains the fallback once.
- Profile suggestions would require new report JSON fields:
  - Stop and return to planning; this initiative keeps suggestions in Markdown/methodology only.

## Security / Safety Considerations

- Generated profiles are local files and may encode repository workflow assumptions. They should not be silently committed or pushed by the analyzer.
- Report artifacts may include private repository names, PR titles, URLs, paths, and metadata counts.
- Status markers must not encourage individual ranking or blame.
- Conventional Commit presets should not expose sensitive branch, author, or contributor data.
- Workflow caveats should avoid encouraging users to upload private artifacts to external tools to compensate for missing data.

## Validation

- CLI prompt tests for numbered/select choices, stored identifiers, generated presets, and non-interactive behavior.
- Profile/schema tests for generated PR class rules.
- Golden Markdown tests for evidence tables, status labels, and workflow caveats.
- Golden or focused report tests for profile suggestions when PR classes or file classification falls back.
- Report contract documentation review.
- Manual interactive setup smoke test.
- Manual report inspection for a squash-merge profile and a profile with Conventional Commit PR class rules.

## Open Questions

- [x] Should status markers use Unicode symbols, ASCII labels, or renderer-configurable marker sets? Use ASCII text labels only for M3 so copied Markdown and plain terminals preserve the status meaning.
- [ ] Future decision: Should workflow caveats appear in the report opening only when coverage is unavailable, or always when workflow context is configured?
- [ ] Future decision: Should branch-based PR class matching become a separate initiative after title-based presets prove useful?
- [ ] Future decision: Should final PR size wording mention GitHub PR metadata explicitly so readers do not assume merge commits are mined?
- [x] Should merge strategy stay in interactive setup if it is only context today? Yes. The setup flow should capture maintainer-confirmed workflow assumptions so downstream analysis logic can make safe interpretation decisions without guessing from repository history.
- [x] Which Conventional Commit preset scope is most useful without creating too many classes? Use six reader-facing classes: `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance`.
- [x] Should PR class preset rules use `titleRegex` only, or combine `titleIncludes` for simpler release/dependency cases? Use `titleRegex` only for the first preset so scoped and breaking Conventional Commit variants are covered consistently.

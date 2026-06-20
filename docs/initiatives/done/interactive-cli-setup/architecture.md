# Interactive CLI Setup Architecture Notes

## Context

The current CLI is a deterministic flag parser around `runAnalyzeGithub`. That shape is good for scripts, tests, and package users, but it leaves first-time maintainers to discover profile paths, CSV behavior, PR class filters, and repository workflow assumptions by reading docs.

Interactive setup should improve the human workflow without moving prompt logic into the analysis pipeline or making automation depend on terminal state.

## Current State

The live command accepts:

- required inputs: `--repo`, `--limit`, `--profile`, and `--out`;
- run mode flags: `--dry-run`, `--metadata-only`, `--validation-target`, `--json`;
- artifact choice: `--no-csv`;
- analysis filter: repeatable or comma-separated `--exclude-pr-class`.

Repository-specific semantics currently live in repository profile JSON, including file classification rules and optional PR class rules. CSV generation is a run option. Reports and methodology preserve coverage, profile path, PR class context, and artifact sensitivity guidance.

## Target Shape

Interactive behavior should sit above the existing option contract:

1. Parse flags.
2. If `--interactive` is present, collect or confirm missing choices through an injectable prompt adapter.
3. Convert prompt answers into the same option object used by `runAnalyzeGithub`.
4. Run the existing analysis path.
5. Print completion output that names generated artifacts and any saved profile/preset paths.

`runAnalyzeGithub` should remain prompt-free and callable from tests or future APIs.

When `--json --interactive` is used, stdout remains reserved for the final machine-readable JSON receipt. Prompt UI, progress text, and validation retry messages must use stderr or an injectable non-stdout channel.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Make prompting explicit for the first release. | Avoid hanging CI and preserve existing missing-option validation behavior. | Auto-prompt on any missing option in a TTY; convenient but riskier for scripts and pasted commands. |
| Keep prompt logic outside `runAnalyzeGithub`. | The analysis pipeline stays deterministic and testable. | Let `runAnalyzeGithub` prompt when options are missing; rejected because it couples programmatic calls to terminal state. |
| Start with prompts that map to existing flags. | This provides immediate user value without new report contracts. | Start by generating full profiles; higher risk because workflow and contributor fields need contract work. |
| Store repository semantics in profiles/config, not run presets. | Semantics such as PR classes and contributor sources affect analysis interpretation. | Store everything in a local preset; rejected because it blurs reusable run preferences with repository meaning. |
| Save run presets as explicit user-chosen local files. | Users can rerun setup non-interactively without hidden writes or global account state. Presets store only run inputs and preferences plus a profile path pointer. | Use only printed commands; useful but less reusable. Use a default global directory; rejected because it would surprise first-run users and imply sync or account state. |
| Treat contributor-source support as a separate milestone. | Contributor data touches identity and artifact-sensitivity boundaries. | Add contributors file parsing to the first wizard; too much risk for the prompt foundation. |
| Keep workflow and contributor fields additive to `repository-profile.v1`. | Existing profiles and package users stay compatible while the new fields remain optional. | Bump the profile schema version immediately; unnecessary unless implementation discovers an incompatible shape. |
| Support `.all-contributorsrc` before Markdown contributor files. | Structured JSON is more testable and less likely to misclassify people. | Heuristically parse `CONTRIBUTORS.md`; deferred because Markdown conventions vary widely. |
| Treat merge method as context only. | Merge style may inform interpretation, but no accepted metric currently depends on it. | Change scoring based on merge method; rejected until a future metric or caveat explicitly requires it. |

## Contracts And Boundaries

- CLI prompt adapter: owns terminal questions, defaults, validation messages, and answer normalization.
- CLI option contract: remains the boundary for invoking `runAnalyzeGithub`.
- Repository profile: owns file roles, PR classes, workflow context, branch/release strategy, and supported contributor-source declarations.
- Run preset: owns reusable run settings such as target repository, repository profile path, output directory, CSV default, dry-run default, validation-target default, JSON completion default, sample size, and requested PR class exclusions. It does not own PR class definitions, workflow strategy, branch/release strategy, contributor-source declarations, collected source bundles, reports, CSV contents, or secrets.
- Collector: owns observed GitHub data and optional target-repository contributor-source retrieval.
- Report/methodology: owns user-facing labels that distinguish observed evidence from configured context.

Prompt answers should use stable internal identifiers rather than display labels. Candidate values:

```json
{
  "workflow": {
    "primaryMergeMethod": "squash_merge",
    "releaseStrategy": "release_prs",
    "branchStrategy": "main_plus_release_branches"
  },
  "contributors": {
    "sourceType": "all_contributors",
    "path": ".all-contributorsrc"
  }
}
```

Exact field names should be finalized in M2 schema updates before reports rely on workflow context, and M5 should finalize contributor-source fields before collection relies on them. The fields should remain optional and additive to `repository-profile.v1`.

## Prompt Model

Prompt definitions should be structured and testable:

- `id`: stable answer key;
- `message`: user-facing question;
- `type`: select, confirm, text, integer, path, or multi-select;
- `choices`: stable value plus display label;
- `default`: explicit default when available;
- `validate`: synchronous validation for local fields;
- `when`: dependency on earlier answers or parsed profile data.

Preferred first-run prompts:

- target repository, using owner/name validation;
- latest merged PR limit, from 1 to 100;
- profile path, with existence and JSON validation;
- output directory;
- dry run / metadata-only;
- CSV evidence exports;
- excluded PR classes, shown only when profile `prClasses` has configured classes.

Later onboarding prompts:

- primary merge method;
- release PR usage and release title convention;
- branch strategy;
- contributor source type and path;
- save profile path;
- save run preset or print command only.

## Migration / Compatibility

Existing flag-based usage remains valid. Existing profiles remain valid when workflow/contributor fields are omitted. New profile fields should be additive and schema-version-compatible with current `repository-profile.v1`. If implementation discovers that compatibility cannot be maintained, the milestone should stop and return to initiative planning before a schema version bump is introduced.

Interactive setup should not rewrite existing profiles without confirmation. When updating a profile, preserve user-owned formatting only when the update can be applied deterministically. If formatting preservation is uncertain or expensive, write a clearly named generated profile instead of rewriting the existing file, and tell the user which file to review.

Repository semantics belong in profiles. Run presets are optional local JSON files chosen by the user and may only store rerun inputs and preferences such as output directory, CSV default, dry-run default, validation-target default, JSON completion default, sample size, target repository, repository profile path, and requested PR class exclusions. Explicit CLI flags override presets.

## Failure Modes

- Non-TTY interactive request: fail with an actionable message explaining that prompts require a terminal and showing the equivalent flags needed.
- Missing required options without `--interactive`: keep the current deterministic validation error.
- Invalid prompt answer: show the focused validation message and re-prompt in interactive mode.
- Selected profile has no PR classes: skip PR class exclusion prompt.
- Profile update would overwrite existing rules: require confirmation or write a new generated profile.
- Profile formatting cannot be preserved deterministically: write a generated profile and print its path instead of rewriting the original profile.
- Contributor source unavailable, malformed, or unsupported: record coverage as unavailable, malformed, or unsupported and continue unless the user chose a future strict mode.
- Markdown contributor source supplied: record unsupported/unparsed; do not infer identities from Markdown in this initiative.
- All PRs filtered out by prompted exclusions: keep the existing hard failure rather than writing complete-looking empty reports.

## Security / Safety Considerations

- Do not prompt for or store GitHub tokens.
- Do not write into the target repository unless the user explicitly chooses that path.
- Do not include raw contributor file contents, raw comments, logs, or secrets in reports or CSVs.
- Treat generated artifacts and profiles as local/private when they include repository names, PR URLs, file paths, contributor-source metadata, or coverage diagnostics.
- Keep `--json` output machine-readable; prompt chatter belongs on stderr or should be disabled unless interactive mode is explicit.
- Print every generated or updated profile/preset path so users know which durable file was changed.

## Validation

- CLI prompt adapter unit tests with scripted inputs.
- Non-interactive CLI regression tests for existing flags and missing-option errors.
- Profile schema tests for workflow and contributor-source fields.
- Collector tests for contributor-source coverage states after M3.
- Report/methodology tests proving configured context is labeled separately from observed evidence.
- Manual TTY smoke tests for interactive analysis and saved rerun behavior.

## Open Questions

- [ ] Should `--interactive` run the analysis immediately after setup, or should there also be an `init`-style path that only writes a profile/preset?
- [ ] Should the profile schema keep workflow context under a generic `workflow` object, or should each field live under existing PR class/profile sections?
- [ ] Future decision before branch-based class behavior: should PR class matchers support base/head branch names? Until then, branch strategy prompts record context only.
- [ ] What future contributor-source parser should follow `.all-contributorsrc`, if any: `CONTRIBUTORS.md`, GitHub collaborators, explicit profile lists, or organization membership lookup?
- [x] Future decision before M6 activation: should saved presets live in the output directory, a user-chosen path, or a default local `.delivery-friction-analyzer/` directory? M6 uses an explicit user-chosen local preset path and does not invent a default global or cloud-synced location.

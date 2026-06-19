# Interactive CLI Setup

## Status

Status: Active; M1 and M2 merged; M3 activated for implementation.

- State: Active
- Owner: Hanna
- Created: 2026-06-15
- Activated: 2026-06-15
- Current milestone: M3: Workflow Profile Wizard (activated for implementation)
- Related issue:
  - None yet.
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Repository Profile Format](../../../reference/repository-profile.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [Target Repository Input Contract](../../../contracts/target-repository.md)

## Problem

The analyzer is usable from flags, but first-time setup still assumes the user already knows which repository assumptions belong in a profile, which outputs they want, and which workflow details affect interpretation. That makes the CLI feel more like an internal pipeline than a maintainer-facing tool.

Current setup friction includes:

- users must know the required flags before the command can produce anything useful;
- repository profile JSON remains a manual prerequisite even for common cases;
- CSV exports are enabled by default, but users may not realize they can opt out when they only want Markdown and JSON;
- release PRs, branch strategy, and merge style are meaningful workflow context, but users currently need to encode or interpret them manually;
- structured human contributor hints, such as `.all-contributorsrc`, are not part of setup even though they could improve contributor-aware comment-source classification without ranking people. Unstructured files such as `CONTRIBUTORS.md` may exist, but they need a separate parsing decision before they can be treated as reliable input.

The CLI should help users express these repository-specific choices through a guided flow while preserving non-interactive automation.

## Goals

- Add an opt-in interactive CLI flow for local, first-run analysis setup.
- Let users choose existing run options from prompts, including target repository, sample size, output directory, profile path, CSV exports, dry run, and PR class exclusions where available.
- Let users capture repository workflow assumptions such as primary merge method, release PR strategy, branch strategy, and release class conventions in a durable repository profile.
- Let users identify an optional structured contributor source file, starting with `.all-contributorsrc`, for contributor-aware comment-source classification and contributor-source coverage metadata without creating individual rankings.
- Keep scripted usage stable: existing required flags and `--json` output must continue to work without prompts.
- Make prompt answers visible in generated completion output, methodology, or report metadata when they affect interpretation, artifact shape, or file writes.

## Non-Goals

- Do not replace the flag-based CLI or make prompts mandatory for automation.
- Do not introduce a hosted service, browser UI, or external account setup flow.
- Do not rank contributors, reviewers, authors, or teams.
- Do not infer sensitive identity information from contributor files beyond the configured contributor-aware comment-source classification need.
- Do not silently mutate a target repository or commit generated profile files into it.
- Do not add arbitrary questionnaire fields that are not connected to profile validation, artifact generation, report interpretation, or future contract decisions.
- Do not change scoring formulas solely because a prompt asks for merge or branch strategy.

## Product And Design Alignment

Delivery Friction Analyzer is local, evidence-preserving, and repository-source-agnostic. Interactive setup should follow the same posture:

- repository-specific assumptions are captured in repository profile data rather than hardcoded;
- generated artifacts remain auditable and local/private;
- source labels distinguish observed GitHub data from user-configured workflow context;
- reports avoid individual ranking and keep evidence, interpretation, recommendations, and caveats separate;
- the CLI remains automation-friendly for package users, tests, and CI.

## Proposed Solution

Add an explicit interactive mode, such as `--interactive`, that guides users through setup. The first implementation should only prompt for choices that map directly to existing command behavior:

- target repository;
- latest merged PR sample size;
- repository profile path;
- output directory;
- dry run / metadata-only;
- CSV evidence exports;
- PR class exclusions when the selected profile declares class rules.

The command should not automatically prompt in non-TTY contexts. When required flags are missing in an interactive terminal, the CLI may suggest `--interactive`, but scripted commands should keep receiving deterministic validation errors.

After the prompt foundation is stable, extend the guided setup into repository onboarding. The wizard should help create or update a local repository profile with workflow assumptions:

- primary merge method: `merge_commit`, `squash_merge`, `rebase_merge`, `mixed`, or `unknown`;
- release PR usage: whether releases are prepared through PRs, direct tags, release branches, or unknown/mixed flow;
- branch strategy: default branch, release branches, long-lived development branches, or unknown/mixed flow;
- release PR class convention: title and, if later supported, base/head branch matchers;
- CSV default preference for future runs;
- artifact destination and privacy reminder.

Contributor-source setup should be a separate milestone because it adds data collection and parsing behavior. The first supported contributor source is `.all-contributorsrc`, parsed as structured JSON. Its M5 surface is intentionally narrow: contributor hints may improve contributor-aware comment-source classification and contributor-source coverage metadata, but they must not create author/reviewer/person ranking, expose raw contributor content, or drive scoring changes. `CONTRIBUTORS.md` and other Markdown files are deferred: the wizard may acknowledge that a repository has one, but the analyzer must record Markdown contributor sources as unsupported or unparsed until a future contract accepts a reliable parsing strategy. When a supported contributors file cannot be read or parsed, the analyzer should report the source as unavailable or partial rather than inventing identities.

Prompt answers should be durable only when they have a clear owner:

- run-only choices stay in the current invocation result and generated methodology;
- reusable workflow assumptions live in the repository profile;
- run preferences such as output directory and CSV default may live in a documented local preset only after the preset ownership decision is implemented;
- contributor-source paths live in the repository profile and are collected from the target repository through GitHub access, not from the product repository working tree.

## User / Maintainer Workflows

- A maintainer runs `delivery-friction-analyzer --interactive` and completes a first analysis without memorizing required flags.
- A maintainer chooses whether to include CSV evidence files for downstream spreadsheet or model-assisted analysis.
- A maintainer records that the repository normally uses squash merges and release PRs, so methodology and future report interpretation can label that context.
- A maintainer points the analyzer at `.all-contributorsrc` so contributor-aware comment-source classification and coverage metadata can use structured contributor hints without listing people in the report.
- A maintainer with only `CONTRIBUTORS.md` sees that Markdown contributor parsing is not supported yet, rather than receiving misleading source classification.
- A maintainer reruns the analyzer non-interactively with the same flags or generated profile/preset in CI or local scripts.

## Acceptance Criteria

- [ ] The CLI has an explicit interactive mode that can collect required analysis inputs from a terminal prompt.
- [ ] Existing non-interactive flags, validation errors, `--json` output, and automation behavior remain backwards-compatible.
- [ ] Interactive CSV selection maps to the existing CSV export behavior and records the selected output mode in completion/methodology text.
- [ ] Repository workflow questions are captured in validated repository profile fields before reports rely on them.
- [ ] Contributor-source setup is optional, supports `.all-contributorsrc` first for contributor-aware comment-source classification and coverage metadata, records Markdown contributor files as unsupported until a future parser is planned, and never produces individual ranking output.
- [ ] Prompted analysis writes the same artifact set and contracts as equivalent flag-based analysis.
- [ ] Generated or updated profile and preset paths are printed in completion output whenever interactive setup writes them.
- [ ] Documentation explains when to use interactive setup, how to rerun non-interactively, and what data each prompt affects.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Interactive mode makes automation flaky. | CI or scripts could hang waiting for input. | Require explicit `--interactive` for prompts and detect non-TTY input before prompting. |
| The wizard asks questions that do not affect behavior. | Users may lose trust in setup. | Only persist answers tied to current behavior or documented future contracts; label context-only fields clearly. |
| Profile generation becomes too broad. | The first implementation could sprawl into every repository convention. | Start with existing CLI options, then add workflow profile fields in a separate milestone. |
| Contributor-file parsing misclassifies people. | Reports could imply false source attribution. | Support `.all-contributorsrc` first, record Markdown sources as unsupported until separately planned, preserve unavailable/partial labels, and avoid person-level ranking or display. |
| Release and branch strategy require richer matchers than title-only PR classes. | Users may expect release filtering to work from branch answers immediately. | Generate title-based rules first and record branch matching as unsupported until the profile schema supports it. |
| Storing reusable answers in an unexpected location surprises users. | Users may not know which profile or preset controls analysis. | Ask before writing, print paths in completion, and document the generated profile/preset ownership. |

## Testing Strategy

- Unit tests for prompt decision flow with injected input/output adapters.
- CLI tests proving non-interactive missing-option behavior still fails without prompts.
- CLI tests proving interactive answers map to the same `runAnalyzeGithub` options as flags.
- Profile schema and validation tests for workflow metadata fields.
- Fixture/report tests proving workflow and contributor-source metadata appear only where supported and do not alter scoring unless explicitly planned.
- CSV/no-CSV tests for interactive selection and completion output.
- Manual smoke test of `--interactive` in a local TTY against a small target repository.

## Resolved Decisions

- [x] Should prompting require explicit `--interactive` for the first release? Yes. Missing required flags without `--interactive` keep deterministic validation behavior; a TTY may suggest `--interactive` but must not auto-prompt.
- [x] Should prompt logic live inside `runAnalyzeGithub`? No. Prompting stays in the CLI adapter above the existing analysis option contract.
- [x] Should `--json --interactive` be supported? Yes, when interactive mode is explicit. Prompt UI must not write to stdout, and final stdout must remain the machine-readable JSON receipt.
- [x] Should merge method affect scoring immediately? No. Merge method is configured workflow context until a future metric or caveat explicitly needs it.
- [x] What contributor source should the first contributor milestone support? `.all-contributorsrc` only. Markdown contributor files such as `CONTRIBUTORS.md` are deferred and should be recorded as unsupported/unparsed rather than heuristically parsed.
- [x] Should workflow and contributor-source fields be additive to `repository-profile.v1`? Yes for this initiative. If implementation discovers an incompatible shape is required, it must stop and revise the initiative before changing the schema version.
- [x] Should repository semantics live in run presets? No. Repository semantics such as workflow context, PR classes, and contributor-source declarations live in the repository profile; presets may only own run preferences.

## Open Questions

- [ ] Before M6 activation, decide whether reusable run choices use a separate local preset file or only generated command guidance for CLI-only choices such as output directory and CSV preference.
- [ ] Before adding branch-based PR class behavior, decide whether profile PR class matchers should support base/head branch names; M3 records branch strategy as context-only metadata.
- [ ] Should contributor-source support later add `CONTRIBUTORS.md`, GitHub collaborators, explicit profile lists, or organization membership lookup?

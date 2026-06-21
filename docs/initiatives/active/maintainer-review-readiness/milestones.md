# Maintainer Review Readiness Milestones

## M1: Self-Profile Baseline

### Outcome

Future self-analysis of this repository can classify PRs, file roles, and functional surfaces well enough to support workflow decisions.

### Scope

- Add path rules to `profiles/delivery-friction-analyzer.json` for source, tests, schemas, docs, fixtures, profiles, scripts, package metadata, release notes, and workflow files.
- Add Conventional Commit-style `prClasses` rules for dependency, feature, fix, docs, test, and maintenance PRs.
- Preserve configured workflow context for squash merge, direct tags, and trunk-based development.
- Run profile validation so the profile remains valid under `repository-profile.v1`.
- Generate a self-analysis report using the updated profile and inspect the resulting Markdown, JSON, or CSV distribution for PR classes and functional surfaces.

### Non-Goals

- Do not change report scoring, rankings, or recommendation categories.
- Do not add new profile matcher fields.
- Do not implement generic profile suggestions; that belongs to setup-report-usability.
- Do not edit historical report artifacts unless a deliberate rerun is part of the PR.

### Acceptance Criteria

- [x] The repository profile contains ordered path rules for all high-level repository areas used by normal development.
- [x] The repository profile contains ordered Conventional Commit-style PR class rules matching the existing profile contract.
- [x] A validation run proves the updated profile is schema-valid.
- [x] A generated self-analysis report confirms PR classes and functional surfaces are no longer all `unknown`.
- [x] Profile assumptions are documented in rule IDs or notes where they are not obvious from the path.

### Required Validation

- `node --test test/profile.test.mjs`
- `node --test test/schema-validation.test.mjs`
- `npm test`
- Manual: inspect a generated self-analysis report bundle for PR class and functional-surface distribution.

### Scope Budget

- Primary behavior change: future reports classify this repository meaningfully.
- Major subsystem boundaries touched: repository profile and report-generation validation.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: profile/schema tests plus one manual report inspection.
- Split rationale: Profile rules and PR class rules are one coherent baseline because both remove fallback `unknown` interpretation from self-analysis.

### Risks / Watchpoints

- Rule order matters; specific generated/fixture/docs rules should come before broad docs or source rules.
- Surface names should be stable enough for future reports, not tied to a single current initiative.
- `unknown` should remain possible for genuinely new paths instead of forcing misleading precision.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

Pre-PR adversary review found maintainer-readiness fixes; remediation was applied before PR opening.

## M2: Local Preflight Commands

### Outcome

Maintainers and agents can run focused local commands that catch recurring release, package, report, fixture, and docs issues before PR review.

### Scope

- Add a general preflight script for ordinary changes that runs the existing full test suite and whitespace checks.
- Add a release/package preflight script that includes `npm pack --dry-run`, release-versioning tests, and direct CLI entrypoint smoke checks.
- Document when to use the ordinary preflight versus the release/package preflight; this milestone owns command usage docs, while M3 owns broader review-readiness guidance.
- Keep scripts deterministic, local, and compatible with the existing Node 20+ requirement.
- Update maintainer documentation where command names or release validation expectations change.

### Non-Goals

- Do not add a new CI provider or hosted workflow.
- Do not make every local script run every possible expensive validation.
- Do not add automatic git hooks in this milestone.
- Do not change npm publish or release workflow semantics.

### Acceptance Criteria

- [x] `package.json` exposes a general local preflight command for ordinary PRs.
- [x] `package.json` exposes a release/package preflight command that includes package dry-run validation.
- [x] Release automation docs name the local command maintainers should run before release/package PRs.
- [x] Existing tests continue to pass under `npm test`.
- [x] The release/package preflight catches the validation story represented by PR #28: SemVer handling, direct CLI entrypoint invocation, and package metadata/package contents.

### Required Validation

- `npm test`
- `git diff --check`
- `npm pack --dry-run`
- `node --test test/release-versioning.test.mjs` (includes direct CLI entrypoint smoke coverage)
- `node scripts/release-versioning.mjs assert-not-behind 1.2.3 v1.2.3`

### Scope Budget

- Primary behavior change: recurring local validation has named commands.
- Major subsystem boundaries touched: npm scripts and maintainer docs.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 350 changed lines.
- Validation shape: one ordinary local preflight and one release/package preflight.
- Split rationale: Scripts and docs are coupled because the value is a remembered maintainer workflow, not a hidden command.

### Risks / Watchpoints

- Scripts should not hide failing command output behind excessive wrappers.
- `git diff --check` may depend on local git state; document it as a preflight command rather than a library behavior.
- Release/package preflight should not mutate package versions or tags.

### Status

- [x] Active
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M3: Repo-Specific Review Guidance

### Outcome

Recurring automated review expectations are available before implementation and before PR review, especially for broad changes and known hotspot surfaces.

### Scope

- Add repository guidance for agents and maintainers, likely in a root `AGENTS.md` unless a better local convention is chosen.
- Capture readiness checks for release automation, report/contract changes, profile changes, docs wording, fixtures/golden outputs, and generated reports.
- Define broad-change tripwires based on the baseline report: 10 or more changed files, 750 or more non-generated changed lines, or more than one functional surface.
- Require broad changes to either split into smaller milestones or record why the chosen scope is still reviewable.
- Reference existing initiative lifecycle skills and recommend adversarial review before activation or PR work on broad milestones.

### Non-Goals

- Do not add a mandatory human approval process.
- Do not require the same checklist for tiny docs-only or test-only changes.
- Do not move backlog initiatives to active.
- Do not encode repo guidance into analyzer scoring or runtime behavior.

### Acceptance Criteria

- [ ] Repo guidance names the recurring Copilot review themes from the baseline report.
- [ ] Repo guidance defines starter tripwires for broad changes: 10 or more changed files, 750 or more non-generated changed lines, or more than one functional surface.
- [ ] Repo guidance tells agents which validation commands to run for ordinary, report/contract, profile, docs, and release/package changes.
- [ ] Guidance stays short enough to be usable during implementation.
- [ ] Existing README/reference docs link to maintainer guidance only where it helps contributors find local workflow expectations.

### Required Validation

- `npm test`
- Manual: compare the guidance against review themes from PRs #23, #26, #28, and #41.
- Manual: review one active initiative milestone and confirm the tripwires would make review burden visible.

### Scope Budget

- Primary behavior change: repeated review expectations move from PR comments into pre-review guidance.
- Major subsystem boundaries touched: repository guidance and maintainer docs.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: docs review plus full suite.
- Split rationale: Guidance for agents and maintainers should land together so automated and human workflows share one source of truth.

### Risks / Watchpoints

- Guidance should not become a second README.
- Broad-change tripwires should trigger judgment, not automatic rejection.
- The 750-line tripwire is intentionally below the 1,000-line outlier observation so scope gets discussed before a change becomes part of the largest-diff cluster.
- If guidance grows beyond a short root document, split follow-up skill creation into a separate milestone or initiative.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

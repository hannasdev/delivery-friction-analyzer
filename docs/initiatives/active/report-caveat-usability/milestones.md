# Report Caveat Usability Milestones

## M1: Decision-Oriented Report Caveats

### Outcome

Make the top of `friction-report.md` explain confidence caveats by decision driver, while preserving detailed caveat sections for auditability.

### Scope

- Add a top-level confidence digest table adjacent to the focus snapshot / key findings opening, before detailed caveat and bottleneck sections can bury it.
- Aggregate top-level caveats by driver: partial coverage, dominant PR, dominant PR class, and shared evidence where relevant.
- Replace count-only confidence wording and long repeated `## Key Findings` caveat bullets with grouped copy.
- Distinguish focus-area caveats from supporting-bottleneck caveats when applicable, using `summary.topBottleneckIds` / the rendered focus snapshot as the focus-area boundary.
- Preserve detailed evidence-quality, workflow, shared-signal, outlier/sensitivity, per-bottleneck confidence, methodology, and collection-coverage sections.
- Reduce repeated PR-class small-sample text so it appears once per dominant class in the digest.
- Use concise Markdown reference links from per-bottleneck confidence sections when a repeated caveat is already covered by the top digest.
- Keep configured-versus-observed and artifact-sensitivity wording intact.
- Update the friction report contract and golden fixtures.

### Scope Budget

- Primary behavior change: generated Markdown reports become clearer about which caveats should affect user action.
- Major subsystem boundaries touched: report renderer and report contract docs.
- Acceptance criteria count: 8.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: focused renderer/golden tests plus manual sample report inspection.
- Split rationale: this is the smallest coherent report slice because digest rendering, duplicate top-level caveat removal, fixture updates, and contract wording must land together for the report to remain internally consistent.

### Non-Goals

- Do not change metric formulas, ranking semantics, representative PR selection, no-signal behavior, or PR-class classification.
- Do not remove detailed caveat/audit sections.
- Do not add new report artifacts or external narrative generation.
- Do not change `friction-report.v1` JSON shape; if the digest cannot be derived from existing report data, return to planning before implementation continues.
- Do not redesign detailed evidence tables beyond caveat copy needed for this milestone.
- Do not change CLI behavior in this milestone.

### Acceptance Criteria

- [ ] A top-level confidence digest table groups caveats by driver and appears adjacent to the focus snapshot / key findings opening.
- [ ] `## Key Findings` does not contain long repeated outlier or PR-class caveat paragraphs when the same facts are represented in the digest.
- [ ] Dominant PR caveats are grouped by PR with affected bottlenecks and a next-check cue.
- [ ] Dominant PR-class caveats are grouped by class with affected bottlenecks, contribution range or values, class sample size, and a next-check cue.
- [ ] Coverage caveats state affected source families, observed/unavailable counts when available, and user impact without duplicating full methodology prose.
- [ ] Shared-signal rows render when shared evidence affects confidence, or are explicitly omitted when no shared evidence is present.
- [ ] Per-bottleneck `Confidence And Caveats` sections remain available and auditable, but use concise reference links instead of repeating unchanged sample-level warning sentences.
- [ ] `docs/contracts/friction-report.md` describes the confidence digest and clarifies which sections are top-level routing versus detailed audit trails.

### Required Validation

- `node --test test/report.test.mjs`
- Focused renderer/golden assertions for no-caveat, coverage-only, dominant-PR, multiple-dominant-PR, dominant-PR-class, shared-signal, filtered PR-class, and no-signal report states.
- `npm run preflight`
- Manual: regenerate the bundled sample report and confirm the opening is scannable, caveats are grouped, and detailed caveats remain findable.

### Risks / Watchpoints

- The digest must not hide uncertainty or imply that detailed caveat sections are optional for high-stakes process decisions.
- The opening must stay compact; avoid adding a new digest while leaving the old wall-of-text caveats unchanged.
- Filtered PR-class reports and no-caveat reports need explicit coverage so the digest does not render awkward empty states.

### Status

Lifecycle state lives in `initiative.json`. Use this section only for human-readable notes that do not contradict the structured state.

## M2: First-Run CLI Trust Polish

### Outcome

Close the remaining first-run CLI trust gaps found during black-box testing: version output, missing-profile guidance, and JSON stdout/stderr verification.

### Scope

- Add `--version` and `-v` support for conventional package version output.
- Keep report/metric schema versions out of package version output; a separate schema/report version command can be considered later if users need it.
- Improve non-interactive live GitHub missing-profile errors to explain that `--interactive` can create a starter `repository-profile.v1` profile.
- Keep the missing-profile message honest that starter profiles should be reviewed before relying on PR class, file role, or functional-surface labels.
- Add a JSON stream test that captures stdout and stderr separately and asserts the final completion receipt is parseable JSON on stdout when `--json` is used.
- Investigate the redirected `--json` hang observed in the Codex sandbox; fix only if reproducible in a normal shell test, otherwise record non-reproduction in implementation notes.
- Update README/reference docs only if user-facing CLI behavior or examples change.

### Scope Budget

- Primary behavior change: common first-run CLI checks and recovery paths feel familiar and actionable.
- Major subsystem boundaries touched: CLI parser/help/errors and focused docs/tests.
- Acceptance criteria count: 5.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: focused CLI tests plus preflight.
- Split rationale: this is separate from M1 because it touches CLI behavior rather than generated report copy.

### Non-Goals

- Do not redesign command structure or add subcommands.
- Do not change sample/live mode boundaries, presets, filtering, CSV behavior, or GitHub collection.
- Do not make starter profiles more complete than current interactive setup supports.
- Do not chase a sandbox-only redirected-output anomaly without reproduction.
- Do not change package metadata or published package contents unless required for version output.

### Acceptance Criteria

- [ ] `delivery-friction-analyzer --version` returns deterministic version output with exit code 0.
- [ ] `delivery-friction-analyzer -v` returns the same package version output.
- [ ] Missing `--profile` in non-interactive live GitHub mode explains starter profile creation through `--interactive`, points to `--profile path/to/profile.json`, and warns that starter profiles should be reviewed before trusting labels.
- [ ] CLI tests cover version output and missing-profile guidance.
- [ ] A stdout/stderr capture test proves `--json` emits parseable JSON to stdout while progress stays off stdout; any reproduced hang is fixed or a non-reproduction note is recorded.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `npm run preflight`
- `npm run preflight:release` if package metadata, package contents, or publish-facing entrypoint behavior changes.
- Manual: run `npm exec --yes . -- --version`, `npm exec --yes . -- -v`, a missing-profile live command, and a redirected `--json` sample command.
- If the redirected `--json` hang is not reproduced, record the non-reproduction in the implementation report or PR description.

### Risks / Watchpoints

- Version output should be simple enough not to make package installation or packed CLI behavior brittle.
- Missing-profile copy should not imply that starter profiles produce fully trustworthy labels.
- JSON stream tests should avoid shell-specific flakiness.

### Status

Lifecycle state lives in `initiative.json`. Use this section only for human-readable notes that do not contradict the structured state.

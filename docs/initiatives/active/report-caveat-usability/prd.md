# Report Caveat Usability

## Status

- State: Active
- Human approval: Approved
- Owner: Hanna
- Created: 2026-06-29
- Related docs:
  - [Milestones](milestones.md)
  - [UX Copy Review](ux-copy-review.md)
  - [Friction Report Contract](../../../contracts/friction-report.md)
  - [Repository Profile Reference](../../../reference/repository-profile.md)
  - [CLI Black-Box Polish](../../done/cli-black-box-polish/prd.md)
  - [Report First-Glance Actionability](../../done/report-first-glance-actionability/prd.md)
  - [Report Signal Trustworthiness](../../done/report-signal-trustworthiness/prd.md)

## Problem

Blind first-run testing showed that the latest CLI and generated sample report are broadly coherent, but two trust problems remain.

First, the generated Markdown report is honest about caveats but still hard to use at the exact moment when a maintainer is deciding what to trust. The opening says there are `2 coverage caveats, 6 outlier caveats, 8 PR class caveats`, then `## Key Findings` renders long prose bullets that repeat the same small-sample and outlier warnings many times. The underlying information is valuable, but the shape makes readers work too hard to answer:

- Which caveat should change my next action?
- Are the top focus areas affected, or only supporting bottlenecks?
- Is this a coverage problem, one dominant PR, one dominant PR class, or several independent warnings?
- Where is the short answer versus the audit trail?

Second, the first-run CLI still has small rough edges that can undermine confidence before a user gets to the report:

- `--version` is not recognized, even though many CLI users try it by habit.
- Non-interactive GitHub runs that omit `--profile` say the option is missing but do not explain that interactive setup can create a starter profile.
- A redirected `--json` smoke check appeared to hang in the Codex sandbox after producing empty stdout and stderr files. This needs reproduction before it becomes a product requirement, but automation-oriented behavior should be explicitly validated while the CLI polish is nearby.

This initiative should make the report's caveats more decision-oriented and the first-run CLI trust edges more polished without changing metric formulas, hiding uncertainty, or expanding into a general report redesign.

## Goals

- Replace count-only and repeated top-level caveat prose with a compact confidence digest grouped by caveat driver: partial coverage, dominant PR, dominant PR class, and shared evidence where relevant.
- Make `## Key Findings` readable as findings, not as a wall of caveat repetition.
- Preserve detailed coverage, outlier, PR-class, shared-signal, and per-bottleneck caveats as audit trails.
- Distinguish focus-area caveats from supporting-bottleneck caveats in the opening.
- Keep configured-versus-observed wording and artifact sensitivity guardrails intact.
- Add familiar CLI version output.
- Improve missing-profile guidance for non-interactive GitHub runs by pointing users to `--interactive` starter profile creation.
- Verify JSON stdout/stderr behavior under shell redirection and either fix a reproducible hang or record that the sandbox-only observation could not be reproduced.

## Non-Goals

- Do not change ranking formulas, bottleneck definitions, representative PR selection, PR-class classification, or no-signal semantics.
- Do not remove caveats, coverage tables, methodology sections, per-bottleneck confidence sections, JSON fields, or CSV evidence.
- Do not add a web UI, chart output, hosted service, or external model integration.
- Do not add a new report artifact or change `friction-report.v1` shape. M1 must derive the Markdown confidence digest from existing report data; if new JSON fields become necessary, return to planning before implementation continues.
- Do not redesign the CLI command structure or introduce subcommands solely for this polish.
- Do not make sample mode perform live validation or profile creation.
- Do not treat the redirected `--json` sandbox observation as confirmed without reproducing it in a normal shell test.

## Product And Design Alignment

Delivery Friction Analyzer is a local, evidence-preserving CLI. Maintainers should see caveats before acting, but caveats should help them decide rather than simply accumulate. This initiative keeps the product posture from prior report initiatives:

- the report remains deterministic and auditable;
- observed evidence, inferred diagnosis, suggested action, and caveats remain distinct;
- configured repository-profile context is never presented as observed GitHub evidence;
- report recommendations remain repository/workflow-level and do not rank people;
- CLI output remains friendly to both humans and automation.

## Proposed Solution

Add one canonical top-level `Confidence Digest` table adjacent to the focus snapshot / key findings opening, before the detailed trust and bottleneck sections can bury it. The digest is top-of-report routing: readers should encounter it while they are still deciding what to focus on, not merely somewhere before `## Ranked Bottlenecks`.

The digest should summarize caveats by the thing a maintainer needs to check:

- partial source coverage, with observed/unavailable counts and the affected signal family;
- dominant PRs, with affected bottlenecks and whether baseline ordering changes without the PR;
- dominant PR classes, with affected bottlenecks, contribution range, and class sample size;
- shared ranking or representative evidence, when several recommendations are different interpretations of the same underlying signal.

The digest should replace count-only top copy such as `2 coverage caveats, 6 outlier caveats, 8 PR class caveats` with a short answer and pointer to the digest. It should also replace long repeated caveat bullets in `## Key Findings` with the digest table. Detailed caveat sections can remain later for auditability:

- `Workflow Data Caveats` can keep workflow-context explanations.
- `Evidence Quality And Coverage` can keep source-family coverage counts.
- `Shared Signal Interpretation` can keep detailed grouping.
- `Outlier And Sensitivity Analysis` can keep robustness tables.
- Per-bottleneck `Confidence And Caveats` can keep local caveats, but should avoid repeating the same global small-sample sentence verbatim in every section. When a caveat is already covered by the top digest, per-bottleneck sections may use a concise Markdown reference link such as `See Confidence Digest for sample-level class caveats.`
- `Methodology Summary` and `Collection Coverage` can remain complete supporting context.

The digest should prefer concrete wording over abstract counts. For the sample report reviewed during planning, a good result would read like:

```md
| Caveat driver | Affects | Why it matters | Next check |
| --- | --- | --- | --- |
| Partial coverage | PR-open diff 3/4, workflow runs 3/4 | Diff-growth and validation signals use available evidence only. | Check `methodology.md` and `collection-coverage.csv` before comparing trends. |
| Dominant PR | PR #104 dominates Review churn, Repo guidance gap, Validation gap, Local hook gap, Test infrastructure gap, Fix amplification | Some recommendations may describe one broad PR more than a repository-wide pattern. | Inspect PR #104 and sensitivity before changing process. |
| Dominant PR class | Feature class drives 73-100% of displayed signal across 8 bottlenecks; class sample size is 2 PRs | Feature work may be overrepresented in the findings. | Compare against PR class context or rerun with class filters. |
```

The implementation should treat `summary.topBottleneckIds` and the rendered focus snapshot as the source for "focus areas." Other positive-signal bottlenecks may be listed as "other affected signals" when a caveat applies beyond the focus set.

The exact table columns can change during implementation if a more compact table proves clearer, but the result must preserve the same decision content.

For CLI polish, support `--version` and `-v` with package version output only. Schema/report contract versions should not be mixed into conventional package version output; a separate schema/report version command can be considered later if users need it. Improve the missing-profile error so new users learn the recovery path:

```text
Missing required option(s): --profile

Live GitHub analysis needs a repository-profile.v1 JSON file.
Run with --interactive to create a starter profile, or pass --profile path/to/profile.json.
Starter profiles are valid, but review them before relying on PR class, file role, or functional-surface labels.
```

Finally, add or update a test that proves `--json` completion keeps prompts/progress off stdout and writes parseable JSON to stdout under ordinary redirection. If the hang observed in Codex cannot be reproduced outside the sandbox, document the non-reproduction in the implementation notes rather than widening scope.

## User-Perspective Preview

- Primary users: maintainers and evaluators reading `friction-report.md` after a sample, dry-run, or live analysis; CLI users checking package identity or recovering from missing GitHub setup options.
- Result they should experience: the report's caveats feel like a clear confidence briefing, not a pile of warnings. The CLI handles common first-run habits with calm, actionable output.
- Visible surfaces: `friction-report.md`, `methodology.md` where wording must stay aligned, report contract docs, golden report fixtures, CLI `--help`/error/version output, README/reference docs if examples or option descriptions change.
- Key workflow:
  1. A user runs the bundled sample and opens `friction-report.md`.
  2. They see focus areas and recommendation categories as before.
  3. They see a confidence digest table that names partial coverage, dominant PRs, dominant classes, and shared evidence in grouped form.
  4. They can tell whether the top focus areas are affected by each caveat and which detailed section or artifact to inspect next.
  5. They scroll into ranked bottlenecks and still find local confidence notes without repeated global warning prose.
  6. A user runs `delivery-friction-analyzer --version` and gets version output instead of an unknown-option error.
  7. A user forgets `--profile` and learns that interactive setup can create a starter profile.
- States and edge cases: no caveats, coverage-only caveats, one dominant PR, multiple dominant PRs, dominant PR class with small sample, shared-signal groups without dominance, no-signal reports, filtered PR-class reports, sample reports, live reports, `--json` with stdout/stderr redirection, and missing profile in non-interactive GitHub mode.
- What will not change: source collection, report metrics, recommendation categories, JSON/CSV contracts, artifact sensitivity, profile ownership of classifications, or the requirement that live GitHub analysis use a repository profile.
- UX assumptions or gaps: human approval is pending; the top digest table is the accepted shape, but implementation should still verify the final table stays compact in the generated sample report.

## Human Approval Checkpoint

- Approval state: Approved
- Reviewer: Hanna
- Decision date: 2026-06-29
- Decision notes: Approved by Hanna on 2026-06-29 after resolving open UX decisions and rerunning initiative adversary review. Carry forward the accepted decisions: table-based confidence digest, short focus-row digest/pointer, per-bottleneck reference links for repeated global caveats, package-version-only `--version`/`-v`, M1 under the 750-line tripwire, and no `friction-report.v1` JSON shape changes without returning to planning.

## User / Maintainer Workflows

- A maintainer opens a generated report and quickly sees which caveat drivers matter before changing workflow.
- A maintainer can distinguish "top finding is caveated" from "supporting signal is caveated" without reading a long repeated sentence.
- A maintainer can use the detailed caveat sections and CSV/methodology artifacts as audit trails after reading the digest.
- A new CLI user can ask for package version and get a familiar response.
- A new live-analysis user who omits `--profile` learns the starter-profile path without needing to discover interactive setup from the README.
- An automation-minded user can rely on `--json` stdout behavior under ordinary shell redirection.

## Acceptance Criteria

- [ ] Markdown reports include a top-level confidence digest table that groups caveats by driver rather than only reporting counts.
- [ ] `## Key Findings` no longer renders long repeated outlier or PR-class caveat prose; repeated caveats are aggregated while detailed audit sections remain available.
- [ ] The report opening distinguishes caveats affecting focus areas from caveats affecting supporting bottlenecks when those sets differ.
- [ ] PR-class small-sample wording is emitted once per dominant class in the top-level digest, not once per affected bottleneck.
- [ ] Coverage caveats in the opening state affected source family counts and user impact without repeating full methodology text.
- [ ] Per-bottleneck confidence sections remain present and auditable, but use concise reference links for unchanged global caveats already covered by the confidence digest.
- [ ] Report contract docs describe the confidence digest and its relationship to detailed caveat sections.
- [ ] `--version` and `-v` return deterministic package version output.
- [ ] Missing `--profile` errors in live GitHub mode explain starter profile creation through `--interactive` and warn users to review starter profiles before trusting labels.
- [ ] JSON completion behavior is verified under stdout/stderr redirection; a reproducible hang is fixed, or a non-reproducible sandbox observation is documented in implementation notes.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Aggregating caveats hides detail. | Maintainers could miss a caveat that applies to a specific bottleneck. | Keep detailed caveat sections and per-bottleneck confidence blocks; make the digest a routing layer, not the only source. |
| The digest becomes another repeated section. | The report gets longer without improving scanability. | Remove or shorten duplicate top-level `Key Findings` caveat prose when the digest covers the same information. |
| Focus-area versus supporting-bottleneck distinction creates confusing categories. | Users may think supporting bottlenecks are unimportant. | Use wording such as `Focus areas affected` and `Other affected signals` instead of demoting evidence. |
| Version output imports package metadata in a fragile way. | CLI startup or package contents could regress. | Prefer an existing package/version source or a minimal build-time-safe path; validate packaged CLI behavior. |
| Missing-profile guidance overpromises profile quality. | Users may rely on starter classifications too heavily. | Say starter profiles are valid but should be reviewed before trusting labels, matching interactive prompt copy. |
| The redirected `--json` issue is sandbox-specific. | Work could chase a non-product failure. | Require normal-shell reproduction before fixing; otherwise add regression coverage for expected stdout/stderr behavior only. |

## Testing Strategy

- Golden Markdown tests for the new confidence digest table, section order, and removal of repeated top-level caveat prose.
- Focused renderer tests for no caveats, coverage-only caveats, dominant PR, dominant PR class, shared-signal groups, filtered PR-class reports, and no-signal reports.
- Contract documentation update for the Markdown confidence digest.
- CLI tests for `--version`, `-v`, and missing-profile error guidance.
- CLI JSON stream test that captures stdout and stderr separately and asserts stdout is parseable JSON when `--json` is used.
- `npm run preflight` for report/CLI/docs changes.
- If package metadata or package contents change, `npm run preflight:release`.
- Manual: regenerate the bundled sample report and confirm the opening reads as a digest and the repeated sample caveats are still available in detailed sections.

## Resolved Decisions

- [x] The top confidence digest should be a table because it is easiest to scan.
- [x] The current count-only `Confidence caveats` focus row should become a short digest or pointer to the confidence digest rather than carrying the full caveat detail itself.
- [x] Per-bottleneck confidence sections should use concise reference links for global caveats already covered by the digest, while preserving unique local caveats.
- [x] `--version` and `-v` should report the package version only. Schema/report contract versions belong in a separate future command if needed.

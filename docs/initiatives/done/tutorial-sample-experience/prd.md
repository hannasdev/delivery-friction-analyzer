# Tutorial Sample Experience

## Status

Status: Completed in PR #64 on 2026-06-28.

- State: Done
- Human approval: Approved
- Owner: Hanna
- Created: 2026-06-22
- Activated: 2026-06-23
- Completed: 2026-06-28
- Current milestone state: M1, M2, M3, M4, M5, and M6 merged.
- Related issue:
  - None yet.
- Related docs:
  - [Milestones](milestones.md)
  - [Architecture Notes](architecture.md)
  - [Interactive CLI Setup](../../done/interactive-cli-setup/prd.md)
  - [Setup And Report Usability](../../done/setup-report-usability/prd.md)
  - [GitHub Live Collection](../../done/github-live-collection/prd.md)
  - [Repository Profile Format](../../../reference/repository-profile.md)
  - [Target Repository Input Contract](../../../contracts/target-repository.md)

## Problem

Two hands-on user-testing scenarios showed that the analyzer's first-run story is still too dependent on internal validation history.

First, trying the CLI "against our own repo" exposed a product-boundary mismatch. The CLI correctly rejects `hannasdev/delivery-friction-analyzer` as the product repository, but the error does not give users a satisfying next step for learning the tool. `--validation-target` also sounds like it might allow a self-analysis trial, but it only marks target metadata. The guard is defensible; the onboarding path around it is not yet friendly.

Second, trying `hannasdev/mcp-writing` as the next user-testing target showed that it works for Hanna, but it is not a useful public tutorial target because other users may not have access. It also produces a first report that depends heavily on repository-profile setup choices:

- a generated starter profile with no rules produces a readable but setup-heavy report where PR classes and functional surfaces are mostly `unknown`;
- accepting the Conventional Commit PR class preset makes the report more credible, but the prompt defaults to no and asks for domain knowledge before users have seen a report;
- even the better preset run opens with several truthful but heavy caveats, including PR-class dominance, unknown workflow context, and unavailable PR-open diff growth.

The product needs a tutorial-like sample experience that shows value before users connect private data, understand repository profiles, or decode internal validation targets. It also needs a deliberate product-repository self-analysis path. That path is not a security boundary for public GitHub data; it is a product/validation guardrail that prevents accidental circular analysis and confusing first-run behavior while still letting someone explicitly analyze the public product repository when the relevant data is readable.

## Goals

- Replace `hannasdev/mcp-writing` as the public tutorial target with a bundled sample source that any user can run.
- Use an explicit sample command: `delivery-friction-analyzer --source sample --out reports/tutorial`.
- Avoid a silent sample default. If a user provides neither `--source` nor live GitHub target flags, show a friendly "choose a source" error.
- Keep existing live GitHub commands compatible by inferring `github` when users provide live-only flags such as `--repo`, `--profile`, or `--limit`.
- Provide a deterministic sample run that does not require private repository access, GitHub authentication, or live API coverage.
- Bundle fully synthetic placeholder source data and a complete sample profile that demonstrate the most extensive useful report scope without overwhelming first-time users.
- Make the sample profile itself educational, using fake but explanatory placeholder values and in-profile `notes` fields where the schema supports them so users can infer how to write a real profile.
- Introduce a generic analyzer source contract, `source-bundle.v1`, so sample and live GitHub sources are honest variants of the same contract.
- Make sample output clearly distinct from live GitHub analysis, so users do not confuse synthetic data with observed repository evidence.
- Add an explicit product-repository override that asserts readable access before collecting data and exits early when required data cannot be read.
- Improve first-run copy around the product-repository guard, `--validation-target`, generated profiles, and Conventional Commit PR class presets.
- Preserve the analyzer's evidence boundaries: sample data must be labeled as sample data, and live reports must continue to preserve coverage and caveats honestly.

## Non-Goals

- Do not remove `mcp-writing` fixture data or historical validation notes from tests and internal docs as part of the public tutorial cleanup.
- Do not make sample data look like observed live GitHub evidence.
- Do not change scoring, ranking, recommendation categories, or CSV contracts solely to support the tutorial.
- Do not add a hosted service, browser UI, GitHub App, remote demo backend, or graph generation in this initiative.
- Do not silently loosen the product-repository guard for normal live analysis.
- Do not pretend the product-repository guard is a security control for public GitHub data.
- Do not let public tutorial behavior depend on Hanna-only repository access.
- Do not infer repository profiles silently for arbitrary live repositories.
- Do not make sample output the only supported first-run path; users should still be able to analyze their own repositories with `gh` and a profile.

## Product And Design Alignment

Delivery Friction Analyzer is a local, evidence-preserving CLI. A sample experience should teach that posture rather than bypass it:

- sample artifacts are local and deterministic;
- sample source data is explicitly fictional or placeholder;
- repository assumptions live in a sample profile, not hardcoded report logic;
- live GitHub collection remains credentials-based and coverage-aware;
- product-repository analysis remains explicit and opt-in;
- tutorial docs show the main user workflow before advanced profile tuning;
- public docs do not rely on a private or Hanna-only repository.

## Proposed Solution

Introduce an explicit source mode:

```sh
delivery-friction-analyzer --source <sample|github>
```

The public first-run command is:

```sh
delivery-friction-analyzer --source sample --out reports/tutorial
```

If the user runs the CLI without `--source` and without live target flags, the command should fail with a friendly source-selection message instead of silently choosing sample:

```text
Choose a source:
  --source sample    Run the bundled synthetic sample
  --source github    Analyze a GitHub repository
```

Existing live-analysis commands should keep working. If `--source` is omitted and the command includes live-only inputs such as `--repo`, `--profile`, or `--limit`, the CLI resolves the source as `github`. Users may also be explicit:

```sh
delivery-friction-analyzer --source github --repo owner/name --limit 30 --profile path/to/profile.json --out reports/live
```

Sample mode should write the same artifact family users will see in live analysis:

- `friction-report.md`;
- `methodology.md`;
- `friction-report.json`;
- `metrics-summary.json`;
- `normalized.json`;
- `source-bundle.json`;
- curated CSV evidence when enabled.

Sample output must identify itself as synthetic sample output in CLI completion, Markdown, methodology, CSV/source labels where applicable, and machine-readable metadata. The bundled dataset should be intentionally broad: it should exercise PR classes, file/path roles, functional surfaces, workflow context, review churn, validation churn, broad-change scope, outlier/sensitivity reporting, partial coverage caveats, methodology, JSON, and CSV exports.

The sample profile should be a teaching artifact. Because the current repository profile contract is strict JSON, the primary template should be a valid placeholder JSON profile whose fake values are explanatory and useful: rule IDs, PR class names, path patterns, functional surfaces, workflow choices, and `notes` fields should model what a real repository owner would put in their own profile. A short companion guide may explain how to adapt the template, but the JSON file itself should carry enough meaning to be useful when copied or inspected alone. If implementation intentionally adds JSONC or first-class profile comments, that must be treated as an explicit repository-profile contract change with schema/docs/tests.

The source bundle contract should become generic:

- `schemaVersion`: `source-bundle.v1`;
- `source.kind`: `sample` or `github`;
- `source.label`: human-readable source label, such as `Bundled synthetic sample, not live GitHub data` or `GitHub live collection`;
- `collector`: collector identity and provider details;
- `selection`: how the analyzed PR set was selected;
- `coverage.status`: aggregate source coverage status over the source-family entries;
- `coverage.sourceFamilies`: source-family coverage entries, with source labels that can honestly describe either live API endpoints or bundled synthetic evidence;
- `pullRequests`: GitHub-shaped PR evidence reused by normalization.

This replaces the current GitHub-specific contract as the product contract for generated source bundles. Live GitHub bundles and sample bundles should both validate against `source-bundle.v1`; any compatibility handling for existing `github-source-bundle.v1` fixtures should be explicit and tested rather than hidden.

The contract migration must preserve the analyzer-owned evidence that current reports depend on. The planned old-to-new mapping is:

| Current `github-source-bundle.v1` field | `source-bundle.v1` treatment |
| --- | --- |
| `schemaVersion` | Rename value to `source-bundle.v1`. |
| `collectedAt` | Retain as the materialization timestamp for both live and sample bundles. |
| `collector` | Retain and generalize; remove GitHub-only `collector.name` constraints. |
| new `source` | Add `source.kind`, `source.label`, and source provenance metadata. |
| `targetRepository` | Retain. Sample bundles use fictional placeholder repository identity. |
| `repositoryMetadata` | Retain. Sample metadata must be fictional and clearly synthetic. |
| `selection` | Retain and generalize selection strategies and source labels. |
| `coverage.status` | Retain as the aggregate coverage status over `coverage.sourceFamilies`; do not drop it during the source-bundle migration. |
| `coverage.apiFamilies` | Rename to `coverage.sourceFamilies`. Preserve the existing coverage-entry shape (`family`, `source`, `status`, `attempts`, `diagnostics`, and `downstreamImpact`) but generalize `source` labels so sample entries can say `bundled tutorial sample` instead of pretending to be API calls. |
| `languageDistribution` | Retain with generalized source labels. |
| `contributorSource` | Retain as optional sanitized metadata with generalized source labels. |
| `pullRequests` | Retain GitHub-shaped PR evidence and nested per-PR coverage. |
| `pullRequests[*].coverage` | Retain as the per-PR coverage object. It should keep current per-family keys such as `prOpenDiff`, `reviewThreads`, and `workflowRuns`; where a nested entry uses coverage-entry fields, those fields follow the same generalized source-label rules as `coverage.sourceFamilies`. |
| `raw` | Retain as the only place for provider- or sample-specific raw details. |

No existing analyzer-owned evidence field should be dropped as part of this initiative unless M2 explicitly documents the removal, impact, and test coverage.

Public README quickstart should lead with the explicit sample path, then explain live GitHub analysis as the next step. `hannasdev/mcp-writing` should move out of tutorial copy and remain framed as internal validation data where referenced. Public docs may include short text excerpts from the generated sample report once the report exists; screenshots are deferred until graph output or another visual report surface makes screenshots materially more useful.

The sample data and sample profile should be included in the published npm package so `npx delivery-friction-analyzer --source sample --out reports/tutorial` works without a repository checkout. Runtime sample data should live in `examples/tutorial/`, not under private validation fixtures.

Sample identities must be fictional but not ambiguous. Use placeholder owners, repositories, users, and URLs that cannot be mistaken for observed GitHub evidence, such as `example-org/delivery-dashboard`, `https://example.com/pull/123`, and synthetic logins like `sample-reviewer-a`. Generated reports and source labels should use a stable phrase such as `Bundled synthetic sample, not live GitHub data`.

Live-only flags should be rejected in `--source sample` with actionable copy. At minimum, sample mode should reject `--repo`, `--profile`, `--limit`, `--validation-target`, `--interactive`, `--dry-run`, and live classification exclusion flags if they only make sense for GitHub collection. Output controls such as `--out`, `--json`, and CSV toggles should remain available.

Product-repository analysis should remain rejected by default. Add an explicit opt-in override for live GitHub analysis, proposed as:

```sh
delivery-friction-analyzer --source github --repo hannasdev/delivery-friction-analyzer --allow-product-repository ...
```

When the override is present, the CLI must assert readable access before collection or artifact writes. The assertion should require GitHub access sufficient to read the source families needed for a trustworthy live report. For a public repository, maintainer permission is not required unless the implementation depends on maintainer-only data. If required read access cannot be proven, the CLI should fail closed with an actionable message. The override must not apply to sample mode.

Product-repository readable-data assertion should treat source families as follows:

| Source family | Override preflight behavior |
| --- | --- |
| Repository metadata | Required. Fail before collection if unreadable. |
| Pull request inventory | Required. Fail before collection if unreadable. |
| Pull request details | Required. Fail before collection if unreadable. |
| Review threads | Optional coverage unless implementation later makes it required; partial or unavailable state belongs in coverage artifacts. |
| Workflow runs | Optional coverage unless implementation later makes it required; partial or unavailable state belongs in coverage artifacts. |
| Languages | Optional coverage; partial or unavailable state belongs in coverage artifacts. |
| Contributor source | Optional and profile-dependent; unsupported, partial, or unavailable state belongs in coverage artifacts. |
| PR-open diff | Optional historical coverage; unavailable state belongs in coverage artifacts. |

The live CLI copy should also be refined based on testing:

- product-repository rejection should explain that the guard is intentional first-run/product-boundary behavior, not a data-security boundary;
- product-repository rejection should point to the explicit sample command, another target repository, or the explicit product-repository override when appropriate;
- `--validation-target` help text should clarify that it marks metadata and does not bypass target validation;
- profile creation prompts should make the starter profile limitation visible and steer users toward presets when they match the repository;
- the Conventional Commit preset prompt should keep its default answer as no, but explain the decision in user terms before asking.

No-source guidance should show the exact next useful actions, not just name the source values:

```text
Choose what to analyze.

Try the bundled sample:
  delivery-friction-analyzer --source sample --out reports/tutorial

Analyze a GitHub repository:
  delivery-friction-analyzer --source github --repo owner/name --limit 30 --profile path/to/profile.json --out reports/owner-name
```

Product-repository guard copy should recommend the sample or another repository first, and mention the explicit override only for intentional self-analysis:

```text
This is the analyzer's own product repository, so the CLI does not analyze it by default.

To learn the tool, run the bundled sample:
  delivery-friction-analyzer --source sample --out reports/tutorial

To analyze a different repository, pass --repo owner/name.

If you intentionally want to analyze this product repository, rerun with --allow-product-repository. The CLI will check that required data is readable before writing artifacts.
```

The Conventional Commit preset should remain opt-in because PR classes are profile-owned interpretation, not observed GitHub truth. The default no answer protects repositories that use other title conventions from misleading `feature`, `fix`, `docs`, `test`, `dependency`, or `maintenance` labels. The prompt should still make the benefit clear: if PR titles usually start with Conventional Commit-style prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `chore(deps):`, or `ci:`, accepting the preset gives the first report meaningful PR class distribution and avoids an all-`unknown` class view. The prompt should also tell users to skip the preset when their repository uses release titles, ticket prefixes, free-form titles, or another custom taxonomy that belongs in hand-authored profile rules.

The prompt itself should stay concise enough for a terminal:

```text
Add Conventional Commit PR class rules? [y/N]
Use this if PR titles usually start with feat:, fix:, docs:, test:, chore(deps):, or similar. It groups the report by dependency, feature, fix, docs, test, and maintenance. Skip it for ticket prefixes, release titles, or custom title styles.
```

## User-Perspective Preview

- Primary users: maintainers, contributors, and evaluators trying Delivery Friction Analyzer for the first time.
- Result they should experience: a user can run one explicit local sample command, open a Markdown report, and understand what the analyzer produces before connecting it to a real GitHub repository.
- Visible surfaces: README quickstart, CLI help text, source option behavior, generated sample artifacts, methodology text, product-repository guard errors, product-repository override errors, sample report excerpts in docs, and interactive setup prompts.
- Key workflow:
  1. User installs or runs the package.
  2. User runs `delivery-friction-analyzer --source sample --out reports/tutorial`.
  3. CLI writes a deterministic sample report bundle and never calls `gh`.
  4. Completion output loudly labels the result as bundled synthetic sample data and points to `friction-report.md` first.
  5. Report clearly labels synthetic sample evidence and shows how to read findings, caveats, CSVs, and next steps.
  6. README includes a short text excerpt from the generated sample report, then offers live analysis against the user's own repository with `--source github` or the existing inferred-live command shape.
- Product-repository workflow:
  1. A user who tries the product repository without an override receives the intentional guardrail.
  2. A user can explicitly request product-repository live analysis with `--allow-product-repository`.
  3. CLI asserts required read access before collection.
  4. If access cannot be proven, the command exits before writing report artifacts.
- States and edge cases: no source and no live flags, sample output path already exists, CSV disabled, JSON completion requested, user passes live flags with sample mode, user tries product repository without the override, product-repository override lacks required read access, user runs live analysis without `gh` access, user creates a minimal profile, and user decides whether Conventional Commit-style PR title rules match their repository.
- What will not change: live analysis still requires GitHub access, repository profiles still own repository semantics, and internal validation fixtures may continue to use `mcp-writing`.
- UX assumptions or gaps: human approval is still needed for the overall preview; the sample repository story needs enough realism to teach the report without feeling like fake marketing data.

## Human Approval Checkpoint

- Approval state: Approved
- Reviewer: Hanna
- Decision date: 2026-06-23
- Decision notes: Approved by Hanna after adversarial review accepted the plan with notes. The revised plan uses explicit `--source sample`, one broad fully synthetic dataset, a documented sample profile, generic `source-bundle.v1`, short text excerpts in docs, and an explicit product-repository override based on readable-data assertion rather than maintainer-only permission. Activation should carry forward the documented broad-change and preflight-probe watchpoints.

## User / Maintainer Workflows

- A new user runs the explicit sample command and sees a useful report without needing access to Hanna's repositories.
- A new user reads README and understands the difference between sample output and live GitHub analysis.
- A user with an existing live command continues using `--repo`, `--profile`, and `--limit` without adding `--source github`.
- A user who omits both `--source` and live target flags receives a clear source-selection message.
- A maintainer or public user tries to analyze the product repository and receives an intentional guardrail with a useful learning path.
- A user explicitly opts into product-repository analysis and gets an early readable-data assertion before any collection.
- A user creates a starter profile for their own repository and understands why optional PR class and path rules improve interpretation.
- A maintainer keeps using `mcp-writing` for internal calibration without presenting it as a public quickstart dependency.

## Acceptance Criteria

- [x] Public quickstart no longer depends on `hannasdev/mcp-writing` as the tutorial target.
- [x] Running `delivery-friction-analyzer --source sample --out reports/tutorial` produces a deterministic local sample report bundle without GitHub network access or private repository permissions.
- [x] Running without `--source` and without live target flags fails with source-selection guidance that includes exact sample and GitHub command examples rather than silently producing sample output.
- [x] `--source sample` clearly labels synthetic data and does not claim live GitHub coverage.
- [x] Existing live command shapes that include `--repo`, `--profile`, or `--limit` continue to resolve to GitHub live analysis when `--source` is omitted.
- [x] Live-only options passed with `--source sample` are rejected with actionable copy.
- [x] Generated source bundles use generic `source-bundle.v1`, with `source.kind` distinguishing `sample` and `github`.
- [x] The `source-bundle.v1` migration preserves or explicitly maps every analyzer-owned field from `github-source-bundle.v1`.
- [x] The sample profile and source data demonstrate PR classes, file/path roles, functional surfaces, workflow context, caveats, broad-change scope, outlier/sensitivity examples, and CSV evidence without requiring user edits.
- [x] The sample profile is valid JSON with fake but explanatory placeholder values, useful rule IDs, path patterns, functional surfaces, workflow choices, and `notes` fields where supported.
- [x] Repository profile reference docs explain valid `notes` usage for file rules and PR class rules.
- [x] Sample data uses clearly fictional identities and URLs that cannot be mistaken for observed GitHub evidence.
- [x] Public docs include a short text excerpt from the generated sample report after the sample exists; screenshots and graphs are explicitly deferred.
- [x] Product-repository live analysis remains rejected by default.
- [x] The product-repository override asserts required readable access for repository metadata, PR inventory, and PR details before collecting data or writing artifacts; optional families remain honest coverage states.
- [x] Product-repository guard and `--validation-target` copy explain what happened and what to do next.
- [x] Interactive profile setup copy makes the tradeoff between minimal starter profiles and useful PR class presets understandable, including when to accept or skip the Conventional Commit preset.
- [x] Internal `mcp-writing` validation references remain available where needed for tests, fixtures, and historical initiative records.

## Risks And Tradeoffs

| Risk | Impact | Mitigation / Decision Path |
| --- | --- | --- |
| Sample data feels fake or too polished. | Users may not trust that live reports will look similar. | Use realistic placeholder PR patterns and preserve caveats, outliers, and coverage labels. |
| Sample data tries to show too much at once. | First-time users may find the report noisy. | Make the sample broad in generated artifacts, but keep the first page focused and readable. |
| Sample data accidentally resembles private history too closely. | Private context could leak into public sample artifacts. | Use fully synthetic placeholder data and run a public-safety review that checks names, URLs, users, comments, and paths. |
| Adding source mode blurs live versus sample evidence. | Users may mistake sample output for observed GitHub data. | Label sample mode in CLI completion, methodology, report title, source metadata, and coverage fields. |
| Explicit `--source sample` adds one more concept to first run. | The tutorial command is slightly longer. | Keep docs and no-source errors crisp; the clarity is worth the extra flag. |
| Generic `source-bundle.v1` expands the initiative. | Contract migration may touch schema, fixtures, docs, and report labels. | Split generic contract work into its own milestone and keep compatibility handling explicit. |
| Product-repository override weakens the product-boundary guard. | Users may treat product analysis as a normal public path. | Require an explicit flag, fail closed when required data cannot be read, and keep ordinary product-repository rejection intact. |
| Removing `mcp-writing` from public docs breaks maintainer workflows. | Existing validation commands may become harder to find. | Move `mcp-writing` guidance to internal validation docs rather than deleting it wholesale. |
| Conventional Commit preset copy nudges users into a false taxonomy. | Reports may show confident-looking PR classes that do not match the repository. | Keep the default as no, name examples that should accept the preset, and tell users to skip it when titles use another convention. |
| First-run prompt changes affect automation or tests. | CLI compatibility could regress. | Keep prompt changes inside explicit interactive mode and cover parse/completion output with CLI tests. |

## Testing Strategy

- CLI tests for source resolution, explicit sample behavior, no-source guidance, inferred GitHub behavior, invalid source/flag combinations, completion output, output path handling, JSON completion, and no-network sample behavior.
- CLI tests for product-repository rejection, product-repository override readable-data assertion, and early exit before artifact writes when access fails.
- Report or golden tests for sample artifacts, including sample labels and expected caveats.
- Schema/contract tests proving sample and live source bundles validate against generic `source-bundle.v1`.
- Compatibility tests for any retained `github-source-bundle.v1` fixture or migration path.
- CLI copy tests for no-source guidance, product-repository guard copy, sample-output source labels, and the Conventional Commit preset prompt.
- README/reference docs review for public quickstart, `npx`, prompt conditionality, text excerpts, and configured-versus-observed claims.
- Package dry-run validation proving sample runtime data is included in the published package.
- Manual sample smoke test from a clean output directory.
- Manual live-analysis smoke test against a real accessible repository to confirm source-mode changes did not weaken live collection.

## Open Questions

- [x] Should the tutorial command be `--tutorial`, `--source sample`, or a separate package script such as `npm run tutorial`? Use explicit `--source sample`; do not silently default to sample.
- [x] Should sample data be fully synthetic, or adapted from existing `mcp-writing` fixtures after redaction and renaming? Use fully synthetic data.
- [x] How broad should the synthetic dataset be? Use one broad synthetic sample that demonstrates the most extensive useful report scope: PR classes, path roles, surfaces, workflow context, caveats, broad-change scope, outlier/sensitivity, methodology, JSON, and CSV evidence.
- [x] How should the sample profile teach users? Use a valid placeholder JSON profile with fake but explanatory values and `notes` fields where supported; add JSONC or first-class comments only if explicitly changing the profile contract.
- [x] Should tutorial/sample mode be part of the published package, or only a repository-local development/tutorial command? Ship it in the published package from `examples/tutorial/` so `npx delivery-friction-analyzer --source sample --out reports/tutorial` works.
- [x] Which machine-readable contract identifies sample versus live runs? Introduce generic `source-bundle.v1` with `source.kind: "sample" | "github"`.
- [x] Should the Conventional Commit preset prompt default change for newly generated profiles? Keep the default as no. Improve copy so users understand that accepting helps when titles usually follow `feat:`, `fix:`, `docs:`, `test:`, `chore(deps):`, or similar Conventional Commit patterns, and that skipping is correct for repositories with other title conventions.
- [x] Should product-repository analysis remain impossible, maintainer-only, or explicitly opt-in? Add an explicit live override that asserts required readable data before collection; do not require maintainer permission unless maintainer-only data is needed.
- [x] Should public docs include screenshots or excerpts from the generated sample report? Include short text excerpts after the sample report exists; defer screenshots until graphs or visual report output exists.

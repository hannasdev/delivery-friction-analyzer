# Tutorial Sample Experience Milestones

## Activation Watchpoints

- Treat the scope budgets as real split triggers during activation and PR prep. If
  M2, M3, or M4 exceeds its stated diff budget, crosses the repo broad-change
  tripwires, or picks up an extra functional surface, split the work or record a
  fresh reviewability rationale before opening a PR.
- Carry the stable sample label `Bundled synthetic sample, not live GitHub data`
  into M3 data review so the sample source bundle does not land with a
  near-equivalent label that M4 later has to churn.
- Before implementing M5, pin the readable-data assertion probes in the
  implementation packet if the final provider calls differ from the planned
  preflight contract below.

## M1: Public Sample And Validation Target Separation

### Outcome

Public docs and CLI copy stop presenting `hannasdev/mcp-writing` as the tutorial path, while preserving it as internal validation context.

### Scope

- Audit public-facing README, help text, and reference docs for `mcp-writing` tutorial language.
- Reframe `mcp-writing` as internal validation or fixture history where it still belongs.
- Update product-repository guard copy to point users toward another target repository now, and toward `--source sample --out reports/tutorial` only after M4 implements it.
- Clarify `--validation-target` help text so users know it marks metadata and does not bypass target validation.
- Add or update focused tests for changed CLI copy where existing tests assert errors or usage.

### Scope Budget

- Primary behavior change: users receive clearer first-run guidance when docs or guardrails mention sample targets.
- Major subsystem boundaries touched: README/reference docs and CLI help/error copy.
- Acceptance criteria count: 4.
- Estimated non-generated diff size: under 500 changed lines.
- Validation shape: docs review plus focused CLI tests where copy is asserted.
- Split rationale: This is the smallest useful cleanup before introducing a new sample source.

### Non-Goals

- Do not remove internal fixture data.
- Do not add sample execution mode yet.
- Do not change target repository validation behavior yet.
- Do not update historical completed initiative records except where a public-facing link is actively misleading.

### Acceptance Criteria

- [ ] README quickstart no longer instructs public users to run `hannasdev/mcp-writing` as the sample tutorial target.
- [ ] Remaining `mcp-writing` references are clearly internal validation, fixture, or historical context.
- [ ] Product-repository rejection tells users why the guard exists and names another-target next step; before M4 it does not point to unavailable sample behavior.
- [ ] `--validation-target` help text no longer sounds like an override for product-repository rejection.

### Required Validation

- `npm run preflight`
- Manual: read README quickstart and CLI `--help` as a first-time user.
- Manual: run a product-repository dry run and inspect the error text.

### Risks / Watchpoints

- Do not churn completed initiative history unnecessarily.
- Keep docs precise about required versus conditional artifacts and `npx` usage.
- Avoid promising sample execution in released copy before M4 implements it. Planning docs may name the approved command.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M2: Generic Source Bundle Contract

### Outcome

The analyzer has a generic `source-bundle.v1` contract that honestly represents both live GitHub evidence and bundled synthetic sample evidence.

### Scope

- Introduce a generic source bundle schema and contract docs for `source-bundle.v1`.
- Define `source.kind` with at least `github` and `sample`.
- Define source, collector, selection, coverage, and pull request evidence fields so both live and sample bundles can validate without pretending sample data is live GitHub evidence.
- Add an explicit `github-source-bundle.v1` to `source-bundle.v1` field mapping covering retained, renamed, generalized, legacy-only, and intentionally removed fields, including retained top-level `coverage.status`, the top-level `coverage.apiFamilies` to `coverage.sourceFamilies` rename, and the retained per-PR coverage object.
- Migrate live source bundle generation and contract tests to emit and validate `source-bundle.v1`.
- Keep compatibility handling for existing `github-source-bundle.v1` fixtures explicit and covered by tests if those fixtures remain readable.
- Update generated artifact labels and methodology inputs that currently assume a GitHub-only source-bundle identity.

### Scope Budget

- Primary behavior change: source bundle provenance becomes generic and truthful before sample data is introduced.
- Major subsystem boundaries touched: source-bundle schema/contract, live collector output, tests, and report/methodology source labels.
- Acceptance criteria count: 8.
- Estimated non-generated diff size: under 900 changed lines.
- Validation shape: schema/collector/report tests plus generated artifact inspection.
- Split rationale: This exceeds the preferred changed-line budget because it is a contract migration. Keeping it separate prevents sample-data work from hiding schema compatibility risks.

### Non-Goals

- Do not add sample execution mode yet.
- Do not change metric formulas or recommendation semantics.
- Do not add arbitrary local source loading.
- Do not silently accept ambiguous source provenance.

### Acceptance Criteria

- [ ] `source-bundle.v1` schema and docs define `source.kind: "github" | "sample"` and generic source/collector/selection/coverage semantics.
- [ ] Contract docs include a field mapping for `schemaVersion`, `collectedAt`, `collector`, `targetRepository`, `repositoryMetadata`, `selection`, retained `coverage.status`, `coverage.apiFamilies` renamed to `coverage.sourceFamilies`, `languageDistribution`, `contributorSource`, `pullRequests`, retained per-PR coverage object, and `raw`.
- [ ] Live GitHub collection emits `source-bundle.v1` with `source.kind: "github"`.
- [ ] Existing live source-bundle tests validate against the new generic contract.
- [ ] Any retained `github-source-bundle.v1` compatibility path is explicit, tested, and documented as legacy.
- [ ] Generated methodology and report source labels no longer rely on a GitHub-only source-bundle identity.
- [ ] Contract docs explain why sample and GitHub sources share the same analyzer contract.
- [ ] No analyzer-owned evidence field from `github-source-bundle.v1` is dropped without an explicit documented removal and test coverage.

### Required Validation

- `node --test test/schema-validation.test.mjs`
- `node --test test/github-collector.test.mjs`
- `node --test test/report.test.mjs`
- `npm run preflight`
- Manual: inspect a generated live source bundle and methodology source labels.

### Risks / Watchpoints

- Contract naming and metadata truthfulness are high-review-sensitivity areas in this repository.
- Keep legacy fixture compatibility honest; do not let old artifact names imply current product contracts.
- Avoid broad generated artifact churn outside source identity and labels.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M3: Deterministic Synthetic Sample Bundle

### Outcome

The repository contains a public-safe, fully synthetic sample repository profile and source data that can generate a representative report without live GitHub access.

### Scope

- Create a fully synthetic placeholder sample repository identity, PR set, source bundle, and profile under `examples/tutorial/`.
- Include realistic but fictional PR titles, file paths, review loops, validation outcomes, PR classes, workflow context, broad-change scope, outlier behavior, partial coverage, and caveats.
- Make the sample broad enough to exercise the most extensive useful report surface: executive summary, focus findings, coverage context, PR class context, workflow context, bottleneck ranking, evidence tables, sensitivity/outliers, methodology, JSON, and CSV evidence.
- Create the sample source bundle as `source-bundle.v1` with `source.kind: "sample"`.
- Make the sample profile educational as a valid placeholder JSON file with fake but explanatory rule IDs, PR classes, path patterns, functional surfaces, workflow choices, and `notes` fields where supported.
- Update repository-profile reference docs to explain valid `notes` usage for file rules and PR class rules.
- Use fictional identity conventions that cannot be mistaken for observed GitHub evidence, such as `example-org/delivery-dashboard`, `https://example.com/pull/123`, and `sample-reviewer-a`.
- Generate or pin expected sample artifacts for tests and documentation excerpts.
- Ensure sample data is labeled as sample/tutorial data in source metadata and generated methodology, using the stable phrase `Bundled synthetic sample, not live GitHub data` where the source bundle, methodology, or generated report needs the canonical user-facing source label.
- Add schema, profile, normalization, metrics, and report tests for the sample bundle.

### Scope Budget

- Primary behavior change: maintainers have public-safe sample data that represents the product without private access.
- Major subsystem boundaries touched: source-bundle/profile sample data and report/schema tests.
- Acceptance criteria count: 11.
- Estimated non-generated diff size: under 900 changed lines, excluding generated golden artifacts if the repo convention treats them separately.
- Validation shape: schema/report golden tests plus manual report inspection.
- Split rationale: This exceeds the 5-criterion preference because public-safety, source metadata, profile education, contract validation, and generated report usefulness are one data-quality gate. Splitting them would let a sample bundle land without enough evidence that it is public-safe, truthful, and usable.

### Non-Goals

- Do not wire the sample bundle into the CLI command yet.
- Do not use private or adapted `mcp-writing` content.
- Do not change scoring or recommendation semantics.
- Do not remove existing `mcp-writing` fixtures.
- Do not introduce arbitrary user-supplied fixture loading.
- Do not add graph generation or screenshots yet.

### Acceptance Criteria

- [ ] Sample source data validates against `source-bundle.v1` with `source.kind: "sample"`.
- [ ] Sample profile demonstrates PR classes, file/path rules, functional surfaces, and workflow context.
- [ ] Sample profile is valid JSON with fake but explanatory placeholder content that users can inspect or copy to infer what belongs in a real profile.
- [ ] Repository-profile reference docs explain valid `notes` usage for file rules and PR class rules.
- [ ] Sample data uses fictional names, URLs, users, and source labels that cannot be mistaken for observed GitHub evidence, including the stable label `Bundled synthetic sample, not live GitHub data` for the sample source bundle source label.
- [ ] Sample data passes a public-safety review: no private repository names, private PR URLs, real user names, tokens, copied private comments, or sensitive file paths.
- [ ] Generated sample report opens with useful findings and clearly labels synthetic sample data.
- [ ] Sample output includes caveats, partial coverage, broad-change scope, and at least one outlier/sensitivity example without overwhelming the first page.
- [ ] Tests cover the sample bundle through schema validation, profile validation, normalization, metrics, and report rendering.
- [ ] Package-content review confirms the sample runtime files are eligible to ship in the published npm package.
- [ ] A short text excerpt suitable for public docs is generated or selected from the sample report.

### Required Validation

- `node --test test/schema-validation.test.mjs`
- `node --test test/profile.test.mjs`
- `node --test test/fixture-normalization.test.mjs`
- `node --test test/report.test.mjs`
- `npm run preflight`
- Manual: inspect generated sample `friction-report.md`, `methodology.md`, JSON, CSV artifacts, and placeholder profile content.

### Risks / Watchpoints

- Synthetic data should remain plausible and boring enough to build trust.
- Sample labels must not be lost in JSON, Markdown, methodology, or CSV artifacts.
- Avoid one-note happy-path output; the sample should teach caveats and evidence boundaries.
- Keep placeholder profile values helpful without turning the profile into prose-heavy documentation.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M4: Explicit Sample CLI Path

### Outcome

Users can run `delivery-friction-analyzer --source sample --out reports/tutorial` to generate the sample report bundle without GitHub credentials, while existing live commands continue to work.

### Scope

- Add the accepted source option: `--source <sample|github>`.
- Require explicit `--source sample` for sample mode.
- When neither `--source` nor live-only target flags are present, fail with friendly source-selection guidance instead of silently defaulting to sample.
- Infer `github` when `--source` is omitted and live-only flags such as `--repo`, `--profile`, or `--limit` are present.
- Route sample mode through the same normalization, metrics, report, and artifact-writing contracts as live analysis.
- Keep sample mode clearly separate from live GitHub collection and dry-run coverage checks.
- Reject live-only flags with `--source sample`, including `--repo`, `--profile`, `--limit`, `--validation-target`, `--interactive`, `--dry-run`, and live-only classification exclusion flags.
- Support relevant existing output options such as `--out`, `--no-csv`, and `--json`.
- Update README and reference docs with the explicit sample-first workflow, a short sample report text excerpt, and the live-analysis next step.
- Include sample runtime data in published package contents so `npx delivery-friction-analyzer --source sample --out reports/tutorial` works.
- Add CLI tests for source resolution, no-source guidance, sample output paths, sample source labels, JSON completion, CSV toggles, invalid flag combinations, inferred live compatibility, and no-network behavior.

### Scope Budget

- Primary behavior change: first-time users can generate a report without private repo access or `gh auth`.
- Major subsystem boundaries touched: CLI command routing and user docs/package contents.
- Acceptance criteria count: 12.
- Estimated non-generated diff size: under 900 changed lines.
- Validation shape: CLI tests, package dry-run validation, docs review, and manual sample smoke test.
- Split rationale: This milestone intentionally keeps source routing, package contents, and README quickstart together because the explicit sample command is only useful when installed users can run it and docs can name the exact entry point. Split if package inclusion requires broader release automation changes or if docs grow beyond quickstart/reference updates.

### Non-Goals

- Do not add arbitrary fixture loading for untrusted local files.
- Do not let sample mode masquerade as dry-run live collection.
- Do not require `gh` or network access for sample mode.
- Do not break existing live command shapes that omit `--source`.
- Do not add product-repository override behavior yet; that is M5.
- Do not add screenshots or graph generation.

### Acceptance Criteria

- [ ] `delivery-friction-analyzer --source sample --out reports/tutorial` writes the expected artifact bundle.
- [ ] Running without `--source` and without live target flags gives source-selection guidance with exact sample and GitHub command examples instead of producing sample output.
- [ ] Existing live invocations with `--repo`, `--profile`, or `--limit` still resolve to GitHub live analysis when `--source` is omitted.
- [ ] Sample command completion points to `friction-report.md` first and uses the stable label `Bundled synthetic sample, not live GitHub data`.
- [ ] Sample report title/opening, methodology source summary, and `source-bundle.json` source label use the same stable sample label.
- [ ] `--json` sample completion is machine-readable and does not mix prompt/progress text into stdout.
- [ ] `--no-csv` works consistently with live analysis artifact behavior.
- [ ] Sample mode does not call `gh` or require network access.
- [ ] Published package contents include the sample runtime data needed by `npx` users.
- [ ] README lets a new user run the explicit sample command first and then transition to analyzing their own repository.
- [ ] README or reference docs include a short text excerpt from the generated sample report, with screenshots deferred.
- [ ] CLI help introduces `--source` without burying the sample path under advanced GitHub flags.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/report.test.mjs`
- `npm run preflight:release`
- `npm run preflight`
- Manual: run the sample command from a clean output directory and open the Markdown report.

### Risks / Watchpoints

- Explicit source mode is clearer but slightly longer; keep first-run copy tight.
- Keep command help concise; source mode should clarify the mental model without turning help into a wall of text.
- Make sample labels visible but not noisy.
- Ensure package contents include any sample data required by `npx` users.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M5: Product-Repository Override

### Outcome

The product repository remains rejected for ordinary live analysis, but users can explicitly opt into product-repository analysis after an early readable-data assertion proves the command can produce a meaningful report.

### Scope

- Add an explicit live-only override, proposed as `--allow-product-repository`.
- Keep product-repository analysis rejected by default.
- Require `--source github` or inferred GitHub source; reject the override in sample mode.
- Before collection or artifact writes, assert GitHub read access for the target repository.
- Assert that required source families are readable enough to produce a trustworthy live report: repository metadata, pull request inventory, and pull request details.
- Preflight should distinguish required probes:
  repository metadata proves the repository is readable; pull request inventory
  proves merged PR listing/search is readable; pull request details proves at
  least one selected PR detail shape needed by collection is readable. Tests
  should mock those probes independently so inventory access and detail access
  can fail separately.
- Treat review threads, workflow runs, languages, contributor source, and PR-open diff as optional coverage families unless implementation later makes one required; otherwise let normal live coverage metadata report partial or unavailable optional families.
- Do not require maintainer permission for public product-repository data unless implementation depends on maintainer-only data.
- Fail closed with actionable copy if required read access cannot be proven.
- Update target-repository contract docs and CLI tests for default rejection, successful preflight shape, and early-exit failure.

### Scope Budget

- Primary behavior change: users gain a deliberate product-repository live-analysis path without changing the public guardrail.
- Major subsystem boundaries touched: target repository validation, GitHub access preflight, CLI help/error copy, and target-repository docs.
- Acceptance criteria count: 10.
- Estimated non-generated diff size: under 750 changed lines.
- Validation shape: unit/CLI tests with mocked access outcomes plus manual dry-run against an accessible repository when possible.
- Split rationale: The override is separated from source-mode sample work because it changes product-boundary semantics rather than first-run sample generation.

### Non-Goals

- Do not make product-repository analysis the public tutorial path.
- Do not allow product-repository analysis without an explicit flag.
- Do not let `--validation-target` bypass product-repository validation.
- Do not present the product-repository guard as a data-security boundary for public repositories.
- Do not require maintainer-only permission unless maintainer-only data is actually needed.
- Do not write partial artifacts when access assertion fails.

### Acceptance Criteria

- [ ] Product-repository live analysis remains rejected by default.
- [ ] `--allow-product-repository` is documented as an explicit live-analysis override, not a tutorial path.
- [ ] The override is rejected in sample mode and does not affect sample output.
- [ ] The CLI performs readable-data assertion before collection and before creating report artifacts.
- [ ] Readable-data assertion requires repository metadata, pull request inventory, and pull request details; optional coverage families remain coverage caveats instead of preflight failures.
- [ ] When required readable-data assertion succeeds, collection proceeds only after that success and optional source families such as review threads, workflow runs, languages, contributor source, and PR-open diff remain ordinary coverage caveats when partial or unavailable.
- [ ] Missing authentication when required, missing repository access, or missing required read access fail closed with actionable messages.
- [ ] Tests cover default rejection, override option parsing, sample-mode rejection, independent failures for repository metadata, pull request inventory, and pull request details, access assertion success, and no-artifacts-on-failure behavior.
- [ ] Target-repository contract docs distinguish ordinary product-repository rejection, validation-target metadata, and the explicit product-repository override.
- [ ] Product-repository guard copy recommends sample or another repository first and mentions `--allow-product-repository` only for intentional self-analysis.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `node --test test/target-repository.test.mjs`
- `npm run preflight`
- Manual: run a product-repository dry run without the override and inspect the guardrail copy.
- Manual, when credentials are available: run the override preflight path once with required readable data available and once with required data unavailable; confirm collection starts only after success and exits before collection on failure.

### Risks / Watchpoints

- Public GitHub data is not protected by this guard; be honest about the guard's product/UX purpose.
- Keep error copy precise so public users do not think the override is a shortcut around sample onboarding.
- Do not conflate ordinary live coverage caveats with required access failure after the initial assertion passes.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## M6: First-Run Profile Prompt Refinements

### Outcome

Interactive setup explains profile choices in a way that helps users avoid the weak all-unknown starter-profile experience seen during testing.

### Scope

- Improve prompt copy around minimal starter profiles, workflow unknowns, and PR class presets.
- Starter-profile copy should make the limitation explicit without sounding broken, for example: `Starter profiles are valid, but until you add rules the report may classify PR classes, file roles, and functional surfaces as unknown.`
- Explain the Conventional Commit preset in user terms before asking for confirmation: it adds title-based `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance` PR class rules when titles usually follow Conventional Commit-style prefixes.
- Keep the Conventional Commit preset default as no.
- Make the skip condition explicit: users should leave the preset off when PR titles use release names, ticket prefixes, free-form titles, or another custom taxonomy that belongs in hand-authored profile rules.
- Explain that accepting the preset improves PR class distribution and reduces `unknown` PR class evidence, but does not change default scoring, ranking formulas, collection, or CSV export shape.
- Make completion output more explicit about what a generated starter profile can and cannot classify yet, for example: `Created a starter profile. Review it before a full run if you want PR classes, file roles, or functional surfaces to be labeled instead of unknown.`
- Keep all prompt changes inside explicit interactive mode.

### Scope Budget

- Primary behavior change: users understand how profile choices affect report interpretation before the first full run.
- Major subsystem boundaries touched: interactive CLI prompt copy and CLI tests.
- Acceptance criteria count: 7.
- Estimated non-generated diff size: under 450 changed lines.
- Validation shape: CLI prompt tests plus manual interactive dry run.
- Split rationale: Prompt copy can be reviewed independently after the sample path exists.

### Non-Goals

- Do not infer path rules from live repository contents.
- Do not silently enable PR class presets without user confirmation.
- Do not change the Conventional Commit preset default from no.
- Do not change report scoring or artifact contracts.
- Do not make interactive setup mandatory.

### Acceptance Criteria

- [ ] New-profile prompts explain that starter profiles are valid but may classify PR classes, roles, or surfaces as unknown until rules are added.
- [ ] Conventional Commit preset prompt names the generated classes: `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance`.
- [ ] Conventional Commit preset prompt explains when to accept it, using examples such as `feat:`, `fix:`, `docs:`, `test:`, `chore(deps):`, or similar title prefixes.
- [ ] Conventional Commit preset prompt explains when to skip it, including repositories that use release titles, ticket prefixes, free-form titles, or another custom PR taxonomy.
- [ ] Conventional Commit preset prompt preserves the default no answer and makes clear that accepting the preset does not change default scoring, rankings, collection, or CSV export shape.
- [ ] Completion output after profile creation points users to inspect or refine the profile before a full run.
- [ ] Tests cover prompt flow changes and generated profile behavior.

### Required Validation

- `node --test test/analyze-github-cli.test.mjs`
- `npm run preflight`
- Manual: run interactive dry-run for a missing profile and inspect prompts plus completion output.

### Risks / Watchpoints

- Avoid turning prompts into documentation walls.
- Do not imply that presets are required or universally correct.
- The prompt should reduce false negatives without creating false confidence; it should make yes feel useful only when the repository's titles genuinely match.
- Keep configured versus observed wording precise.

### Status

- [ ] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

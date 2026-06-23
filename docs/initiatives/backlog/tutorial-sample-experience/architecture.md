# Tutorial Sample Experience Architecture Notes

## Context

The analyzer currently has one primary productized analysis path: live GitHub collection through the CLI, backed by `gh`, repository profiles, normalization, metrics, and report generation. Existing `mcp-writing` fixtures are valuable for tests and internal calibration, but they are not a public tutorial surface because access and meaning are Hanna-specific.

A sample experience needs a clear source boundary: deterministic synthetic data that can exercise the existing report pipeline without pretending to be live GitHub evidence. The product repository also needs a separate explicit live path. The default guard is useful for first-run UX and product-boundary clarity, but it is not a real security boundary for data already visible from a public GitHub repository.

## Current State

- `src/cli/analyze-github.js` requires live-analysis inputs such as `--repo`, `--limit`, `--profile`, and `--out`.
- Live collection uses the `gh` provider and emits source bundle, normalized data, metrics, Markdown, JSON, methodology, and CSV artifacts.
- `schemas/github-source-bundle.schema.json` and source-bundle docs are GitHub-specific today.
- `fixtures/github/mcp-writing/**` provides internal fixture data, profile data, and golden reports.
- Public README quickstart currently points at `hannasdev/mcp-writing`.
- Target repository validation rejects the analyzer's product repository.
- `--validation-target` is metadata; it does not alter product-repository validation.

## Target Shape

Source resolution should choose between explicit sample and live GitHub analysis before collection:

```text
CLI args
  -> resolve source: sample | github | missing
  -> validate source-specific option compatibility
  -> run selected source path or show source-selection guidance
```

Sample analysis should be a local source path that reuses existing downstream contracts:

```text
bundled synthetic sample source bundle/profile
  -> normalize
  -> compute metrics
  -> render report/methodology/CSV
  -> write artifact bundle
```

Live GitHub analysis should remain:

```text
gh provider
  -> collect source bundle
  -> normalize with user profile
  -> compute metrics
  -> render report/methodology/CSV
  -> write artifact bundle
```

Product-repository live analysis should add a pre-collection readable-data gate:

```text
github source + product repo + --allow-product-repository
  -> assert required source data is readable
  -> collect source bundle only if assertion succeeds
  -> normalize/report/write artifacts
```

The source boundary must stay visible. Sample output should carry sample labels in user-facing completion, report, methodology, and machine-readable metadata. Source bundles should validate against a generic `source-bundle.v1` contract with `source.kind` identifying `sample` or `github`.

## Source Resolution Contract

`--source` accepts:

- `sample`
- `github`

Resolution rules:

- If `--source sample` is provided, run sample mode.
- If `--source github` is provided, run live GitHub mode.
- If `--source` is omitted and live-only flags such as `--repo`, `--profile`, or `--limit` are provided, infer `github` for compatibility with existing commands.
- If `--source` is omitted and no live-only target flags are provided, fail with friendly source-selection guidance. Do not silently default to sample.

Sample mode allows output controls such as `--out`, `--json`, and CSV toggles. Sample mode rejects live-only options such as `--repo`, `--profile`, `--limit`, `--validation-target`, `--interactive`, `--dry-run`, and live-only classification exclusion flags.

GitHub mode owns live collection, repository profile input, validation-target metadata, product-repository validation, dry-run behavior, and interactive profile creation.

## Generic Source Bundle Contract

The product contract should move from a GitHub-specific `github-source-bundle.v1` to a generic `source-bundle.v1`. The generic contract should represent analyzer-ready source evidence, not a raw provider dump.

Proposed top-level shape:

```json
{
  "schemaVersion": "source-bundle.v1",
  "source": {
    "kind": "sample",
    "label": "Bundled synthetic sample, not live GitHub data"
  },
  "collector": {},
  "selection": {},
  "coverage": {
    "status": "available",
    "sourceFamilies": []
  },
  "pullRequests": []
}
```

Contract expectations:

- `source.kind` accepts `sample` and `github`.
- `source.label` gives users and generated artifacts a human-readable source description.
- `collector` identifies the collector implementation and provider without implying every source is GitHub-live.
- `selection` explains how the analyzed PR set was chosen, such as latest merged pull requests for GitHub or bundled tutorial sample for sample data.
- `coverage.status` records aggregate coverage over the source-family entries.
- `coverage.sourceFamilies` records source-family status and source labels that can honestly describe live API endpoints or bundled synthetic evidence.
- `pullRequests` remains GitHub-shaped enough for existing normalization and metrics to reuse the same downstream pipeline.
- Existing `github-source-bundle.v1` fixtures may remain only through an explicit legacy compatibility path or migration, covered by tests and docs.

This preserves downstream normalization while making sample provenance machine-readable and reviewable.

### Field Migration Map

| Current `github-source-bundle.v1` field | `source-bundle.v1` treatment |
| --- | --- |
| `schemaVersion` | Rename value to `source-bundle.v1`. |
| `collectedAt` | Retain as materialization timestamp for live and sample bundles. |
| `collector` | Retain and generalize; collector names must not be GitHub-only. |
| new `source` | Add source provenance: `kind`, `label`, and optional source metadata. |
| `targetRepository` | Retain. Sample data uses fictional placeholder target identity. |
| `repositoryMetadata` | Retain. Sample metadata is fictional and clearly synthetic. |
| `selection` | Retain and generalize strategies and source labels. |
| `coverage.status` | Retain as the aggregate coverage status over `coverage.sourceFamilies`; it remains required unless M2 explicitly documents removal, impact, and test coverage. |
| `coverage.apiFamilies` | Rename to `coverage.sourceFamilies`. Preserve the existing coverage-entry shape (`family`, `source`, `status`, `attempts`, `diagnostics`, and `downstreamImpact`) while allowing generalized source labels such as `bundled tutorial sample`, `GitHub REST`, `GitHub GraphQL`, or `unavailable historical snapshot`. |
| `languageDistribution` | Retain with generalized source labels. |
| `contributorSource` | Retain as optional sanitized metadata with generalized source labels. |
| `pullRequests` | Retain GitHub-shaped PR evidence consumed by normalization. |
| `pullRequests[*].coverage` | Retain as the per-PR coverage object rather than moving it into the top-level array. Keep current per-family keys such as `prOpenDiff`, `reviewThreads`, and `workflowRuns`; nested coverage entries should use the same generalized `source` label rules as `coverage.sourceFamilies` where their fields overlap. |
| `raw` | Retain as the only subtree for provider- or sample-specific raw details. |

No analyzer-owned evidence field should be removed as part of the generic contract migration unless M2 documents the exact removal, impact, and test coverage.

## Sample Profile Template

The sample profile is part of the tutorial surface. It should teach users how repository profile rules affect interpretation.

The current repository profile schema is strict JSON and supports `notes` on file rules and PR class rules. The primary sample profile should therefore be a valid placeholder JSON file whose fake content is explanatory enough to imitate:

- rule IDs should name why the rule exists, such as `frontend-ui-paths` or `release-docs`;
- path patterns should look like realistic placeholders, not Hanna-specific paths;
- PR class identifiers should model useful categories rather than generic labels;
- functional surfaces should be fake but domain-shaped;
- workflow fields should show how a real repository owner would encode merge, release, and branch strategy;
- `notes` fields should explain the intent of representative rules without becoming long-form documentation.

A companion guide may explain how to adapt the template, but the JSON template should remain useful when inspected alone.

If implementation adds JSONC support, `$comment`, or first-class profile comments, that must be treated as an explicit repository-profile contract change with schema, parser, docs, and tests. Do not smuggle comments into invalid JSON.

Repository-profile reference docs should explain `notes` as valid optional context on file rules and PR class rules, including that notes help humans understand profile intent but do not change matching, scoring, collection, or report formulas.

## Sample Identity And Labeling Contract

Sample identities must be fictional and visibly synthetic:

- repository identities should use placeholders such as `example-org/delivery-dashboard`;
- URLs should use reserved/example domains such as `https://example.com/pull/123`, not real GitHub URLs;
- users should use synthetic handles such as `sample-reviewer-a`;
- source labels should use bundled labels rather than live API labels unless describing the generic source-family contract.

The stable user-facing label for sample output is:

```text
Bundled synthetic sample, not live GitHub data
```

Use that label in CLI completion, the report title/opening, methodology source summary, and `source-bundle.json` `source.label`.

## Product-Repository Override Contract

Default behavior remains: the product repository is rejected as an ordinary live target.

An explicit live-only override, proposed as `--allow-product-repository`, permits product-repository analysis only after an early readable-data assertion succeeds.

The assertion should happen before collection and before artifact writes. It should require:

- GitHub access sufficient to read repository metadata;
- successful read access to required source families needed for a trustworthy report, including pull request inventory/details;
- clear failure when required read access cannot be proven.

Readable-data assertion matrix:

| Source family | Product-repository override behavior |
| --- | --- |
| Repository metadata | Required; fail before collection if unreadable. |
| Pull request inventory | Required; fail before collection if unreadable. |
| Pull request details | Required; fail before collection if unreadable. |
| Review threads | Optional coverage unless implementation later makes it required. |
| Workflow runs | Optional coverage unless implementation later makes it required. |
| Languages | Optional coverage. |
| Contributor source | Optional and profile-dependent coverage. |
| PR-open diff | Optional historical coverage. |

The assertion should use provider-level probes that are narrow enough to test
independently:

- repository metadata probe: read target repository identity/default metadata;
- pull request inventory probe: list or search merged pull requests for the
  effective selection window;
- pull request details probe: read the detail shape for at least one selected PR
  that collection requires, such as lifecycle fields, files/reviews/check rollup
  availability, or the equivalent provider detail payload.

Mocked tests should be able to fail each required probe independently. A failed
required probe must exit before collector execution and before any artifact or
staging directory is created. Optional families should not participate in the
preflight pass/fail decision unless a later implementation explicitly makes one
required.

For public repositories, maintainer permission is not required unless the implementation depends on maintainer-only data. Optional source families should remain truthful coverage caveats after the assertion passes.

The assertion exists to prevent accidental or misleading product-repository runs, not to hide public GitHub data. `--validation-target` remains metadata and must not bypass product-repository validation. The product-repository override must be rejected in sample mode.

## Documentation Contract

Public docs should lead with:

```sh
delivery-friction-analyzer --source sample --out reports/tutorial
```

Docs should include a short text excerpt from the generated sample report after the sample exists. Screenshots are deferred until graph output or another visual report surface makes screenshots materially useful.

No-source guidance should show exact actions:

```text
Choose what to analyze.

Try the bundled sample:
  delivery-friction-analyzer --source sample --out reports/tutorial

Analyze a GitHub repository:
  delivery-friction-analyzer --source github --repo owner/name --profile path/to/profile.json --out reports/owner-name
```

Product-repository guard copy should recommend the learning path before the override:

```text
This is the analyzer's own product repository, so the CLI does not analyze it by default.

To learn the tool, run the bundled sample:
  delivery-friction-analyzer --source sample --out reports/tutorial

To analyze a different repository, pass --repo owner/name.

If you intentionally want to analyze this product repository, rerun with --allow-product-repository. The CLI will check that required data is readable before writing artifacts.
```

## Interactive PR Class Preset Contract

The Conventional Commit PR class preset remains an opt-in profile-writing shortcut. It should not become a default inference.

The prompt should preserve `defaultValue: false` because PR classes are repository semantics owned by the profile. Accepting the preset is correct when PR titles usually follow Conventional Commit-style prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `chore(deps):`, `fix(deps):`, or `ci:`. In that case, the preset gives the report meaningful PR class distribution and avoids an all-`unknown` class view.

Skipping the preset is correct when the repository uses release titles, ticket prefixes, free-form titles, or a custom taxonomy that does not map cleanly to the six generated classes: `dependency`, `feature`, `fix`, `docs`, `test`, and `maintenance`.

The prompt should state that accepting the preset writes title-based `prClasses` to the repository profile. Those classes affect report interpretation, class distribution, dominance notes, and explicit `--exclude-pr-class` filtering. They do not change default scoring, ranking formulas, GitHub collection, or CSV export shape.

Suggested terminal copy:

```text
Add Conventional Commit PR class rules? [y/N]
Use this if PR titles usually start with feat:, fix:, docs:, test:, chore(deps):, or similar. It groups the report by dependency, feature, fix, docs, test, and maintenance. Skip it for ticket prefixes, release titles, or custom title styles.
```

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Keep `mcp-writing` as internal validation data, not public tutorial data. | It is access-limited and carries product-history context that does not belong in a first-run tutorial. | Delete all `mcp-writing` references; this would damage existing tests and historical validation context. |
| Use a bundled deterministic sample rather than live public repository data for the tutorial. | A tutorial should work without `gh auth`, network access, rate limits, or third-party repository churn. | Pick a public GitHub repo; this would still depend on network/API state and could produce unstable reports. |
| Use fully synthetic sample data. | Synthetic data avoids leaking private repository context and lets the tutorial shape be designed intentionally. | Redact or rename `mcp-writing` history; this still risks private-context leakage and produces a less controlled first-run story. |
| Make the synthetic dataset broad enough to show the most extensive useful report scope. | First-time users need to see the analyzer's real artifact family and evidence boundaries, not a tiny happy path. | Keep the sample minimal; this would be easier to maintain but would not teach the full report. |
| Make the sample profile educational through valid placeholder JSON. | Users can infer what to put in a real profile from fake but explanatory values without requiring invalid JSON comments. | Add JSON comments directly; strict JSON rejects this unless the profile contract changes. Rely mainly on a separate guide; that is less useful when users copy the JSON itself. |
| Ship sample data in the npm package from `examples/tutorial/`. | The sample is only useful for first-time users if `npx delivery-friction-analyzer --source sample --out reports/tutorial` works without a checkout. A final path avoids package allowlist churn. | Keep sample data repo-local; this would help contributors but not package users. |
| Use explicit `--source sample` instead of a sample default. | The command is clearer and avoids surprising automation that omitted live flags by mistake. | Default to sample; friendlier but easier to misunderstand. Add `--tutorial`; easy to explain but less aligned with the source boundary. |
| Infer `github` when existing live flags are present and `--source` is omitted. | Existing commands should not break when source mode is introduced. | Require all live users to add `--source github`; this would create unnecessary migration friction. |
| Introduce generic `source-bundle.v1`. | A contract should describe the analyzer source evidence honestly across live and sample sources. | Stretch `github-source-bundle.v1`; this weakens the contract purpose. Keep sample outside the contract; this makes the tutorial less trustworthy. |
| Reuse the existing report pipeline for sample output. | Users should see the same artifact family and evidence structure they will get from live analysis. | Maintain separate hand-written tutorial Markdown; this would drift from product behavior. |
| Label sample evidence loudly. | Trust depends on distinguishing fictional/placeholder evidence from observed GitHub evidence. | Hide the sample nature for polish; this would misrepresent the source. |
| Add an explicit product-repository override with readable-data assertion. | Public data does not need a maintainer-only fiction, but self-analysis should remain deliberate. | Keep product-repository analysis impossible; this blocks legitimate validation. Require maintainer permission; unnecessary unless maintainer-only data is used. |
| Use text excerpts now and defer screenshots. | Text excerpts are maintainable while reports are mostly text; screenshots become more useful once graphs exist. | Add screenshots immediately; higher maintenance and likely stale before graph output exists. |
| Keep the Conventional Commit preset default as no while improving prompt copy. | The preset can make reports much clearer when titles match, but silently nudging users into a false PR taxonomy would be worse than `unknown` classes. | Default yes; richer first report for matching repositories but higher risk of misleading classes. Remove the prompt; keeps setup shorter but loses a useful shortcut. |

## Contracts And Boundaries

- Source resolution owns `sample` versus `github` selection and option compatibility.
- The generic source-bundle contract owns `source.kind`, source labels, collector identity, selection, coverage, field migration from the current GitHub contract, and analyzer-ready PR evidence.
- Sample source data owns placeholder repository identity, PR data, review/validation evidence, and coverage examples.
- Sample profile owns sample repository semantics such as PR classes, file roles, functional surfaces, workflow context, explanatory placeholder values, and educational notes.
- CLI sample mode owns command routing and package-owned sample loading.
- GitHub mode owns live collection, validation-target metadata, product-repository validation, and product-repository override read assertions.
- Existing normalization, metrics, report, methodology, and artifact writers should own generated output.
- Public docs own the sample-first story, text excerpts, and the transition to live GitHub analysis.
- Internal validation docs/tests may continue to reference `mcp-writing`.

## Migration / Compatibility

Existing live analysis flags should continue to work. If users pass `--repo`, `--profile`, or `--limit` without `--source`, the CLI should infer GitHub mode.

The no-target/no-source case should become friendly guidance, not sample execution.

`source-bundle.v1` should become the generated artifact contract. Existing `github-source-bundle.v1` artifacts may be migrated, retained as legacy fixtures, or supported through an explicit compatibility adapter, but the choice must be documented and tested.

Sample mode is available through `npx`. Sample source data, profile data, optional adaptation guide, and any generated templates required at runtime must live under `examples/tutorial/`, be included in `package.json` files, and be validated with release/package checks.

Existing fixtures and golden reports can remain in place. Public docs should stop presenting them as the first sample users should run.

## Failure Modes

- User omits both `--source` and live target flags: show source-selection guidance and write no artifacts.
- Sample output directory is unwritable: fail before partial artifact writes, using the existing output validation style.
- Sample artifact target already exists: use the same overwrite/protection behavior as live analysis.
- Sample data is missing from the package: fail with a package-integrity style message, not a GitHub access error.
- User passes live-only options with `--source sample`: reject with an actionable message that suggests either removing live flags or using `--source github`.
- User runs live analysis against the product repository without the override: keep rejecting, but point to sample mode, another target repository, or the explicit override.
- User runs product-repository live analysis with the override but required data cannot be read: fail before collection and before artifact writes.
- User expects sample data to represent their own repo: report and methodology labels should make this hard to miss.

## Security / Safety Considerations

- Sample data must be fully synthetic and should not contain private repository names, private PR URLs, real user names, tokens, comments copied from private sources, or sensitive file paths.
- Sample reports are safe to inspect publicly, but generated artifacts should still teach that live reports may contain private repository information.
- Do not add arbitrary local fixture loading without a separate trust-boundary review; user-supplied fixture paths could introduce confusing or sensitive artifact generation.
- Keep GitHub tokens out of sample mode entirely.
- Product-repository override is a product/UX guardrail, not security-by-obscurity. Required read access must still be asserted before collection.

## Validation

- Contract tests for `source-bundle.v1`, including both sample and GitHub source kinds.
- CLI tests proving sample mode does not call `gh`.
- CLI tests for source resolution, no-source guidance, and live-flag compatibility.
- CLI tests for product-repository override readable-data assertion and no-artifacts-on-failure behavior.
- Package dry-run checks proving sample runtime data is included in the published package.
- Manual sample smoke test from a clean checkout or package-like environment.
- Manual review of report and methodology labels for sample-versus-observed clarity.
- Manual docs review for generated report text excerpts.

## Open Questions

- [x] Which command shape best balances discoverability and future source extensibility? Use explicit `--source sample`; do not silently default to sample.
- [x] Should tutorial sample data live under `fixtures/`, `examples/`, or a new package-owned tutorial directory? Use `examples/tutorial/`.
- [x] Which source contract identifies sample/tutorial runs? Use generic `source-bundle.v1` with `source.kind: "sample" | "github"`.
- [x] Should product-repository analysis remain impossible? No. Add an explicit live override with an early readable-data assertion, while keeping default rejection.
- [x] Should public docs include screenshots or excerpts from the generated sample report? Include short text excerpts after the sample report exists; defer screenshots until graphs or visual output exists.

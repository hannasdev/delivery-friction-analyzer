# GitHub Live Collection Architecture Notes

## Context

The existing analyzer has clear downstream contracts: normalized entities feed deterministic metrics, and metrics feed deterministic Markdown and JSON reports. The missing MVP step is the upstream GitHub collection path that turns a configured repository into those contracts.

This architecture note captures how live collection should fit into the existing boundaries without turning the report layer into a GitHub client or making temporary smoke-test scripts the product interface.

## Current State

The repository currently exposes a report command that reads an existing `friction-metrics.v1` file:

```sh
node src/report/generate-report.js --metrics-summary <path> --json-out <path> --markdown-out <path>
```

The repository also exposes a live analysis command that runs collection, normalization, metrics, and reporting in one local workflow:

```sh
node src/cli/analyze-github.js --repo <owner/name> --limit <count> --profile <path> --out <directory>
```

Fixture data for `hannasdev/mcp-writing` exercises normalization, metrics, and reports. The live command uses the versioned collector and existing downstream modules so the temporary `/tmp` smoke-test scripts are no longer the product interface.

The completed Delivery Friction Analyzer architecture already names the intended module boundary:

- GitHub adapter fetches raw GitHub data.
- Normalizer converts provider payloads into stable internal entities.
- Repository profile classifies paths into roles and functional surfaces.
- Metrics engine computes transparent component metrics.
- Reporter renders Markdown and JSON reports.

## Target Shape

Add a live collection path that sits upstream of the existing normalizer:

```text
gh-backed provider
  -> GitHub adapter
  -> source collection bundle
  -> normalizer + repository profile
  -> friction-metrics.v1
  -> friction-report.v1 JSON + Markdown
```

The live collector should be callable from a local CLI and should also be testable as a module. It should not mutate the target repository. It should write artifacts only to a user-selected output directory.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Keep live collection separate from the report renderer. | The report contract stays deterministic from metrics input, and tests can exercise each layer independently. | Make `generate-report.js` fetch GitHub directly, but that would blur input, collection, and rendering concerns. |
| Start with local credentials and local artifacts. | This matches the MVP promise and avoids service, storage, webhook, and installation scope. | Build a hosted GitHub App first, but that expands operational and security scope. |
| Record a source collection bundle before normalization. | Users and tests need traceability when a recommendation looks surprising. | Only emit normalized data, but that makes adapter bugs harder to diagnose. |
| Start with a `gh`-backed adapter behind a provider boundary. | The current local workflow already relies on `gh` authentication, and the temporary live run proved it can fetch the needed REST, GraphQL, PR, and Actions data. A provider boundary keeps the door open for direct HTTP later. | Direct REST/GraphQL calls first, but that would require more auth and transport code before proving the product workflow. Hardwire `gh` throughout the app, but that would make later provider changes noisy. |
| Reuse repository profiles for live data. | Role and surface classification should behave the same for fixtures and live runs. | Infer roles from language or extension, but that violates the repo-source-agnostic product model. |
| Mark PR-open diff growth unavailable for historical live runs unless reconstructed data is implemented. | Simple GitHub PR metadata does not provide direct PR-open diff counts. | Infer growth from merge-time data, but that would create false confidence. |
| Treat branch-based workflow lookup as a sourced approximation. | Actions runs by branch/event are useful but can be noisy for deleted, reused, or bot branches. | Ignore workflow runs entirely, but the 30-PR smoke test showed workflow churn can dominate useful findings. |
| Prefer explicit degraded coverage over hard failure when enough core PR data is available. | Partial reports can still be useful if the missing data is visible. | Fail any time one API family is unavailable, but that makes private repos and limited tokens frustrating. |
| Limit MVP selection to latest-N merged PRs. | It is enough to make the MVP useful and keeps pagination, date filtering, and report calibration focused. | Add `--since` immediately, but date-window semantics can be layered on after latest-N collection is reliable. |

## Contracts And Boundaries

- The GitHub adapter owns provider-specific fetches, pagination, retries, and source labels.
- The source collection bundle owns raw or source-shaped GitHub data plus collection metadata and coverage.
- The normalizer owns conversion from source bundle to stable normalized entities.
- The metrics engine owns formulas and ranking.
- The reporter owns human-readable and machine-readable report presentation.
- Repository profile rules remain explicit inputs; live collection must not bake in `mcp-writing` path assumptions.
- The target repository is always distinct from the product repository running the analyzer.
- Generated artifacts must not contain GitHub tokens or local credential paths.
- Coverage metadata should include:
  - API family attempted;
  - source label such as REST, GraphQL, `gh pr view`, or Actions runs by branch;
  - status such as available, partial, unavailable, or rate_limited;
  - diagnostic message when actionable;
  - downstream metric impact.

## Data And CLI Contracts

The live CLI accepts:

- `--repo <owner/name>`;
- `--limit <number>` for latest merged PRs;
- `--profile <path>`;
- `--out <path>`;
- `--dry-run` or a metadata-only equivalent;
- `--help`.

Likely future options:

- `--since <date>`;
- `--until <date>`;
- `--include-open`;
- `--cache-dir <path>`;
- `--format markdown,json`;
- `--no-raw` or redaction controls for sensitive repositories.

The output directory should contain:

- `source-bundle.json`;
- `normalized.json`;
- `metrics-summary.json`;
- `friction-report.json`;
- `friction-report.md`.

The JSON and Markdown report artifacts include collection coverage caveats from the source bundle. Source bundles, normalized data, metrics summaries, and reports may contain sensitive repository metadata and should be treated as local/private unless intentionally shared.

## Migration / Compatibility

The existing metrics-summary report command should remain supported. Fixture-based tests and golden files should continue to use deterministic local inputs.

Live collection should add a new path into the existing contracts rather than replacing fixture workflows. If the normalized schema evolves to distinguish live bundles from fixture bundles, the version should make that explicit and tests should cover compatibility.

## Failure Modes

- GitHub auth is missing: fail before collection with setup guidance.
- Target repository is malformed or inaccessible: fail before artifact writes when possible.
- Repository metadata or PR inventory cannot be fetched: fail because there is no useful report input.
- Review threads cannot be fetched: continue with review-thread coverage unavailable if PR metadata exists.
- Workflow runs cannot be fetched: continue with final check rollup and workflow coverage unavailable or partial.
- Rate limits occur mid-run: write diagnostics and either stop without complete-looking artifacts or emit a clearly partial source bundle.
- Output directory cannot be written: fail before GitHub collection when possible.
- A branch has many workflow runs: preserve source data and head SHAs so the report can be interpreted or filtered later.
- PR-open diff data is unavailable: mark diff growth unavailable and do not infer from merge-time diff.

## Security / Safety Considerations

- Never write GitHub tokens, auth headers, or credential helper output to artifacts.
- Treat report artifacts as potentially sensitive because they include repository names, PR URLs, titles, file paths, and comment metadata.
- Treat source bundles and normalized data as at least as sensitive as reports because they may contain more complete repository and comment metadata.
- Avoid shelling out with unsanitized user input if a `gh` based adapter is used.
- Validate repository owner/name before building API paths.
- Keep output writes under the user-selected directory and avoid following unsafe path escapes.
- Do not mutate the analyzed repository or create GitHub comments, issues, branches, or PRs.

## Validation

- Unit tests for CLI parsing, target repo validation, output path handling, and coverage status mapping.
- Adapter tests with mocked successful and failed GitHub responses.
- Contract tests that normalize a live-shaped source bundle and compute metrics through existing code.
- Golden tests for report output from a redacted live-shaped fixture.
- Manual smoke test against `hannasdev/mcp-writing` with a larger PR sample.
- Manual inspection of surprising bottlenecks against source bundle evidence.

## Open Questions

- [x] Should the adapter call `gh` or use direct REST/GraphQL HTTP requests first? Use a `gh`-backed adapter first behind a provider boundary.
- [ ] How much retry/backoff is needed for the local MVP?
- [x] Should live collection support date windows in the first milestone or defer them until after latest-N works? Defer date windows until latest-N works.
- [x] Should the primary command live beside `src/report/generate-report.js` or under a dedicated `src/cli/` entry point? Use `src/cli/analyze-github.js`.
- [ ] Should workflow-run filtering use PR head SHAs immediately, or should branch/event lookup ship first with explicit source caveats?
- [ ] Should source bundles be redacted by default for private repositories?

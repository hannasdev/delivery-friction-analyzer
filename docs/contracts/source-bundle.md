# Source Bundle Contract

Schema: `schemas/source-bundle.schema.json`.

`source-bundle.json` is the analyzer's canonical source-evidence artifact. It is
the shared analyzer contract for live GitHub collection and bundled tutorial
sample data, not a raw provider dump. Both source kinds feed the same
normalization, metrics, report, methodology, and CSV pipeline, so they share one
contract with explicit provenance instead of pretending sample evidence is live
GitHub evidence.

The current product contract is `source-bundle.v1`.

## Provenance

Every bundle records the source boundary:

- `schemaVersion`: must be `source-bundle.v1`.
- `source.kind`: `github` for live GitHub evidence or `sample` for bundled
  synthetic sample evidence.
- `source.label`: human-readable label used by generated artifacts where source
  provenance is shown.
- `collector`: collector identity and provider details. Collector names are not
  constrained to a GitHub-only value.

Sample data must use labels that identify it as sample or synthetic evidence.
Live GitHub data should use labels such as `GitHub live collection` and
provider-specific source labels where the evidence came from GitHub APIs or
`gh`.

## Analyzer Evidence

The schema covers collector-owned fields:

- collection metadata, source provenance, target repository, repository
  metadata, PR selection, source-family coverage diagnostics, and language
  distribution context;
- optional sanitized contributor-source metadata: source type, repository path,
  coverage/status diagnostics, and parsed hint count;
- pull request fields consumed downstream: identity, title, author object, URL,
  state, timestamps, refs, final diff counts, PR-open diff source/confidence,
  commits, files, reviews, review threads/comments, status check rollup,
  workflow-run summary, and per-PR coverage.

The schema intentionally preserves unavailable and partial coverage. For
example, unavailable PR-open diff data keeps `source: "unavailable"` and
`confidence: "unavailable"` without inventing additions, deletions, or changed
file counts. Unavailable workflow-run history uses `totalCount: null` rather
than pretending zero runs were observed.

Contributor-source metadata must not persist raw contributor file contents or
parsed login lists. Parsed contributor hints may be used transiently during a
run, but generated artifacts keep only sanitized metadata and `hintCount`.

## Coverage

Top-level `coverage.status` is retained as the aggregate source coverage status.
`coverage.sourceFamilies` lists the source-family entries that make up the
aggregate status. Each entry preserves the existing coverage-entry shape:

- `family`
- `source`
- `status`
- `attempts`
- `diagnostics`
- `downstreamImpact`

The `source` label is generic. Live entries may name GitHub REST, GraphQL, or
`gh` sources; sample entries may name bundled tutorial evidence. The per-PR
`pullRequests[*].coverage` object is retained in place with keys such as
`prOpenDiff`, `reviewThreads`, and `workflowRuns`.

## Field Migration From Legacy GitHub Bundles

`github-source-bundle.v1` is a legacy artifact shape. Current generated bundles
must use `source-bundle.v1`. There is no silent compatibility adapter in the
runtime; legacy artifacts need an explicit migration before they can validate
against the current schema.

| Legacy `github-source-bundle.v1` field | `source-bundle.v1` treatment |
| --- | --- |
| `schemaVersion` | Rename value to `source-bundle.v1`. |
| `collectedAt` | Retained as the materialization timestamp for live and sample bundles. |
| `collector` | Retained and generalized; `collector.name` is no longer constrained to a GitHub-only value. |
| `source` | New required object with `kind`, `label`, and optional metadata. |
| `targetRepository` | Retained. Sample bundles use fictional placeholder repository identity. |
| `repositoryMetadata` | Retained. Sample metadata must be fictional and clearly synthetic. |
| `selection` | Retained and generalized; selection strategies and source labels do not have to be GitHub-only. |
| `coverage.status` | Retained as the aggregate status over `coverage.sourceFamilies`. |
| `coverage.apiFamilies` | Renamed to `coverage.sourceFamilies`; entry shape is preserved. |
| `languageDistribution` | Retained with generalized source labels. |
| `contributorSource` | Retained as optional sanitized metadata with generalized source labels. |
| `pullRequests` | Retained as GitHub-shaped PR evidence consumed by normalization. |
| `pullRequests[*].coverage` | Retained as the per-PR coverage object with current per-family keys. |
| `raw` | Retained as the only subtree for provider- or sample-specific raw details. |

No analyzer-owned evidence field from `github-source-bundle.v1` is intentionally
removed in this migration.

The schema remains strict for analyzer-owned wrapper objects and mapped
entities. It does not attempt to schema every raw provider field, and normal
upstream GitHub API additions should not require schema updates unless the
collector maps them into canonical bundle fields. Future raw or
provider-specific payloads must live under an explicit `raw` subtree so
downstream normalization stays tied to canonical fields.

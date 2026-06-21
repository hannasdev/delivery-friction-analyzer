# Source Bundle Contract

Schema: `schemas/github-source-bundle.schema.json`.

`source-bundle.json` is the analyzer's canonical GitHub collection artifact. It
is source-shaped evidence for later normalization, metrics, reports, and audit
work, but it is not a full GitHub REST or GraphQL API dump.

The `github-source-bundle.v1` schema covers collector-owned fields:

- collection metadata, target repository, repository metadata, latest-merged PR
  selection, API coverage diagnostics, and language distribution context;
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
run, but generated artifacts keep only the sanitized metadata and `hintCount`.

The schema is strict for analyzer-owned wrapper objects and mapped entities. It
does not attempt to schema every raw GitHub field, and normal upstream GitHub API
additions should not require schema updates unless the collector maps them into
the canonical bundle. Future raw or provider-specific payloads must live under
an explicit `raw` subtree so downstream normalization stays tied to canonical
fields.

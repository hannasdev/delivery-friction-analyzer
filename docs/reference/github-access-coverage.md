# GitHub Access And Coverage Matrix

The MVP runs locally with the user's GitHub credentials. Reports must expose unavailable or partial data instead of implying complete coverage.

| API Family | Auth Mode | Minimum Public Repo Access | Minimum Private Repo Access | Used For | Degraded Output |
| --- | --- | --- | --- | --- | --- |
| REST repository metadata | unauthenticated or token | public read | `repo` or fine-grained metadata read | repository visibility, default branch confirmation | mark repository metadata partial |
| REST languages | unauthenticated or token | public read | `repo` or fine-grained contents/metadata read | language byte distribution context | omit language context; do not infer file role from language |
| REST repository contents for configured contributor source | token recommended | public contents read | `repo` or fine-grained contents read | optional `.all-contributorsrc` contributor hints for comment-source classification metadata | mark contributor-source coverage unavailable, malformed, partial, or unsupported; do not infer identities from other sources |
| Pull request metadata | `gh` token / GraphQL-backed PR fields | public read | `repo` or pull request read | lifecycle, final diff shape, files, commits, reviews | mark PR inventory partial |
| REST review comments | token recommended | public read | `repo` or pull request read | individual review comments and comment paths | source breakdown based only on reviews if unavailable |
| GraphQL review threads | token | public read | `repo` or pull request read | thread count, resolved state, outdated state | thread metrics unavailable; comment count can remain REST-only |
| Actions workflow runs | token | public Actions read when enabled | `repo` and Actions read | CI churn and rerun history | final check rollup only; mark churn history partial |
| Check runs per commit | token | public checks read when enabled | `repo` or checks read | check detail by commit SHA | check detail unavailable; retain final status rollup |
| GitHub UI partials | authenticated browser/session or HTTP request | repo page access | repo page access | experimental Copilot severity source | severity source `unavailable` unless explicitly enabled |

## Rate Limits And Missing Scopes

The analyzer should record:

- API family attempted.
- Coverage status: `available`, `partial`, `unavailable`, `malformed`, `unsupported`, or `rate_limited`.
- Required scope or permission when known.
- Impact on downstream metrics.

Missing coverage must flow into report metadata. For example, unavailable GraphQL review threads should disable thread-resolution metrics while preserving REST review-comment counts.

Contributor-source coverage is optional. Missing, inaccessible, malformed, or unsupported contributor files should not fail analysis and should not cause the analyzer to infer private identity data from names, emails, commits, or external services.

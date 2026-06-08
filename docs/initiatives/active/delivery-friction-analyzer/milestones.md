# Delivery Friction Analyzer Milestones

## M1: GitHub Data Inventory And Repo Profile

### Outcome

Establish the GitHub data that is available, reliable, and useful enough to support the first friction report for a configured target repository, using `hannasdev/mcp-writing` only as target fixture data.

### Scope

- Inspect GitHub APIs for pull requests, reviews, review comments, commits, check runs, changed files, and timeline events.
- Define the target repository input contract, including owner/name, analysis window, default branch handling, repository visibility, and how the analyzer distinguishes the product repository from the analyzed repository.
- Fetch and preserve repository language distribution from `GET /repos/{owner}/{repo}/languages`.
- Define a configurable repository profile format, including path rules for core product code, product UI, tests, generated docs, release notes, planning docs, marketing site, config, infrastructure, fixtures, generated/vendored artifacts, and unknown files.
- Determine how to classify review comment source: Copilot, human reviewer, GitHub Actions bot, dependency bot, code scanning, unknown bot.
- Define a GitHub access and coverage matrix for local execution, including authentication mode, minimum public-repo and private-repo permissions, REST coverage, GraphQL coverage, Actions coverage, rate-limit behavior, missing-scope handling, and degraded report output.
- Determine whether Copilot review effort is available as structured metadata.
- Determine whether comment-level severity and confidence/visibility state are available through public APIs, undocumented UI partials, local inference, or should be excluded from MVP scoring.
- Validate which review-thread fields require GraphQL rather than REST.
- Validate whether PR-open diff size can be reconstructed from historical GitHub data or must be marked unavailable/low-confidence until a post-MVP GitHub App snapshot feature exists.
- Define the initial normalized data model for PR lifecycle, diff shape, review feedback, CI checks, and iteration churn.
- Create fixture payloads from the validation target covering exactly four target scenarios when available: low-friction PR, high-review-churn PR, high-CI-churn PR, and broad file-spread PR. One real PR may satisfy multiple scenarios. If the validation target cannot supply a scenario, document the gap and add a minimal synthetic fixture only for schema/metric coverage.

### Non-Goals

- Do not build the full reporting UI or hosted product.
- Do not integrate token or model usage data.
- Do not build advanced profile inference for every product shape; the MVP can rely on explicit profile rules and conservative defaults.
- Do not use unstable vendor severity/confidence labels as primary trend metrics.
- Do not implement GitHub App/webhook snapshot capture for PR-open diffs.

### Acceptance Criteria

- [ ] The repo contains documented GitHub fields used by the analyzer and their API source.
- [ ] The repo contains typed or schema-defined normalized entities for PRs, comments, check runs, commits, and changed files.
- [ ] The target repository input contract is documented and tested separately from the product repository.
- [ ] Repository language distribution is captured and documented as context.
- [ ] The repository profile format can classify file roles without hardcoding assumptions from the validation target repository.
- [ ] The GitHub access and coverage matrix documents auth mode, required scopes, API families, rate-limit behavior, missing data behavior, and degraded report output.
- [ ] Review comments can be grouped by source.
- [ ] The repo contains target-repository fixture data for the four target scenarios, or a documented fixture gap plus a minimal synthetic fixture where real target data is unavailable.
- [ ] Copilot review effort support is documented as available, unavailable, or requiring fallback classification.
- [ ] Comment-level severity and confidence/visibility state are documented as public API, internal UI partial, inferred, unavailable, or excluded from MVP scoring.
- [ ] Review-thread resolution/outdated support is documented with the GraphQL fields required.
- [ ] PR-open diff support is documented as direct, reconstructed, or snapshot-only.

### Required Validation

- Unit validation for normalized fixture parsing.
- Manual: compare normalized fixture output against the original GitHub payloads.

### Risks / Watchpoints

- Copilot review effort metadata may not be available in the expected API shape.
- Copilot severity labels may only be available in undocumented GitHub UI partials unless a stable public API source is found.
- Copilot confidence and hidden-comment threshold data may be unavailable or unstable.
- Copilot UI effort labels may be confused with comment severity unless the product separates review-level effort from finding-level impact.
- Repository language distribution may be confused with file role unless profile rules are applied before risk weighting.
- Timeline and review-thread APIs may require GraphQL rather than REST-only access.
- Branch-based CI churn queries may lose fidelity after PR head branches are deleted.
- Missing scopes, deleted branches, or rate limits may make reports partial; this must be visible in the report coverage metadata.

### Status

- [ ] Not started
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M2: Friction Metrics Engine

### Outcome

Compute the core raw and derived friction metrics from normalized GitHub data using a configurable repository profile.

### Scope

- Implement file categorization for code, tests, docs, config, generated, infrastructure, and unknown files.
- Implement file-role categorization for core product code, product UI, tests, generated docs, release notes, planning docs, marketing site, config, infrastructure, fixtures, generated/vendored artifacts, and unknown files.
- Implement lifecycle, review churn, CI churn, diff growth, and iteration churn metrics.
- Implement comment-source breakdowns.
- Implement changed-file spread, directory spread, functional-surface spread, lines per non-generated file, and small-diff wide-spread flags.
- Implement derived metrics:
  - comment-source density;
  - functional-surface density;
  - iteration drag;
  - diff growth ratio;
  - changed-file spread;
  - validation gap score;
  - planning gap score;
  - review surprise score;
  - fix amplification.
- Produce a machine-readable metrics summary per PR and per repository.
- Emit transparent component metrics first; any composite score must include its component inputs and formula version.

### Non-Goals

- Do not build advanced natural language classification beyond simple rule-based categories.
- Do not implement a general multi-product repository classifier.
- Do not make severity-weighted scoring a primary output while severity comes from unstable vendor UI payloads.
- Do not hide important component metrics behind opaque aggregate scores.
- Do not render a polished dashboard.

### Acceptance Criteria

- [ ] Metrics are computed deterministically from fixtures.
- [ ] Generated or low-signal files can be excluded or down-weighted.
- [ ] Marketing or support-site files can be separated from core product metrics when the repository profile marks them that way.
- [ ] Comment-source metrics distinguish Copilot, human, bot, scanner, and unknown sources.
- [ ] Small diffs across many core files can be flagged after excluding generated and non-core files.
- [ ] Metrics distinguish observed GitHub data from inferred classifications.
- [ ] Any score-like metric exposes its component inputs and formula version.
- [ ] Repository-level summaries can rank PRs by the highest friction categories.

### Required Validation

- Unit tests for each metric formula.
- Fixture tests for repository-level aggregation.
- Golden-file tests for a metrics summary output.

### Risks / Watchpoints

- Some formulas may overfit to line counts and understate complexity in small but risky changes.
- Source breakdowns may be noisy if bot identity is ambiguous.
- Overly complex scoring may be harder to trust than clear component metrics.

### Status

- [ ] Not started
- [x] Implemented
- [x] Conformance reviewed
- [x] Adversarially reviewed
- [x] PR opened
- [x] Merged

## M3: Recommendation Report

Status: Implemented; final lifecycle deferred until PR merge and post-merge initiative-completion.

### Outcome

Generate a useful repository friction report that ranks bottlenecks and maps them to concrete interventions.

### Scope

- Generate a readable report for a configured target repository and time window.
- Include ranked bottlenecks, metric evidence, representative PR examples, comment-source breakdowns, and recommended interventions.
- Produce Markdown and JSON report artifacts.
- Include report coverage metadata for available API families, missing scopes, partial data, rate limits, deleted branches, and PR-open diff reconstruction confidence.
- Support recommendation categories for hooks, preflight scripts, repo-specific AI skills, PR readiness gates, smaller milestones, planning artifacts, and test infrastructure.
- Recommend smaller milestones when a small diff touches many core files, directories, or functional surfaces.
- Explain which findings were excluded or down-weighted because they target generated docs, marketing files, release notes, or other non-core surfaces according to the repository profile.
- Clearly label observed data, inferred diagnosis, and suggested action.

### Non-Goals

- Do not implement a multi-tenant hosted dashboard.
- Do not automate repository changes such as creating hooks or skills.
- Do not rank individual contributors or reviewers.
- Do not make cross-repository comparisons without accounting for review cultures and product surfaces.

### Acceptance Criteria

- [ ] The report identifies the top friction patterns for fixture data.
- [ ] Each recommendation includes evidence and representative PR examples.
- [ ] The report separates Copilot, human, bot, scanner, and unknown comment sources.
- [ ] The report shows which files/surfaces were counted as core product surfaces versus down-weighted support surfaces.
- [ ] The report includes a coverage section that labels unavailable or partial GitHub data.
- [ ] The report has both Markdown and JSON outputs.
- [ ] Reports avoid individual developer ranking by default.
- [ ] Reports can be generated locally for a configured target repository without external services beyond GitHub API access.

### Required Validation

- Golden-file tests for report output.
- Manual: inspect report recommendations against known fixture scenarios.

### Risks / Watchpoints

- Generic recommendations could reduce trust.
- The report must show enough evidence to make suggested interventions feel earned.
- Overemphasizing non-core surfaces such as marketing or generated files could distort the diagnosis.
- Reports can overstate confidence when data is missing; coverage metadata must make partial analysis visible.

### Status

- [ ] Not started
- [x] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

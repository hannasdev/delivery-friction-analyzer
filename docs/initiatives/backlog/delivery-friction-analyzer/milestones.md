# Delivery Friction Analyzer Milestones

## Milestone 1: GitHub Data Inventory

### Outcome

Establish the GitHub data that is available, reliable, and useful enough to support the first friction report.

### Scope

- Inspect GitHub APIs for pull requests, reviews, review comments, commits, check runs, changed files, and timeline events.
- Determine whether Copilot review severity is available as structured metadata.
- Define the initial normalized data model for PR lifecycle, diff shape, review feedback, CI checks, and iteration churn.
- Create fixture payloads for at least three representative PRs.

### Non-Goals

- Do not build the full reporting UI or hosted product.
- Do not integrate token or model usage data.

### Acceptance Criteria

- [ ] The repo contains documented GitHub fields used by the analyzer and their API source.
- [ ] The repo contains typed or schema-defined normalized entities for PRs, comments, check runs, commits, and changed files.
- [ ] The repo contains fixture data covering at least one low-friction PR, one high-review-churn PR, and one high-CI-churn PR.
- [ ] Copilot severity support is documented as available, unavailable, or requiring fallback classification.

### Required Validation

- Unit validation for normalized fixture parsing.
- Manual: compare normalized fixture output against the original GitHub payloads.

### Risks / Watchpoints

- Copilot metadata may not be available in the expected API shape.
- Timeline and review-thread APIs may require GraphQL rather than REST-only access.

### Status

- [x] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## Milestone 2: Friction Metrics Engine

### Outcome

Compute the core raw and derived friction metrics from normalized GitHub data.

### Scope

- Implement file categorization for code, tests, docs, config, generated, infrastructure, and unknown files.
- Implement lifecycle, review churn, CI churn, diff growth, and iteration churn metrics.
- Implement derived metrics:
  - severity-weighted comment density;
  - iteration drag;
  - diff growth ratio;
  - validation gap score;
  - planning gap score;
  - review surprise score;
  - fix amplification.
- Produce a machine-readable metrics summary per PR and per repository.

### Non-Goals

- Do not build advanced natural language classification beyond simple rule-based categories.
- Do not render a polished dashboard.

### Acceptance Criteria

- [ ] Metrics are computed deterministically from fixtures.
- [ ] Generated or low-signal files can be excluded or down-weighted.
- [ ] Metrics distinguish observed GitHub data from inferred classifications.
- [ ] Repository-level summaries can rank PRs by the highest friction categories.

### Required Validation

- Unit tests for each metric formula.
- Fixture tests for repository-level aggregation.
- Golden-file tests for a metrics summary output.

### Risks / Watchpoints

- Some formulas may overfit to line counts and understate complexity in small but risky changes.
- Overly complex scoring may be harder to trust than clear component metrics.

### Status

- [x] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## Milestone 3: Recommendation Report

### Outcome

Generate a useful repository friction report that ranks bottlenecks and maps them to concrete interventions.

### Scope

- Generate a readable report for a selected repository and time window.
- Include ranked bottlenecks, metric evidence, representative PR examples, and recommended interventions.
- Support recommendation categories for hooks, preflight scripts, repo-specific AI skills, PR readiness gates, smaller milestones, planning artifacts, and test infrastructure.
- Clearly label observed data, inferred diagnosis, and suggested action.

### Non-Goals

- Do not implement a multi-tenant hosted dashboard.
- Do not automate repository changes such as creating hooks or skills.

### Acceptance Criteria

- [ ] The report identifies the top friction patterns for fixture data.
- [ ] Each recommendation includes evidence and representative PR examples.
- [ ] Reports avoid individual developer ranking by default.
- [ ] Reports can be generated locally without external services beyond GitHub data ingestion.

### Required Validation

- Golden-file tests for report output.
- Manual: inspect report recommendations against known fixture scenarios.

### Risks / Watchpoints

- Generic recommendations could reduce trust.
- The report must show enough evidence to make suggested interventions feel earned.

### Status

- [x] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged

## Milestone 4: Token And Model Usage Feasibility

### Outcome

Define whether and how model usage data can be joined to GitHub delivery friction.

### Scope

- Identify possible attribution keys: branch, PR number, commit SHA, local session ID, timestamp window, or explicit metadata.
- Define optional model usage entities and metrics.
- Document privacy, trust, and attribution risks.
- Produce a feasibility note for adding token/model analytics after the GitHub-only MVP.

### Non-Goals

- Do not require model usage data for the core report.
- Do not ingest private logs without explicit user consent and clear data boundaries.

### Acceptance Criteria

- [ ] The repo documents feasible and infeasible join strategies.
- [ ] The repo documents model usage metrics that would complement GitHub friction metrics.
- [ ] The repo identifies privacy and attribution risks before implementation.
- [ ] The MVP remains valid without token/model data.

### Required Validation

- Manual: review feasibility against at least one real workflow where branch or PR metadata can link model usage to GitHub.

### Risks / Watchpoints

- Attribution may be too noisy if work spans multiple sessions, models, or branches.
- Token cost can become a distracting metric unless tied to corrective loops or mergeable outcomes.

### Status

- [x] Not started
- [ ] Implemented
- [ ] Conformance reviewed
- [ ] Adversarially reviewed
- [ ] PR opened
- [ ] Merged


# Release Log

## Unreleased

### 2026-06-10 — Report Readability And Evidence Transparency

- What changed: Markdown friction reports now use a clearer reader path with executive summary, evidence-quality coverage, key findings, labeled bottleneck sections, scannable PR evidence tables, methodology summary, guardrails, and artifact-sensitivity guidance.
- Why it matters: Maintainers can distinguish observed data, analyzer interpretation, recommendations, and caveats more quickly before acting on report findings.
- Who is affected: Maintainers and contributors reviewing delivery-friction reports from fixture or live GitHub analysis.
- Action needed: None.
- PR: TBD

### 2026-06-09 — Live Report Calibration

- What changed: Report bottleneck examples now show validation sources, workflow conclusions, review-thread sources, comment-source evidence, and outlier dominance notes, with a redacted 30-PR calibration sample protecting the output shape.
- Why it matters: Maintainers can trust and inspect live report recommendations more easily before turning them into process changes.
- Who is affected: Maintainers and contributors reviewing delivery-friction reports from live GitHub analysis.
- Action needed: None.
- PR: #7

### 2026-06-09 - Local GitHub Analysis Command

- What changed: Added a documented local command that runs live GitHub collection, normalization, metrics, and Markdown/JSON report generation in one workflow.
- Why it matters: Maintainers can now point the analyzer at a GitHub repository and generate the MVP report artifacts without preparing a metrics summary by hand.
- Who is affected: Maintainers and contributors running repository delivery-friction analysis locally.
- Action needed: Authenticate with `gh`, provide a repository profile, and choose a local output directory for generated artifacts.
- PR: #6

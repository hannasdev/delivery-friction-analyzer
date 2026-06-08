# M3 Manual Validation

Date: 2026-06-08

Target fixture: `fixtures/github/mcp-writing/metrics-summary.golden.json`

Generated artifacts:

- `fixtures/github/mcp-writing/reports/friction-report.golden.json`
- `fixtures/github/mcp-writing/reports/friction-report.golden.md`

Local generation command:

```sh
npm run report:fixture
```

## Fixture Scenario Inspection

- Review churn is the top reported bottleneck. PR #239 and PR #221 carry the highest iteration-drag evidence, matching the high-review-churn fixture scenario.
- Changed-file spread is the second reported bottleneck. PR #221 and PR #239 show broad file and surface spread, while PR #223 remains visible as a low-line-count planning-doc example.
- Validation gap is reported with PR #239 as the representative example, matching the fixture workflow interruption signal.
- Comment-source coverage separates Copilot comments from author replies and shows zero human, scanner, dependency-bot, GitHub Actions bot, unknown-bot, and unknown comments for this fixture.
- Surface coverage separates core runtime/test surfaces from low-signal planning, generated docs, and release notes.
- Coverage notes label PR-open diff growth as unavailable and workflow-run data as partially unavailable instead of inferring missing values from merge-time data.
- Recommendations are repository-level workflow suggestions and do not rank contributors or reviewers.

## Lifecycle Note

M3 is the final initiative milestone, but final acceptance and moving the initiative to a done/completed location are deferred until conformance review, adversarial review, PR approval, and merge. This implementation branch only marks M3 as implemented.

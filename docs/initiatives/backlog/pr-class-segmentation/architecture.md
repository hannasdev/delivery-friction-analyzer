# PR Class Segmentation Architecture Notes

## Boundaries

PR class segmentation extends the repository profile concept from changed files to pull requests.

Affected layers:

- repository profile schema and documentation;
- PR class rule matching helper;
- fixture/live normalization;
- metrics pass-through fields;
- CSV and report artifact rendering;
- CLI filtering only in the final milestone if still needed.

The first milestone should add class evidence without changing ranking formulas or default report inclusion.

## Profile Shape

M1 profile extension:

```json
{
  "prClasses": [
    {
      "id": "release-title",
      "class": "release",
      "match": {
        "titleRegex": "^Release\\b"
      }
    }
  ]
}
```

Implementation may choose different field names, but the design should preserve:

- ordered first-match-wins behavior, matching file-role rules;
- explicit rule IDs;
- simple transparent matchers;
- omitted `prClasses` remains valid;
- no global hardcoded release semantics.

Profile validation should reject:

- duplicate `prClasses[].id` values;
- rules with missing or empty `match` objects;
- rules with empty or invalid `class` values;
- invalid regular expressions.

## Matcher Inputs

M1 supports title-only matching:

- `titleRegex`
- `titleIncludes`

Matcher semantics:

- Rules are evaluated in profile order and the first matching rule wins.
- Matching is case-sensitive in M1. Profiles that need case-insensitive matching should use explicit character classes or separate rules; regex flags are a later schema extension if needed.
- `titleIncludes` performs a literal substring match against the PR title.
- `titleRegex` is compiled as a JavaScript regular expression. Invalid regex patterns fail profile validation or analysis preflight with an actionable error naming the rule ID.
- If a rule specifies both `titleRegex` and `titleIncludes`, both must match.
- Empty or missing PR titles are treated as non-matches, then fall through to the fallback class.

Later milestones may add base branch, head branch, labels, or author-source matching when those fields are available with clear coverage semantics. If a desired matcher requires new collection fields, add that field intentionally and update coverage docs. Do not add those matchers in M1 unless title-only matching proves insufficient for the validation target.

## Normalized Shape

Candidate normalized fields:

```json
{
  "prClass": {
    "class": "release",
    "classificationSource": "repository_profile",
    "ruleId": "release-title"
  }
}
```

PR class values are validated free-form identifiers using lower-kebab-case or lower-snake-case. Conventional values are `development`, `release`, `dependency`, and `unknown`, but repositories may define their own labels when needed.

M1 fallback is `unknown` with `classificationSource: "fallback_rule"` and `ruleId: null`. Do not pretend unmatched PRs are ordinary feature work.

## Metrics And Report Strategy

M1 should carry PR class as evidence only:

- no formula changes;
- no ranking changes;
- `pr-metrics.csv` gains class columns;
- JSON metrics include class fields for future report work.

M2 can summarize class distribution:

- count PRs by class;
- changed lines by class;
- representative bottleneck examples by class;
- class concentration notes when displayed examples are dominated by one class.

Class concentration should be phrased as a caveat, not as an instruction to ignore a class. A class is dominant when it contributes more than 50% of the displayed bottleneck example score value; if positive score values are unavailable, use displayed example count. If the dominant class has fewer than 3 PRs in the analyzed sample, include a small-sample caveat.

## Filtering Strategy

Filtering should be explicit and labeled. Candidate option:

```sh
npm run analyze:github -- --repo owner/name --profile profile.json --exclude-pr-class release
```

Filtering should happen before metrics computation in M3 so artifact totals, rankings, methodology, CSVs, and report output are internally consistent. Report-time filtering is a fallback only if metrics-time filtering proves too large during M3 planning.

Filtered artifact boundary:

- `source-bundle.json` remains the full collected sample by default so users can audit what was collected before filtering.
- `normalized.json` should include the filtered PR set by default and include filter metadata naming excluded classes. If implementation keeps a full normalized artifact instead, it must write a clearly named companion such as `normalized-filtered.json` and label downstream artifacts accordingly.
- `metrics-summary.json`, `friction-report.json`, `friction-report.md`, `methodology.md`, and CSV exports are filtered artifacts and must include filter metadata or human-readable labeling.
- CLI success output should say that the report is filtered and name the excluded class or classes.
- If all PRs are filtered out, fail with an actionable message rather than writing complete-looking empty reports.

## Contract Strategy

Profile schema changes are additive because `prClasses` is optional. Normalized, metrics, report, and CSV changes should also be additive unless filtering requires new top-level metadata describing excluded classes.

Filtered outputs should include explicit metadata such as:

```json
{
  "analysisFilter": {
    "excludedPrClasses": ["release"]
  }
}
```

Exact placement can be decided during M3 implementation.

## Failure Modes

- Invalid profile rule: fail profile validation with a clear message.
- No matching class rule: assign fallback class and source.
- Rule references metadata unavailable in a source bundle: either treat as no match with a coverage note or reject the profile if the matcher requires unavailable fields.
- Filter excludes all PRs: fail with an actionable message rather than generating empty complete-looking reports.

## Alternatives Considered

- Hardcode release title detection: rejected because it violates the profile-driven design.
- Only add `pr_class` to CSV: useful but incomplete; normalized and metrics artifacts should carry the same evidence for deterministic tests and future report work.
- Always segment reports by class: likely too noisy for small samples. Start with distribution and dominance context.

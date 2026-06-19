# Repository Profile Format

Repository profiles map paths to file categories, file roles, and functional surfaces before metrics are computed. They can also classify pull requests into repository-specific classes such as `release`, `dependency`, or `unknown`. The same language or PR title pattern can mean different product surfaces in different repositories, so language distribution and PR class assumptions stay in profile data.

Schema: `schemas/repository-profile.schema.json`.

## Categories

- `code`
- `tests`
- `docs`
- `config`
- `generated`
- `infrastructure`
- `unknown`

## Roles

- `core_product_code`
- `product_ui`
- `tests`
- `generated_docs`
- `release_notes`
- `planning_docs`
- `marketing_site`
- `config`
- `infrastructure`
- `fixtures`
- `generated_or_vendored`
- `unknown`

## Rule Matching

Rules are evaluated in order and can match by `exact`, `prefix`, `suffix`, `includes`, or `regex`. The first matching rule wins. If no profile rule matches, the fallback classifier assigns a conservative category from path conventions and leaves the role as `unknown` except for tests.

This keeps validation-target details in profile data rather than hardcoded product assumptions.

## Pull Request Classes

`prClasses` is optional. Rules are evaluated in order and the first matching rule wins. M1 supports title-only matchers:

- `titleIncludes`: literal substring match against the PR title.
- `titleRegex`: JavaScript regular expression matched against the PR title.

If both matchers are present on one rule, both must match. If no rule matches, the normalized PR receives:

```json
{
  "class": "unknown",
  "classificationSource": "fallback_rule",
  "ruleId": null
}
```

Class identifiers are validated as lower-kebab-case or lower_snake_case strings. Profile validation rejects duplicate PR class rule IDs, empty match objects, invalid class identifiers, and invalid title regexes.

Interactive setup can add a release PR class rule from a confirmed title convention using the current title-only matcher shape. Branch strategy answers stay in `workflow` context only; they do not create branch-based PR class matching.

## Workflow Context

`workflow` is optional user-configured context. It records repository workflow assumptions that reports can surface as configured profile context, but the analyzer does not infer these values from GitHub and does not change scoring, rankings, collection, CSV exports, or PR class matching.

When provided, `workflow` must include at least one supported field.

Supported fields:

- `primaryMergeMethod`: `merge_commit`, `squash_merge`, `rebase_merge`, `mixed`, or `unknown`.
- `releaseStrategy`: `release_prs`, `direct_tags`, `release_branches`, `mixed`, or `unknown`.
- `branchStrategy`: `trunk_based`, `main_plus_release_branches`, `long_lived_development_branches`, `mixed`, or `unknown`.

Example:

```json
{
  "workflow": {
    "primaryMergeMethod": "squash_merge",
    "releaseStrategy": "release_prs",
    "branchStrategy": "main_plus_release_branches"
  }
}
```

Use stable identifiers exactly as shown above. Display labels such as "squash merges" or "release PRs" belong in CLI prompts or documentation, not in profile data.

When interactive setup writes profile changes, it preserves deterministic two-space JSON formatting in place. If an existing profile uses other formatting, setup writes a generated profile copy and prints that generated path in completion output instead of rewriting the original file.

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

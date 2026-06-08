# Repository Profile Format

Repository profiles map paths to file categories, file roles, and functional surfaces before metrics are computed. The same language can mean different product surfaces in different repositories, so language distribution is stored as context only.

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

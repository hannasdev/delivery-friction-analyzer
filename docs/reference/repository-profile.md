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

`prClasses` is optional. Rules are evaluated in order and the first matching rule wins. The current profile contract supports title-only matchers:

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

In reports, `unknown` means no configured `prClasses` rule matched that PR title. It is the transparent no-matching-rule fallback, not a collection failure and not an inferred repository taxonomy.

Class identifiers are validated as lower-kebab-case or lower_snake_case strings. Profile validation rejects duplicate PR class rule IDs, empty match objects, invalid class identifiers, and invalid title regexes.

PR class evidence is interpretive and profile-driven. It helps reports show class distributions, dominance notes, and explicit `--exclude-pr-class` filtering when you request filtering, but configured PR class rules do not change default scoring, ranking formulas, collection, or CSV export shape by themselves.

Interactive setup can add a release PR class rule from a confirmed title convention using the current title-only matcher shape. Branch strategy answers stay in `workflow` context only; they do not create branch-based PR class matching. Branch-based class matching is deferred until a future matcher contract supports branch fields explicitly.

### Copyable PR Class Examples

Add one `prClasses` array to the top level of a profile, next to `repository` and `rules`. Keep the rules ordered from most specific to broadest because the first match wins.

Release PRs with titles such as `Release 2026.06.19`:

```json
{
  "prClasses": [
    {
      "id": "release-title",
      "class": "release",
      "match": { "titleRegex": "^Release\\b" }
    }
  ]
}
```

Dependency PRs with Dependabot-style titles and common dependency prefixes:

```json
{
  "prClasses": [
    {
      "id": "dependency-title",
      "class": "dependency",
      "match": { "titleRegex": "^(?:deps!?|(?:build|chore|fix)\\(deps\\)!?):|^Bump\\b" }
    }
  ]
}
```

Conventional Commit-style PR titles. Dependency-scoped rules come first so `chore(deps): ...` and `fix(deps): ...` do not fall through to maintenance or fix classes:

```json
{
  "prClasses": [
    {
      "id": "conventional-dependency",
      "class": "dependency",
      "match": { "titleRegex": "^(?:deps!?|(?:build|chore|fix)\\(deps\\)!?):|^Bump\\b" }
    },
    {
      "id": "conventional-feature",
      "class": "feature",
      "match": { "titleRegex": "^feat(?:\\([^)]+\\))?!?:" }
    },
    {
      "id": "conventional-fix",
      "class": "fix",
      "match": { "titleRegex": "^fix(?:\\((?!deps\\))[^)]+\\))?!?:" }
    },
    {
      "id": "conventional-docs",
      "class": "docs",
      "match": { "titleRegex": "^docs(?:\\([^)]+\\))?!?:" }
    },
    {
      "id": "conventional-test",
      "class": "test",
      "match": { "titleRegex": "^test(?:\\([^)]+\\))?!?:" }
    },
    {
      "id": "conventional-maintenance",
      "class": "maintenance",
      "match": { "titleRegex": "^(refactor|perf|style|build|ci)(?:\\([^)]+\\))?!?:|^chore(?:\\((?!deps\\))[^)]+\\))?!?:" }
    }
  ]
}
```

These examples are starting points, not a universal PR taxonomy. Adjust class names and title patterns to match the repository's own conventions.

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

## Contributor Source

`contributors` is optional user-configured context for structured contributor hints. The first supported source is `.all-contributorsrc` as `all_contributors` JSON. When omitted, analysis runs normally without contributor hints.

Supported fields:

- `sourceType`: optional, defaults to `all_contributors` when `contributors` is present.
- `path`: optional trimmed, slash-delimited repository-relative path, defaults to `.all-contributorsrc`.

Example:

```json
{
  "contributors": {
    "sourceType": "all_contributors",
    "path": ".all-contributorsrc"
  }
}
```

Markdown contributor files such as `CONTRIBUTORS.md` are not supported contributor sources in this milestone. The analyzer records them as unsupported/unparsed coverage when encountered and does not parse Markdown into identities.

Contributor hints may improve repository-level comment-source classification coverage, such as classifying a configured contributor login as an existing human-reviewer source. They do not change scoring formulas, PR authorship conclusions, reviewer attribution, PR class matching, CSV export shape, or individual rankings. Generated artifacts expose only contributor-source metadata such as type, path, status, diagnostics, and parsed hint count; they do not include raw contributor file contents, contributor login lists, or contributor rankings.

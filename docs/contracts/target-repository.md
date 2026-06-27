# Target Repository Input Contract

The product repository is where the analyzer runs. The target repository is the repository being analyzed. They must be modeled separately so the analyzer does not accidentally treat its own repository history as validation data.

## Input And Selection

The local analyzer accepts a target repository and a pull request sample size. Target repository identity and sample selection are separate concepts:

- `owner`: GitHub owner or organization.
- `name`: GitHub repository name.
- `defaultBranch`: expected default branch for merge-base and branch lookup context.
- `visibility`: `public`, `private`, or `unknown`.
- `analysisPullRequestLimit`: latest merged pull request count from 1 to 100, supplied by the live CLI as `--limit`.
- `isValidationTarget`: optional metadata flag for internal validation or fixture-source repositories such as `hannasdev/mcp-writing`. It does not bypass target repository validation.

Schema: `schemas/target-repository.schema.json`. Live analysis selection is latest-N merged pull requests, not a rolling day window.

## Product Repository Separation

The validator rejects a target repository that exactly matches the configured product repository. For this repository, the product repository is `hannasdev/delivery-friction-analyzer`; `hannasdev/mcp-writing` is an internal validation target and fixture source.

Live GitHub analysis enforces this separation before GitHub collection starts. If `--repo` names this tool's product repository, the command fails before provider calls, explains that the guard prevents accidental self-analysis during normal live runs rather than protecting already readable GitHub data, recommends the bundled sample or another repository first, and confirms that no GitHub data was collected.

`--validation-target` only marks output metadata for internal validation or fixture-source runs. It does not bypass product-repository validation and does not change which repository may be analyzed.

`--allow-product-repository` is an explicit live-analysis override for intentional self-analysis of this product repository. It is not the tutorial path and is rejected in sample mode. When the override is present for the product repository, the CLI must prove required GitHub data is readable before collection or artifact writes. Required preflight reads are repository metadata, pull request inventory, and pull request details for at least one selected merged pull request. Review threads, workflow runs, languages, contributor source, and PR-open diff remain normal coverage families; partial or unavailable optional coverage should be reported as caveats after the required assertion succeeds rather than failing the preflight.

The product repository identity is repo-local implementation configuration, not a general public CLI setting.

## Degraded Behavior

If a target repository is private or the token lacks access, the analyzer should report coverage as unavailable or partial instead of silently emitting complete-looking metrics. Missing `defaultBranch` or malformed owner/name input is a hard contract error.

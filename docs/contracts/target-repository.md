# Target Repository Input Contract

The product repository is where the analyzer runs. The target repository is the repository being analyzed. They must be modeled separately so the analyzer does not accidentally treat its own repository history as validation data.

## Input And Selection

The local analyzer accepts a target repository and a pull request sample size. Target repository identity and sample selection are separate concepts:

- `owner`: GitHub owner or organization.
- `name`: GitHub repository name.
- `defaultBranch`: expected default branch for merge-base and branch lookup context.
- `visibility`: `public`, `private`, or `unknown`.
- `analysisPullRequestLimit`: latest merged pull request count from 1 to 100, supplied by the live CLI as `--limit`.
- `isValidationTarget`: optional flag for fixture-source repositories such as `hannasdev/mcp-writing`.

Schema: `schemas/target-repository.schema.json`. Live analysis selection is latest-N merged pull requests, not a rolling day window.

## Product Repository Separation

The validator rejects a target repository that exactly matches the configured product repository. For this repository, the product repository is `hannasdev/delivery-friction-analyzer`; the first validation target is `hannasdev/mcp-writing`.

Live GitHub analysis enforces this separation before GitHub collection starts. If `--repo` names this tool's product repository, the command fails before provider calls, tells you to choose the repository you want to measure with `--repo owner/name`, and confirms that no GitHub data was collected. The product repository identity is repo-local implementation configuration, not a public CLI option.

## Degraded Behavior

If a target repository is private or the token lacks access, the analyzer should report coverage as unavailable or partial instead of silently emitting complete-looking metrics. Missing `defaultBranch` or malformed owner/name input is a hard contract error.

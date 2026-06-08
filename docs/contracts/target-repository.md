# Target Repository Input Contract

The product repository is where the analyzer runs. The target repository is the repository being analyzed. They must be modeled separately so the analyzer does not accidentally treat its own repository history as validation data.

## Input

The local analyzer accepts:

- `owner`: GitHub owner or organization.
- `name`: GitHub repository name.
- `defaultBranch`: expected default branch for merge-base and branch lookup context.
- `visibility`: `public`, `private`, or `unknown`.
- `analysisWindowDays`: rolling analysis window from 1 to 365 days.
- `isValidationTarget`: optional flag for fixture-source repositories such as `hannasdev/mcp-writing`.

Schema: `schemas/target-repository.schema.json`.

## Product Repository Separation

The validator rejects a target repository that exactly matches the configured product repository. For this repository, the product repository is `hannasdev/delivery-friction-analyzer`; the first validation target is `hannasdev/mcp-writing`.

## Degraded Behavior

If a target repository is private or the token lacks access, the analyzer should report coverage as unavailable or partial instead of silently emitting complete-looking metrics. Missing `defaultBranch` or malformed owner/name input is a hard contract error.

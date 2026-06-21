# Release Automation

Delivery Friction Analyzer publishes the unbundled source package to npm. This reference is for maintainers and agents preparing release-related changes; the README stays focused on CLI usage.

## Package Artifact

The npm package allowlist includes:

- runtime source in `src`;
- JSON schemas in `schemas`;
- public contract and reference docs in `docs/contracts` and `docs/reference`;
- the sample repository profile at `fixtures/github/mcp-writing/profile.json`;
- `LICENSE`;
- `README.md`;
- `release-log.md`.

Generated reports, tests, initiative docs, and calibration fixtures are intentionally excluded from the npm artifact.

## CI

The CI workflow runs on pull requests and pushes to `main`.

It validates:

- `npm ci`;
- `npm test`;
- `npm pack --dry-run`.

CI runs on Node 20 and Node 24 so the advertised `engines.node >=20` floor is exercised before release.

## Local Preflight

For ordinary PRs, run `npm run preflight` before opening or updating review. It runs the full local test suite and `git diff --check` so whitespace issues are caught against the current working tree.

For release automation, package metadata, package contents, or publish workflow changes, run `npm run preflight:release`. It runs the focused release-versioning tests, including direct CLI entrypoint coverage, validates the package version is not behind an equal latest tag, and runs `npm pack --dry-run`.

## Release Workflow

The release workflow runs on pushes to `main` and skips commits whose subject starts with `Release `.

It:

- validates that `RELEASE_DEPLOY_KEY` is configured;
- checks out the repository with full tag history and the deploy key;
- validates that the package version is not behind the latest `v*` tag;
- determines the next semantic version from conventional commits since the latest `v*` tag;
- runs tests;
- bumps `package.json` and `package-lock.json`;
- commits the version bump;
- creates a matching `vX.Y.Z` tag;
- pushes the release commit and tag atomically;
- creates a GitHub release with generated notes.

`RELEASE_DEPLOY_KEY` must contain a private SSH key whose public key is configured as a write-enabled repository deploy key.

## Publish Workflow

The publish workflow runs on `v*.*.*` tags and can also be started manually.

Tag-triggered runs:

- verify that the package is not private;
- verify that the Git tag matches the package version;
- infer `next` for prerelease versions and `latest` for stable versions;
- skip versions already published on npm;
- run `npm pack --dry-run`;
- publish the package to npm.

Manual `workflow_dispatch` runs are dry-run only. They use the selected npm dist-tag and execute `npm publish --dry-run`; real publishes require pushing a matching version tag.

Configure npm trusted publishing for this repository before relying on tag-triggered publish.

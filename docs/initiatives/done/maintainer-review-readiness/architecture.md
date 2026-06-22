# Maintainer Review Readiness Architecture Notes

## Context

The baseline self-analysis report found clean CI but repeated automated review loops. The highest-value architecture decision is therefore not to add more runtime analytics immediately, but to move repository-specific expectations to the boundaries where they belong:

- repository profile data for classification assumptions;
- local npm scripts for repeatable validation;
- repo guidance for implementation and review readiness;
- durable planning evidence for recurring review themes.

This initiative changes maintainer workflow contracts. Product-facing review-theme artifacts are intentionally deferred to a separate initiative so this work can stay focused on local readiness.

## Current State

The repository currently has:

- a committed M1 self-profile at `profiles/delivery-friction-analyzer.json`, promoted from the local draft used during planning;
- `npm test`, `npm run preflight`, and `npm run preflight:release` as named local validation scripts;
- CI workflows that run tests and package dry-run validation;
- release and publish workflows documented in `docs/reference/release-automation.md`;
- initiative planning docs under `docs/initiatives/**`;
- a root `AGENTS.md` guidance file for repo-local maintainer and agent review readiness;
- report artifacts that count comment sources but do not include review comment bodies or theme summaries.

The current data flow remains:

```text
GitHub provider -> source bundle -> normalized entities -> metrics summary -> report artifacts
```

Maintainer workflow still sits outside that data flow, but recurring review expectations now have a repo-local guidance home instead of living only in PR comments, chat history, and individual practice.

## Target Shape

After the initiative:

- self-analysis uses a meaningful repository profile for path roles, surfaces, and PR classes;
- maintainers and agents have named local validation commands for ordinary and release/package changes;
- repo guidance defines review-readiness expectations for known hotspot surfaces;
- broad changes use split-or-justify tripwires before review;
- durable planning docs preserve the baseline review-theme evidence that guidance is based on.

The analyzer should remain repository-agnostic. Repository-specific workflow expectations should not leak into metrics code except as ordinary profile input.

## Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Start with self-profile quality. | Current reports cannot classify PR classes or surfaces, weakening every follow-up decision. | Add readiness gates first; rejected because future measurement would remain too coarse. |
| Treat readiness gates as tripwires. | The report shows recurring broad-change risk, but small fixes should stay lightweight. | Mandatory approval gate for all PRs; rejected as too heavy for this repo. |
| Prefer npm scripts for local preflight. | The repo is a Node CLI, CI already uses npm commands, and scripts are discoverable. | Git hooks first; deferred because hooks add local setup friction and the report did not show local formatting failures as the primary signal. |
| Put recurring implementation expectations in repo guidance. | Copilot review comments are catching stable repo expectations after PR open. | Rely on chat history or PR comments; rejected because they are not durable. |
| Defer product-facing comment-theme artifacts. | Comment bodies explain churn, but they are more sensitive than aggregate counts and need a product artifact contract. | Include review-theme artifact work here; rejected to keep this initiative maintainer-focused and activation-ready. |
| Keep generic profile-suggestion rendering out of this initiative. | Setup-report-usability work already owns report suggestions for generic profile gaps. | Merge the work here; rejected to avoid duplicate user-facing report text. |

## Contracts And Boundaries

- `profiles/delivery-friction-analyzer.json` owns repo-specific path classification, roles, generated status, functional surfaces, workflow context, and title-based PR classes.
- `package.json` owns named local validation scripts. Scripts should compose existing commands and avoid mutating repository state except through normal test outputs.
- Root repo guidance, if added, owns maintainer and agent expectations for broad-change readiness, validation command selection, and recurring review themes.
- Release automation docs own maintainer-facing release and publish workflow detail.
- Planning docs own the summarized baseline review-theme evidence used by M3 guidance. They should not preserve raw review comment bodies.
- Metrics code must not special-case this repository's maintainer workflow.

## Migration / Compatibility

M1 profile changes are backward compatible with existing report generation because repository profiles already support rules, surfaces, workflow context, and PR classes.

M2 script changes should preserve `npm test` as the stable validation command used by CI and contributors. New scripts can be additive.

M3 guidance changes should not require external tooling. They should help future agents and contributors without changing package output.

Review-theme artifacts are deferred. If a future product initiative adds structured comment-theme data, generated artifacts and methodology must version or document the new output without breaking existing CSV consumers.

## Failure Modes

- Profile rule is too broad: generated, fixture, or docs files may be classified into the wrong surface. Mitigation: order specific rules before broad rules and inspect the next report.
- Preflight script becomes too slow: maintainers may stop running it. Mitigation: keep ordinary and release/package preflights separate.
- Guidance becomes too long: agents may ignore it. Mitigation: keep root guidance short and push detail to reference docs only when needed.
- Tripwires become rigid thresholds: useful broad changes could be delayed. Mitigation: require split-or-justify, not automatic rejection.
- Baseline review-theme summaries become stale: guidance could overfit old comments. Mitigation: keep categories short and tie them to broad review checks rather than one-off wording.

## Security / Safety Considerations

- Do not store secrets, tokens, local paths outside the repository, or npm credentials in report artifacts or guidance.
- `npm pack --dry-run` and release preflight commands must not publish, tag, or push.
- Planning docs should avoid raw review-comment text because PR comments can include repository names, URLs, file paths, and discussion context.
- Repo guidance should not encourage destructive git commands as routine workflow.

## Validation

- Profile and schema tests for profile changes.
- `npm test` remains the baseline full-suite validation.
- `git diff --check` for whitespace-sensitive docs and generated artifacts.
- `npm pack --dry-run` for release/package changes.
- Manual inspection of the next self-analysis report for meaningful class and surface distributions.

## Open Questions

- [ ] Future decision: Should root repo guidance be enough, or should a dedicated Codex skill be created after the guidance stabilizes?

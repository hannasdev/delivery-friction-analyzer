import {
  DEFAULT_PRODUCT_REPOSITORY,
  isProductRepositoryTarget,
  productRepositoryTargetError,
  validateTargetRepository,
} from "../contracts/target-repository.js";
import {
  assertValidContributorSource,
  normalizeContributorSourceConfig,
  parseAllContributorsHints,
  withTransientContributorHints,
} from "../profile/contributor-source.js";
import {
  COVERAGE_STATUS,
  classifyCoverageStatus,
  coverageEntry,
  mergeCoverageEntries,
  redactDiagnostic,
} from "./coverage.js";

export const SOURCE_BUNDLE_VERSION = "source-bundle.v1";

const REPOSITORY_SLUG = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
function parseRepositoryInput(input) {
  if (typeof input === "string") {
    const match = input.match(REPOSITORY_SLUG);
    if (!match) {
      throw new Error("repository must use owner/name with GitHub-safe owner and name segments.");
    }
    return { owner: match[1], name: match[2] };
  }

  if (input && typeof input === "object") {
    return { owner: input.owner, name: input.name };
  }

  throw new Error("repository must be an owner/name string or an object with owner and name.");
}

function requirePullRequestLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("PR sample limit must be an integer between 1 and 100.");
  }
}

function visibilityOf(repository) {
  if (repository.visibility === "public" || repository.private === false) return "public";
  if (repository.visibility === "private" || repository.private === true) return "private";
  return "unknown";
}

function mapTargetRepository({ owner, name, repositoryMetadata, analysisPullRequestLimit, isValidationTarget, productRepository, allowProductRepository }) {
  const targetRepository = {
    owner,
    name,
    defaultBranch: repositoryMetadata.default_branch ?? repositoryMetadata.defaultBranch ?? "main",
    visibility: visibilityOf(repositoryMetadata),
    analysisPullRequestLimit,
    isValidationTarget,
  };
  const errors = validateTargetRepository(targetRepository, { productRepository, allowProductRepository });
  if (errors.length > 0) {
    throw new Error(`collected target repository metadata is invalid: ${errors.join(" ")}`);
  }
  return targetRepository;
}

function formatReadableDataFailure({ repository, family, action, error }) {
  const diagnostic = redactDiagnostic(error?.message ?? error);
  return `Cannot analyze ${repository} with --allow-product-repository because required GitHub read access could not be proven for ${family}. ${action}. Required preflight must read repository metadata, pull request inventory, and pull request details before collection or artifact writes.${diagnostic ? ` GitHub response: ${diagnostic}` : ""}`;
}

async function requireReadableProbe({ repository, family, action, run }) {
  try {
    return await run();
  } catch (error) {
    throw new Error(formatReadableDataFailure({
      repository,
      family,
      action,
      error,
    }));
  }
}

export async function assertProductRepositoryReadableData({
  repository,
  owner,
  name,
  limit,
  provider,
  productRepository = DEFAULT_PRODUCT_REPOSITORY,
} = {}) {
  if (!provider) {
    throw new Error("provider is required.");
  }
  requirePullRequestLimit(limit);
  const targetInput = repository ? parseRepositoryInput(repository) : { owner, name };
  if (!isProductRepositoryTarget(targetInput, productRepository)) {
    return { requiredFamilies: [] };
  }

  const repositoryLabel = `${targetInput.owner}/${targetInput.name}`;
  await requireReadableProbe({
    repository: repositoryLabel,
    family: "repository metadata",
    action: "Authenticate with GitHub CLI or choose a repository your token can read",
    run: () => provider.getRepository(targetInput),
  });

  const inventory = await requireReadableProbe({
    repository: repositoryLabel,
    family: "pull request inventory",
    action: "Ensure `gh pr list --repo owner/name` can list merged pull requests",
    run: () => provider.listMergedPullRequests({ ...targetInput, limit }),
  });
  if (!Array.isArray(inventory)) {
    throw new Error(`Cannot analyze ${repositoryLabel} with --allow-product-repository because required GitHub read access could not be proven for pull request inventory. GitHub returned an unreadable pull request inventory shape. Required preflight must read repository metadata, pull request inventory, and pull request details before collection or artifact writes.`);
  }
  const selectedInventory = [...inventory]
    .sort((left, right) => String(right.mergedAt ?? "").localeCompare(String(left.mergedAt ?? "")))
    .slice(0, limit);
  const firstPullRequest = selectedInventory[0];
  if (!firstPullRequest?.number) {
    throw new Error(`Cannot analyze ${repositoryLabel} with --allow-product-repository because required GitHub read access could not be proven for pull request details. The pull request inventory returned no merged pull requests to inspect. Choose another repository or rerun after merged pull requests are readable.`);
  }

  await requireReadableProbe({
    repository: repositoryLabel,
    family: "pull request details",
    action: "Ensure `gh pr view --repo owner/name <number> --json ...` can read merged pull request details",
    run: () => provider.getPullRequest({ ...targetInput, number: firstPullRequest.number }),
  });

  return {
    requiredFamilies: [
      "repository_metadata",
      "pull_request_inventory",
      "pull_request_details",
    ],
    probedPullRequestNumber: firstPullRequest.number,
  };
}

function mapRepositoryMetadata(repository) {
  return {
    id: repository.id ?? null,
    name: repository.name ?? null,
    owner: repository.owner?.login ?? repository.owner?.name ?? null,
    fullName: repository.full_name ?? repository.fullName ?? null,
    defaultBranch: repository.default_branch ?? repository.defaultBranch ?? null,
    visibility: visibilityOf(repository),
    isPrivate: repository.private ?? null,
    htmlUrl: repository.html_url ?? repository.url ?? null,
  };
}

function mapCommit(commit) {
  return {
    oid: commit.oid ?? commit.sha ?? commit.commit?.oid ?? commit.commit?.sha ?? null,
    authoredDate: commit.authoredDate ?? commit.commit?.author?.date ?? null,
    committedDate: commit.committedDate ?? commit.commit?.committer?.date ?? null,
    messageHeadline: commit.messageHeadline ?? commit.commit?.message?.split("\n")[0] ?? null,
  };
}

function mapReview(review) {
  const id = review.id ?? review.databaseId;
  return {
    id: id == null ? null : String(id),
    author: review.author ?? null,
    submittedAt: review.submittedAt ?? review.submitted_at ?? null,
    state: review.state ?? null,
    commitOid: review.commitOid ?? review.commit?.oid ?? null,
    generatedCommentCount: review.generatedCommentCount ?? null,
    failedAttempt: Boolean(review.failedAttempt),
  };
}

function mapReviewThreads(threads) {
  let truncatedCommentThreads = 0;
  const nodes = (threads.nodes ?? []).map(thread => ({
    id: thread.id,
    isResolved: Boolean(thread.isResolved),
    isOutdated: Boolean(thread.isOutdated),
    path: thread.path ?? null,
    line: thread.line ?? null,
    comments: (thread.comments?.nodes ?? thread.comments ?? []).map(comment => ({
      databaseId: comment.databaseId ?? comment.id ?? null,
      author: comment.author ?? null,
      path: comment.path ?? thread.path ?? null,
      line: comment.line ?? null,
      originalLine: comment.originalLine ?? null,
      createdAt: comment.createdAt ?? null,
      updatedAt: comment.updatedAt ?? null,
      url: comment.url ?? null,
    })),
  }));

  for (const thread of threads.nodes ?? []) {
    if (thread.comments?.pageInfo?.hasNextPage) {
      truncatedCommentThreads += 1;
    }
  }

  return {
    reviewThreads: {
      source: "graphql:repository.pullRequest.reviewThreads",
      totalCount: threads.totalCount ?? nodes.length,
      nodes,
    },
    truncatedCommentThreads,
  };
}

function unavailableReviewThreads() {
  return {
    source: "unavailable",
    totalCount: 0,
    nodes: [],
  };
}

function mapStatusCheck(check) {
  return {
    __typename: check.__typename ?? check.type ?? "CheckRun",
    name: check.name ?? null,
    context: check.context ?? null,
    workflowName: check.workflowName ?? check.workflow?.name ?? null,
    status: check.status ?? check.state ?? null,
    conclusion: check.conclusion ?? check.state ?? null,
    startedAt: check.startedAt ?? null,
    completedAt: check.completedAt ?? null,
  };
}

function summarizeConclusions(workflowRuns = []) {
  const conclusions = {};
  for (const run of workflowRuns) {
    const conclusion = String(run.conclusion ?? run.status ?? "unknown").toLowerCase();
    conclusions[conclusion] = (conclusions[conclusion] ?? 0) + 1;
  }
  return conclusions;
}

function mapWorkflowRuns(data) {
  const workflowRuns = data.workflow_runs ?? data.workflowRuns ?? [];
  return {
    source: "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
    totalCount: data.total_count ?? data.totalCount ?? workflowRuns.length,
    conclusions: summarizeConclusions(workflowRuns),
    runs: workflowRuns.map(run => ({
      id: run.id ?? null,
      name: run.name ?? null,
      workflowName: run.workflow_name ?? run.workflowName ?? run.name ?? null,
      headSha: run.head_sha ?? run.headSha ?? null,
      headBranch: run.head_branch ?? run.headBranch ?? null,
      event: run.event ?? null,
      status: run.status ?? null,
      conclusion: run.conclusion ?? null,
      createdAt: run.created_at ?? run.createdAt ?? null,
      updatedAt: run.updated_at ?? run.updatedAt ?? null,
      runStartedAt: run.run_started_at ?? run.runStartedAt ?? null,
      htmlUrl: run.html_url ?? run.url ?? null,
    })),
  };
}

function unavailableWorkflowRuns() {
  return {
    source: "unavailable",
    totalCount: null,
    conclusions: {},
    runs: [],
  };
}

function isMarkdownContributorPath(path = "") {
  return /\.(md|mdx|markdown)$/i.test(String(path));
}

function unsupportedContributorSource(config = {}) {
  const sourceType = config.sourceType ?? "unknown";
  const path = config.path ?? null;
  const diagnostic = path && isMarkdownContributorPath(path)
    ? `Contributor source path '${path}' is a Markdown file; Markdown contributor files are intentionally not parsed in this milestone.`
    : `Contributor source type '${sourceType}' is unsupported.`;
  const coverage = coverageEntry({
    family: "contributor_source",
    source: "rest:/repos/{owner}/{repo}/contents/{path}",
    status: COVERAGE_STATUS.unsupported,
    diagnostics: [diagnostic],
    downstreamImpact: "Contributor-aware comment-source hints are unavailable; scoring and person-level outputs are unchanged.",
  });
  return withTransientContributorHints({
    sourceType,
    path,
    coverage,
  });
}

function unavailableContributorSource(config = {}, error) {
  const coverage = coverageEntry({
    family: "contributor_source",
    source: "rest:/repos/{owner}/{repo}/contents/{path}",
    status: classifyCoverageStatus(error),
    diagnostics: [redactDiagnostic(error?.message ?? error)],
    downstreamImpact: "Contributor-aware comment-source hints are unavailable; scoring and person-level outputs are unchanged.",
  });
  return withTransientContributorHints({
    sourceType: config.sourceType,
    path: config.path,
    coverage,
  });
}

function contentTextFromResponse(response) {
  if (typeof response === "string") return response;
  if (response && typeof response.content === "string" && response.encoding === "base64") {
    return Buffer.from(response.content.replace(/\s+/g, ""), "base64").toString("utf8");
  }
  if (response && typeof response.content === "string") {
    return response.content;
  }
  throw new Error("GitHub content response did not include readable file content.");
}

async function collectContributorSource({ targetInput, provider, contributors }) {
  if (contributors == null) return null;
  assertValidContributorSource({ contributors });
  const config = normalizeContributorSourceConfig(contributors);
  if (!config) return null;
  if (config.sourceType !== "all_contributors" || isMarkdownContributorPath(config.path)) {
    return unsupportedContributorSource(config);
  }
  if (typeof provider.getRepositoryContent !== "function") {
    return unavailableContributorSource(config, new Error("provider does not support repository content collection."));
  }

  try {
    const response = await provider.getRepositoryContent({ ...targetInput, path: config.path });
    const parsed = parseAllContributorsHints(contentTextFromResponse(response));
    const coverage = coverageEntry({
      family: "contributor_source",
      source: "rest:/repos/{owner}/{repo}/contents/{path}",
      status: parsed.status,
      diagnostics: parsed.diagnostics,
      downstreamImpact: parsed.status === COVERAGE_STATUS.available || parsed.status === COVERAGE_STATUS.partial
        ? "Contributor-aware comment-source hints are available; scoring and person-level outputs are unchanged."
        : "Contributor-aware comment-source hints are unavailable; scoring and person-level outputs are unchanged.",
    });
    return withTransientContributorHints({
      sourceType: config.sourceType,
      path: config.path,
      coverage,
    }, parsed.hints);
  } catch (error) {
    return unavailableContributorSource(config, error);
  }
}

function mapPullRequestDetails(details) {
  return {
    number: details.number,
    title: details.title,
    author: details.author ?? null,
    url: details.url,
    state: details.state,
    createdAt: details.createdAt ?? null,
    mergedAt: details.mergedAt ?? null,
    updatedAt: details.updatedAt ?? null,
    baseRefName: details.baseRefName ?? null,
    headRefName: details.headRefName ?? null,
    headRefOid: details.headRefOid ?? null,
    additions: details.additions ?? 0,
    deletions: details.deletions ?? 0,
    changedFiles: details.changedFiles ?? 0,
    prOpenDiff: {
      source: "unavailable",
      confidence: "unavailable",
      reason: "Historical PR-open diff data is not available from the M1 live collector.",
    },
    commits: (details.commits ?? []).map(mapCommit),
    files: (details.files ?? []).map(file => ({
      path: file.path ?? file.filename ?? null,
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      changeType: file.changeType ?? file.status ?? null,
    })),
    reviews: (details.reviews ?? []).map(mapReview),
    reviewThreads: unavailableReviewThreads(),
    statusCheckRollup: (details.statusCheckRollup ?? []).map(mapStatusCheck),
    workflowRuns: unavailableWorkflowRuns(),
    coverage: {
      prOpenDiff: coverageEntry({
        family: "pr_open_diff",
        source: "historical_snapshot",
        status: COVERAGE_STATUS.unavailable,
        diagnostics: ["PR-open diff snapshots are unavailable in M1; final merge diff is kept separately."],
        downstreamImpact: "Diff growth metrics must remain unavailable.",
      }),
    },
  };
}

async function attempt({ family, source, downstreamImpact, run }) {
  try {
    const value = await run();
    return {
      value,
      coverage: coverageEntry({
        family,
        source,
        status: COVERAGE_STATUS.available,
        downstreamImpact,
      }),
    };
  } catch (error) {
    return {
      value: null,
      coverage: coverageEntry({
        family,
        source,
        status: classifyCoverageStatus(error),
        diagnostics: [redactDiagnostic(error?.message ?? error)],
        downstreamImpact,
      }),
    };
  }
}

export function buildCoverageSummary(entries) {
  const statuses = new Set(entries.map(entry => entry.status));
  if (statuses.has(COVERAGE_STATUS.rateLimited)) return COVERAGE_STATUS.rateLimited;
  if (statuses.size === 1 && statuses.has(COVERAGE_STATUS.unavailable)) return COVERAGE_STATUS.unavailable;
  if (statuses.size === 1 && statuses.has(COVERAGE_STATUS.unsupported)) return COVERAGE_STATUS.unsupported;
  if (statuses.size === 1 && statuses.has(COVERAGE_STATUS.malformed)) return COVERAGE_STATUS.malformed;
  if (
    statuses.has(COVERAGE_STATUS.unavailable)
    || statuses.has(COVERAGE_STATUS.partial)
    || statuses.has(COVERAGE_STATUS.unsupported)
    || statuses.has(COVERAGE_STATUS.malformed)
  ) return COVERAGE_STATUS.partial;
  return COVERAGE_STATUS.available;
}

export async function collectGitHubSourceBundle({
  repository,
  owner,
  name,
  limit,
  provider,
  collectedAt = new Date().toISOString(),
  analysisPullRequestLimit,
  isValidationTarget = false,
  contributors = null,
  productRepository = DEFAULT_PRODUCT_REPOSITORY,
  allowProductRepository = false,
} = {}) {
  if (!provider) {
    throw new Error("provider is required.");
  }
  const targetPullRequestLimit = analysisPullRequestLimit ?? limit;
  requirePullRequestLimit(targetPullRequestLimit);
  const targetInput = repository ? parseRepositoryInput(repository) : { owner, name };
  if (isProductRepositoryTarget(targetInput, productRepository) && !allowProductRepository) {
    throw new Error(productRepositoryTargetError(targetInput));
  }
  const targetNameErrors = validateTargetRepository({
    ...targetInput,
    defaultBranch: "main",
    visibility: "unknown",
    analysisPullRequestLimit: targetPullRequestLimit,
    isValidationTarget,
  }, { productRepository, allowProductRepository }).filter(error => !error.includes("defaultBranch") && !error.includes("visibility"));
  if (targetNameErrors.length > 0) {
    throw new Error(targetNameErrors.join(" "));
  }

  const repositoryMetadata = await provider.getRepository(targetInput);
  const targetRepository = mapTargetRepository({
    ...targetInput,
    repositoryMetadata,
    analysisPullRequestLimit: targetPullRequestLimit,
    isValidationTarget,
    productRepository,
    allowProductRepository,
  });
  const repositoryCoverage = coverageEntry({
    family: "repository_metadata",
    source: "rest:/repos/{owner}/{repo}",
    status: COVERAGE_STATUS.available,
    downstreamImpact: "Required for target repository identity and visibility.",
  });

  const languagesAttempt = await attempt({
    family: "languages",
    source: "rest:/repos/{owner}/{repo}/languages",
    downstreamImpact: "Language context omitted when unavailable; file roles must still come from repository profile later.",
    run: () => provider.getLanguages(targetInput),
  });

  const contributorSource = await collectContributorSource({
    targetInput,
    provider,
    contributors,
  });

  const inventory = (await provider.listMergedPullRequests({ ...targetInput, limit: targetPullRequestLimit }))
    .sort((left, right) => String(right.mergedAt ?? "").localeCompare(String(left.mergedAt ?? "")))
    .slice(0, targetPullRequestLimit);
  const inventoryCoverage = coverageEntry({
    family: "pull_request_inventory",
    source: "gh pr list --state merged --search \"is:merged sort:merged-desc\"",
    status: COVERAGE_STATUS.available,
    downstreamImpact: "Required to select latest merged pull requests.",
  });

  const pullRequests = [];
  const reviewThreadCoverages = [];
  const workflowRunCoverages = [];

  for (const inventoryItem of inventory) {
    const details = await provider.getPullRequest({ ...targetInput, number: inventoryItem.number });
    const pr = mapPullRequestDetails(details);

    const reviewThreadsAttempt = await attempt({
      family: "review_threads",
      source: "graphql:repository.pullRequest.reviewThreads",
      downstreamImpact: "Thread resolution and threaded comment metrics are unavailable for affected PRs.",
      run: () => provider.getReviewThreads({ ...targetInput, number: pr.number }),
    });
    if (reviewThreadsAttempt.value) {
      const mappedReviewThreads = mapReviewThreads(reviewThreadsAttempt.value);
      pr.reviewThreads = mappedReviewThreads.reviewThreads;
      if (mappedReviewThreads.truncatedCommentThreads > 0) {
        reviewThreadsAttempt.coverage = coverageEntry({
          family: "review_threads",
          source: "graphql:repository.pullRequest.reviewThreads",
          status: COVERAGE_STATUS.partial,
          diagnostics: [
            `PR #${pr.number} has ${mappedReviewThreads.truncatedCommentThreads} review thread(s) with more than 100 comments; nested comment pagination is deferred from M1.`,
          ],
          downstreamImpact: "Thread counts are available, but review-comment totals may be incomplete for affected PRs.",
        });
      }
    }
    pr.coverage.reviewThreads = reviewThreadsAttempt.coverage;
    reviewThreadCoverages.push(reviewThreadsAttempt.coverage);

    if (pr.headRefName) {
      const workflowRunsAttempt = await attempt({
        family: "workflow_runs",
        source: "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
        downstreamImpact: "Workflow churn history is unavailable for affected PRs; final status check rollup remains available.",
        run: () => provider.getWorkflowRuns({ ...targetInput, branch: pr.headRefName }),
      });
      if (workflowRunsAttempt.value) {
        pr.workflowRuns = mapWorkflowRuns(workflowRunsAttempt.value);
        if (pr.workflowRuns.totalCount > pr.workflowRuns.runs.length) {
          workflowRunsAttempt.coverage = coverageEntry({
            family: "workflow_runs",
            source: "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
            status: COVERAGE_STATUS.partial,
            diagnostics: [
              `PR #${pr.number} collected ${pr.workflowRuns.runs.length} of ${pr.workflowRuns.totalCount} workflow run(s).`,
            ],
            downstreamImpact: "Workflow churn history may be incomplete for affected PRs; final status check rollup remains available.",
          });
        }
      }
      pr.coverage.workflowRuns = workflowRunsAttempt.coverage;
      workflowRunCoverages.push(workflowRunsAttempt.coverage);
    } else {
      const branchCoverage = coverageEntry({
        family: "workflow_runs",
        source: "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
        status: COVERAGE_STATUS.unavailable,
        diagnostics: [`PR #${pr.number} has no accessible headRefName for branch-based workflow-run lookup.`],
        downstreamImpact: "Workflow churn history is unavailable for this PR; final status check rollup remains available.",
      });
      pr.coverage.workflowRuns = branchCoverage;
      workflowRunCoverages.push(branchCoverage);
    }

    pullRequests.push(pr);
  }

  const sourceFamilies = [
    repositoryCoverage,
    languagesAttempt.coverage,
    inventoryCoverage,
    coverageEntry({
      family: "pull_request_details",
      source: "gh pr view --json",
      status: COVERAGE_STATUS.available,
      attempts: pullRequests.length,
      downstreamImpact: "Required for PR metadata, final diff, files, commits, reviews, and check rollups.",
    }),
    mergeCoverageEntries({
      family: "review_threads",
      source: "graphql:repository.pullRequest.reviewThreads",
      entries: reviewThreadCoverages,
      downstreamImpact: "Thread resolution and threaded comment metrics are unavailable for affected PRs.",
    }),
    mergeCoverageEntries({
      family: "workflow_runs",
      source: "rest:/repos/{owner}/{repo}/actions/runs?branch={branch}&event=pull_request",
      entries: workflowRunCoverages,
      downstreamImpact: "Workflow churn history is unavailable for affected PRs; final status check rollup remains available.",
    }),
    coverageEntry({
      family: "pr_open_diff",
      source: "historical_snapshot",
      status: COVERAGE_STATUS.unavailable,
      attempts: pullRequests.length,
      diagnostics: ["PR-open diff reconstruction and snapshot capture are intentionally not implemented in M1."],
      downstreamImpact: "Diff growth metrics must remain unavailable.",
    }),
    ...(contributorSource ? [contributorSource.coverage] : []),
  ];

  return {
    schemaVersion: SOURCE_BUNDLE_VERSION,
    collectedAt,
    source: {
      kind: "github",
      label: "GitHub live collection",
    },
    collector: {
      name: "github-live-collector",
      provider: provider.kind ?? "custom",
    },
    targetRepository,
    repositoryMetadata: mapRepositoryMetadata(repositoryMetadata),
    selection: {
      strategy: "latest_merged_pull_requests",
      requestedLimit: targetPullRequestLimit,
      collectedCount: pullRequests.length,
      source: "gh pr list --state merged --search \"is:merged sort:merged-desc\"",
    },
    coverage: {
      status: buildCoverageSummary(sourceFamilies),
      sourceFamilies,
    },
    languageDistribution: {
      source: "rest:/repos/{owner}/{repo}/languages",
      bytesByLanguage: languagesAttempt.value ?? {},
      coverage: languagesAttempt.coverage,
    },
    ...(contributorSource ? { contributorSource } : {}),
    pullRequests,
  };
}

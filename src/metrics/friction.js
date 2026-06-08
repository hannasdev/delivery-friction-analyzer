export const FRICTION_METRICS_VERSION = "friction-metrics.v1";
export const FRICTION_METRIC_CONSTANTS = Object.freeze({
  lowSignalRoleWeight: 0.25,
  smallDiffWideSpread: Object.freeze({
    maxCoreChangedLines: 600,
    minCoreFiles: 3,
  }),
});

const COMMENT_SOURCES = [
  "copilot",
  "human_reviewer",
  "author_reply",
  "github_actions_bot",
  "dependency_bot",
  "code_scanning",
  "unknown_bot",
  "unknown",
];

const LOW_SIGNAL_ROLES = new Set([
  "generated_docs",
  "release_notes",
  "planning_docs",
  "marketing_site",
  "fixtures",
  "generated_or_vendored",
]);

const CORE_ROLES = new Set(["core_product_code", "product_ui"]);
const SUCCESS_CONCLUSIONS = new Set(["success", "successful", "passed", "neutral", "skipped"]);
const FAILURE_CONCLUSIONS = new Set([
  "failure",
  "failed",
  "timed_failure",
  "startup_failure",
  "action_required",
  "timed_out",
  "stale",
  "error",
]);
const CHECK_FAILURE_CONCLUSIONS = new Set([
  ...FAILURE_CONCLUSIONS,
  "cancelled",
  "canceled",
]);

function linesOf(file = {}) {
  return Number(file.additions ?? 0) + Number(file.deletions ?? 0);
}

function safeCount(value) {
  return Number.isFinite(value) ? value : 0;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function density(count, denominator) {
  return denominator > 0 ? round((count / denominator) * 100) : 0;
}

function directoryOf(path = "") {
  const parts = String(path).split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
}

function sumBy(items, keyFn, valueFn = () => 1) {
  const totals = {};
  for (const item of items) {
    const key = keyFn(item);
    totals[key] = (totals[key] ?? 0) + valueFn(item);
  }
  return Object.fromEntries(Object.entries(totals).sort(([left], [right]) => left.localeCompare(right)));
}

function summarizeFiles(files = []) {
  const nonGeneratedFiles = files.filter(file => !file.generated);
  const coreFiles = nonGeneratedFiles.filter(file => CORE_ROLES.has(file.role));
  const lowSignalFiles = files.filter(file => file.generated || LOW_SIGNAL_ROLES.has(file.role));
  const directories = new Set(nonGeneratedFiles.map(file => directoryOf(file.path)));
  const functionalSurfaces = new Set(nonGeneratedFiles.map(file => file.functionalSurface ?? "unknown"));
  const nonGeneratedLines = nonGeneratedFiles.reduce((total, file) => total + linesOf(file), 0);
  const coreLines = coreFiles.reduce((total, file) => total + linesOf(file), 0);
  const weightedChangedLines = files.reduce((total, file) => {
    if (file.generated || file.role === "generated_or_vendored") return total;
    const weight = LOW_SIGNAL_ROLES.has(file.role) ? FRICTION_METRIC_CONSTANTS.lowSignalRoleWeight : 1;
    return total + (linesOf(file) * weight);
  }, 0);
  const { maxCoreChangedLines, minCoreFiles } = FRICTION_METRIC_CONSTANTS.smallDiffWideSpread;

  return {
    allFiles: files.length,
    nonGeneratedFiles: nonGeneratedFiles.length,
    coreFiles: coreFiles.length,
    lowSignalFiles: lowSignalFiles.length,
    directories: directories.size,
    functionalSurfaces: functionalSurfaces.size,
    changedLines: files.reduce((total, file) => total + linesOf(file), 0),
    nonGeneratedChangedLines: nonGeneratedLines,
    coreChangedLines: coreLines,
    weightedChangedLines: round(weightedChangedLines, 2),
    linesPerNonGeneratedFile: nonGeneratedFiles.length ? round(nonGeneratedLines / nonGeneratedFiles.length, 2) : 0,
    smallDiffWideSpread: coreLines > 0 && coreLines <= maxCoreChangedLines && coreFiles.length >= minCoreFiles,
    byCategory: sumBy(files, file => file.category, linesOf),
    byRole: sumBy(files, file => file.role, linesOf),
    byFunctionalSurface: sumBy(files, file => file.functionalSurface ?? "unknown", linesOf),
    classificationSources: sumBy(files, file => file.classificationSource ?? "unknown"),
    formulaInputs: {
      lowSignalRoleWeight: FRICTION_METRIC_CONSTANTS.lowSignalRoleWeight,
      lowSignalRoles: [...LOW_SIGNAL_ROLES].sort(),
      coreRoles: [...CORE_ROLES].sort(),
      smallDiffWideSpread: {
        maxCoreChangedLines,
        minCoreFiles,
      },
    },
  };
}

function summarizeComments(pr, changedLines, changedFiles) {
  const bySource = {};
  for (const source of COMMENT_SOURCES) {
    bySource[source] = pr.reviewComments?.bySource?.[source] ?? 0;
  }

  return {
    totalCount: pr.reviewComments?.totalCount ?? Object.values(bySource).reduce((sum, count) => sum + count, 0),
    bySource,
    densityPer100ChangedLines: Object.fromEntries(
      COMMENT_SOURCES.map(source => [source, density(bySource[source], changedLines)]),
    ),
    densityPerChangedFile: Object.fromEntries(
      COMMENT_SOURCES.map(source => [source, changedFiles > 0 ? round(bySource[source] / changedFiles) : 0]),
    ),
  };
}

function summarizeChecks(pr) {
  const byConclusion = sumBy(pr.checkRuns ?? [], check => String(check.conclusion ?? "unknown").toLowerCase());
  const failedCheckRuns = (pr.checkRuns ?? []).filter(check => {
    const conclusion = String(check.conclusion ?? "").toLowerCase();
    return CHECK_FAILURE_CONCLUSIONS.has(conclusion);
  }).length;
  const successfulCheckRuns = (pr.checkRuns ?? []).filter(check => {
    const conclusion = String(check.conclusion ?? "").toLowerCase();
    return SUCCESS_CONCLUSIONS.has(conclusion);
  }).length;

  const workflowConclusions = pr.workflowRuns?.conclusions ?? {};
  const failedWorkflowRuns = Object.entries(workflowConclusions)
    .filter(([conclusion]) => FAILURE_CONCLUSIONS.has(String(conclusion).toLowerCase()))
    .reduce((sum, [, count]) => sum + count, 0);
  const cancelledWorkflowRuns = safeCount(workflowConclusions.cancelled) + safeCount(workflowConclusions.canceled);
  const workflowRunCount = pr.workflowRuns?.totalCount ?? null;

  return {
    checkRuns: {
      totalCount: (pr.checkRuns ?? []).length,
      successfulCount: successfulCheckRuns,
      failedCount: failedCheckRuns,
      byConclusion,
    },
    workflowRuns: {
      source: pr.workflowRuns?.source ?? "unavailable",
      totalCount: workflowRunCount,
      conclusions: workflowConclusions,
      failedCount: failedWorkflowRuns,
      cancelledCount: cancelledWorkflowRuns,
      coverage: Number.isInteger(workflowRunCount) ? "observed" : "unavailable",
    },
  };
}

function hoursBetween(start, end) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return round((endMs - startMs) / 36e5, 2);
}

function summarizeLifecycle(pr) {
  return {
    timeToFirstReviewHours: hoursBetween(pr.lifecycle?.createdAt, pr.lifecycle?.firstReviewAt),
    timeToMergeHours: hoursBetween(pr.lifecycle?.createdAt, pr.lifecycle?.mergedAt),
    reviewWindowHours: hoursBetween(pr.lifecycle?.firstReviewAt, pr.lifecycle?.lastReviewAt),
  };
}

function summarizeIteration(pr) {
  const firstReviewAt = pr.lifecycle?.firstReviewAt ? Date.parse(pr.lifecycle.firstReviewAt) : null;
  const commitsAfterFirstReview = firstReviewAt
    ? (pr.commits ?? []).filter(commit => {
      const authoredAt = Date.parse(commit.authoredDate);
      return Number.isFinite(authoredAt) && authoredAt > firstReviewAt;
    }).length
    : null;

  return {
    commitCount: (pr.commits ?? []).length,
    commitsAfterFirstReview,
    reviewAttempts: (pr.reviews ?? []).length,
    failedReviewAttempts: (pr.reviews ?? []).filter(review => review.failedAttempt).length,
  };
}

function summarizeDiffGrowth(pr, diffAtMerge = pr.diffAtMerge ?? {}) {
  const openDiff = pr.prOpenDiff ?? {};
  const canCompare = ["direct", "reconstructed"].includes(openDiff.source)
    && Number.isInteger(openDiff.additions)
    && Number.isInteger(openDiff.deletions)
    && Number.isInteger(openDiff.changedFiles);

  if (!canCompare) {
    return {
      status: "unavailable",
      source: openDiff.source ?? "unavailable",
      confidence: openDiff.confidence ?? "unavailable",
      changedLineGrowthRatio: null,
      changedFileGrowthRatio: null,
    };
  }

  const openLines = openDiff.additions + openDiff.deletions;
  const mergeLines = Number(diffAtMerge.additions ?? 0) + Number(diffAtMerge.deletions ?? 0);

  return {
    status: "computed",
    source: openDiff.source,
    confidence: openDiff.confidence,
    changedLineGrowthRatio: openLines > 0 ? round(mergeLines / openLines) : null,
    changedFileGrowthRatio: openDiff.changedFiles > 0 ? round((diffAtMerge.changedFiles ?? 0) / openDiff.changedFiles) : null,
  };
}

function componentMetric(value, inputs) {
  return {
    formulaVersion: FRICTION_METRICS_VERSION,
    value,
    inputs,
  };
}

function summarizeComponents({ pr, comments, files, checks, iteration, diffGrowth, changedLines, reviewThreads }) {
  const validationFailures = checks.checkRuns.failedCount + checks.workflowRuns.failedCount + checks.workflowRuns.cancelledCount;
  const postReviewCommits = iteration.commitsAfterFirstReview ?? 0;
  const planningLines = (pr.files ?? []).filter(file => file.role === "planning_docs").reduce((sum, file) => sum + linesOf(file), 0);
  const nonCoreSurfaces = Math.max(files.functionalSurfaces - 1, 0);
  const reviewThreadCount = reviewThreads.totalCount ?? 0;

  return {
    commentSourceDensity: componentMetric(comments.totalCount, {
      totalComments: comments.totalCount,
      changedLines,
      bySourcePer100ChangedLines: comments.densityPer100ChangedLines,
    }),
    functionalSurfaceDensity: componentMetric(files.functionalSurfaces, {
      functionalSurfaces: files.functionalSurfaces,
      nonGeneratedChangedLines: files.nonGeneratedChangedLines,
      linesBySurface: files.byFunctionalSurface,
    }),
    iterationDrag: componentMetric(postReviewCommits + reviewThreadCount + iteration.failedReviewAttempts, {
      commitsAfterFirstReview: iteration.commitsAfterFirstReview,
      reviewThreads: reviewThreadCount,
      failedReviewAttempts: iteration.failedReviewAttempts,
    }),
    diffGrowthRatio: componentMetric(diffGrowth.changedLineGrowthRatio, diffGrowth),
    changedFileSpread: componentMetric(files.coreFiles + files.directories + files.functionalSurfaces, {
      coreFiles: files.coreFiles,
      directories: files.directories,
      functionalSurfaces: files.functionalSurfaces,
    }),
    validationGapScore: componentMetric(validationFailures, {
      failedCheckRuns: checks.checkRuns.failedCount,
      failedWorkflowRuns: checks.workflowRuns.failedCount,
      cancelledWorkflowRuns: checks.workflowRuns.cancelledCount,
      workflowCoverage: checks.workflowRuns.coverage,
    }),
    planningGapScore: componentMetric(planningLines > 0 ? 1 : 0, {
      planningChangedLines: planningLines,
      source: "repository_profile",
    }),
    reviewSurpriseScore: componentMetric(nonCoreSurfaces, {
      functionalSurfaces: files.functionalSurfaces,
      method: "deterministic_surface_spread_without_title_nlp",
    }),
    fixAmplification: componentMetric(postReviewCommits, {
      commitsAfterFirstReview: iteration.commitsAfterFirstReview,
      diffGrowthStatus: diffGrowth.status,
      changedLineGrowthRatio: diffGrowth.changedLineGrowthRatio,
    }),
  };
}

export function computePullRequestMetrics(pr) {
  const diffAtMerge = pr.diffAtMerge ?? { additions: 0, deletions: 0, changedFiles: 0 };
  const reviewThreads = pr.reviewThreads ?? {
    source: "unavailable",
    totalCount: 0,
    resolvedCount: 0,
    outdatedCount: 0,
  };
  const files = summarizeFiles(pr.files ?? []);
  const changedLines = Number(diffAtMerge.additions ?? 0) + Number(diffAtMerge.deletions ?? 0);
  const comments = summarizeComments(pr, changedLines, diffAtMerge.changedFiles ?? 0);
  const checks = summarizeChecks(pr);
  const lifecycle = summarizeLifecycle(pr);
  const iteration = summarizeIteration(pr);
  const diffGrowth = summarizeDiffGrowth(pr, diffAtMerge);
  const components = summarizeComponents({ pr, comments, files, checks, iteration, diffGrowth, changedLines, reviewThreads });

  return {
    metricVersion: FRICTION_METRICS_VERSION,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    coverage: {
      prOpenDiff: {
        source: pr.prOpenDiff?.source ?? "unavailable",
        confidence: pr.prOpenDiff?.confidence ?? "unavailable",
        status: diffGrowth.status,
      },
      reviewThreads: { source: reviewThreads.source ?? "unavailable" },
      workflowRuns: {
        source: pr.workflowRuns?.source ?? "unavailable",
        status: checks.workflowRuns.coverage,
      },
    },
    diffAtMerge: {
      ...diffAtMerge,
      changedLines,
    },
    files,
    review: {
      comments,
      threads: reviewThreads,
    },
    ci: checks,
    lifecycle,
    iteration,
    components,
  };
}

function rankBy(pullRequests, metricName) {
  return [...pullRequests]
    .sort((left, right) => {
      const delta = (right.components[metricName]?.value ?? 0) - (left.components[metricName]?.value ?? 0);
      return delta || left.number - right.number;
    })
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      value: pr.components[metricName]?.value ?? 0,
    }));
}

export function computeRepositoryMetrics(normalizedBundle) {
  const pullRequests = (normalizedBundle.pullRequests ?? []).map(computePullRequestMetrics);
  const totals = pullRequests.reduce((summary, pr) => {
    summary.pullRequests += 1;
    summary.changedLines += pr.diffAtMerge.changedLines;
    summary.nonGeneratedChangedLines += pr.files.nonGeneratedChangedLines;
    summary.reviewComments += pr.review.comments.totalCount;
    summary.reviewThreads += pr.review.threads.totalCount;
    summary.failedChecks += pr.ci.checkRuns.failedCount;
    summary.cancelledWorkflowRuns += pr.ci.workflowRuns.cancelledCount;
    return summary;
  }, {
    pullRequests: 0,
    changedLines: 0,
    nonGeneratedChangedLines: 0,
    reviewComments: 0,
    reviewThreads: 0,
    failedChecks: 0,
    cancelledWorkflowRuns: 0,
  });

  return {
    metricVersion: FRICTION_METRICS_VERSION,
    targetRepository: normalizedBundle.targetRepository,
    totals,
    rankings: {
      reviewChurn: rankBy(pullRequests, "iterationDrag"),
      changedFileSpread: rankBy(pullRequests, "changedFileSpread"),
      validationGap: rankBy(pullRequests, "validationGapScore"),
      planningGap: rankBy(pullRequests, "planningGapScore"),
      reviewSurprise: rankBy(pullRequests, "reviewSurpriseScore"),
      fixAmplification: rankBy(pullRequests, "fixAmplification"),
    },
    pullRequests,
  };
}

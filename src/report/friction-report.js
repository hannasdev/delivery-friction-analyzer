export const FRICTION_REPORT_VERSION = "friction-report.v1";

const BOT_SOURCES = new Set(["copilot", "github_actions_bot", "dependency_bot", "code_scanning", "unknown_bot"]);
const LOW_SIGNAL_ROLES = new Set([
  "fixtures",
  "generated_docs",
  "generated_or_vendored",
  "marketing_site",
  "planning_docs",
  "release_notes",
]);

const RECOMMENDATION_CATEGORIES = [
  {
    id: "hooks",
    label: "Hooks",
    description: "Local hooks for repeated formatting, lint, typecheck, snapshot, or generated-output churn.",
  },
  {
    id: "preflight_scripts",
    label: "Preflight scripts",
    description: "Local commands that catch CI or workflow failures before pushing.",
  },
  {
    id: "repo_specific_ai_skills",
    label: "Repo-specific AI skills",
    description: "Repository guidance for repeated review themes around architecture, tests, docs, or unsafe APIs.",
  },
  {
    id: "pr_readiness_gate",
    label: "PR readiness gates",
    description: "Review-before-review checks for scope, tests, descriptions, and evidence.",
  },
  {
    id: "smaller_milestones",
    label: "Smaller milestones",
    description: "Smaller delivery slices for broad, unstable, or cross-surface changes.",
  },
  {
    id: "planning_artifacts",
    label: "Planning artifacts",
    description: "Durable product or architecture notes when requirement or scope signals dominate.",
  },
  {
    id: "test_infrastructure",
    label: "Test infrastructure",
    description: "Validation infrastructure when recurring failures or missing coverage create delivery loops.",
  },
];

const BOTTLENECK_DEFINITIONS = [
  {
    id: "review-churn",
    rankingKey: "reviewChurn",
    title: "Review churn",
    metricLabel: "iteration drag",
    recommendationCategory: "pr_readiness_gate",
    action: "Add or tighten a PR readiness gate for changes that attract repeated review rounds.",
    diagnosis: "Review loops are concentrated in a small set of PRs.",
  },
  {
    id: "changed-file-spread",
    rankingKey: "changedFileSpread",
    title: "Changed-file spread",
    metricLabel: "spread score",
    recommendationCategory: "smaller_milestones",
    action: "Break broad changes into smaller milestones when core files, directories, or surfaces spread out.",
    diagnosis: "Broad file and surface spread can hide review and validation risk.",
  },
  {
    id: "validation-gap",
    rankingKey: "validationGap",
    title: "Validation gap",
    metricLabel: "validation gap score",
    recommendationCategory: "preflight_scripts",
    action: "Add local preflight scripts for recurring CI or workflow interruptions.",
    diagnosis: "Validation friction appears where checks, workflows, or cancellations add corrective loops.",
  },
  {
    id: "repo-guidance-gap",
    rankingKey: "reviewChurn",
    title: "Repo guidance gap",
    metricLabel: "iteration drag",
    recommendationCategory: "repo_specific_ai_skills",
    action: "Add repo-specific AI skills or instructions for repeated review themes before opening the next PR.",
    diagnosis: "Repeated review loops suggest some repository expectations are not yet available at implementation time.",
  },
  {
    id: "local-hook-gap",
    rankingKey: "validationGap",
    title: "Local hook gap",
    metricLabel: "validation gap score",
    recommendationCategory: "hooks",
    action: "Add or improve local hooks for recurring formatting, lint, typecheck, snapshot, or generated-output churn.",
    diagnosis: "Validation signals point to checks that may be cheaper to catch before a branch reaches CI.",
  },
  {
    id: "test-infrastructure-gap",
    rankingKey: "validationGap",
    title: "Test infrastructure gap",
    metricLabel: "validation gap score",
    recommendationCategory: "test_infrastructure",
    action: "Invest in test infrastructure when recurring CI or workflow signals are a primary delivery loop.",
    diagnosis: "Validation friction may indicate a missing or inconvenient local safety net.",
  },
  {
    id: "planning-gap",
    rankingKey: "planningGap",
    title: "Planning gap",
    metricLabel: "planning gap score",
    recommendationCategory: "planning_artifacts",
    action: "Improve planning artifacts when planning or scope files are part of high-friction changes.",
    diagnosis: "Planning-related changes show up in the same PRs as delivery friction.",
  },
  {
    id: "review-surprise",
    rankingKey: "reviewSurprise",
    title: "Review surprise",
    metricLabel: "surface surprise score",
    recommendationCategory: "pr_readiness_gate",
    action: "Call out multi-surface scope in the PR description or split cross-surface work.",
    diagnosis: "Changes spanning several functional surfaces are more likely to surprise reviewers.",
  },
  {
    id: "fix-amplification",
    rankingKey: "fixAmplification",
    title: "Fix amplification",
    metricLabel: "post-review commits",
    recommendationCategory: "smaller_milestones",
    action: "Use smaller delivery slices when review feedback causes meaningful post-review change.",
    diagnosis: "Post-review commits show where initial PR shape did not stay stable.",
  },
];

function sumObjectValues(object = {}) {
  return Object.values(object).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

function addInto(target, source = {}) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + Number(value ?? 0);
  }
  return target;
}

function sortedEntries(object = {}) {
  return Object.entries(object)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const delta = Number(rightValue ?? 0) - Number(leftValue ?? 0);
      return delta || leftKey.localeCompare(rightKey);
    })
    .map(([name, value]) => ({ name, value }));
}

function findPullRequest(metricsSummary, number) {
  return (metricsSummary.pullRequests ?? []).find(pr => pr.number === number);
}

function formatPr(pr, rankingEntry) {
  return {
    number: rankingEntry.number,
    title: rankingEntry.title,
    url: pr?.url ?? null,
    value: rankingEntry.value,
    changedLines: pr?.diffAtMerge?.changedLines ?? null,
    reviewThreads: pr?.review?.threads?.totalCount ?? null,
    functionalSurfaces: pr?.files?.functionalSurfaces ?? null,
    coreChangedLines: pr?.files?.coreChangedLines ?? null,
    lowSignalFiles: pr?.files?.lowSignalFiles ?? null,
  };
}

function topEvidence(metricsSummary, rankingKey) {
  return (metricsSummary.rankings?.[rankingKey] ?? [])
    .filter(entry => entry.value !== null && entry.value > 0)
    .slice(0, 3)
    .map(entry => formatPr(findPullRequest(metricsSummary, entry.number), entry));
}

function summarizeCommentSources(metricsSummary) {
  const bySource = {};
  for (const pr of metricsSummary.pullRequests ?? []) {
    addInto(bySource, pr.review?.comments?.bySource);
  }
  const sourceEntries = sortedEntries(bySource);
  const botComments = sourceEntries
    .filter(entry => BOT_SOURCES.has(entry.name))
    .reduce((sum, entry) => sum + entry.value, 0);
  const humanComments = sourceEntries
    .filter(entry => entry.name === "human_reviewer")
    .reduce((sum, entry) => sum + entry.value, 0);

  return {
    totalComments: sumObjectValues(bySource),
    bySource: sourceEntries,
    botComments,
    humanComments,
    authorReplies: bySource.author_reply ?? 0,
    dominantSource: sourceEntries[0] ?? { name: "none", value: 0 },
  };
}

function summarizeSurfaces(metricsSummary) {
  const byFunctionalSurface = {};
  const byRole = {};
  let coreChangedLines = 0;
  let lowSignalFiles = 0;
  let weightedChangedLines = 0;
  let smallDiffWideSpreadCount = 0;

  for (const pr of metricsSummary.pullRequests ?? []) {
    addInto(byFunctionalSurface, pr.files?.byFunctionalSurface);
    addInto(byRole, pr.files?.byRole);
    coreChangedLines += Number(pr.files?.coreChangedLines ?? 0);
    lowSignalFiles += Number(pr.files?.lowSignalFiles ?? 0);
    weightedChangedLines += Number(pr.files?.weightedChangedLines ?? 0);
    if (pr.files?.smallDiffWideSpread) smallDiffWideSpreadCount += 1;
  }

  const lowSignalChangedLines = Object.entries(byRole)
    .filter(([role]) => LOW_SIGNAL_ROLES.has(role))
    .reduce((sum, [, value]) => sum + Number(value ?? 0), 0);

  return {
    coreChangedLines,
    lowSignalChangedLines,
    lowSignalFiles,
    weightedChangedLines: Math.round(weightedChangedLines * 100) / 100,
    smallDiffWideSpreadCount,
    byFunctionalSurface: sortedEntries(byFunctionalSurface),
    byRole: sortedEntries(byRole),
  };
}

function summarizeCoverage(metricsSummary) {
  const prOpenDiff = {};
  const workflowRuns = {};
  const reviewThreads = {};

  for (const pr of metricsSummary.pullRequests ?? []) {
    const prOpenStatus = pr.coverage?.prOpenDiff?.status ?? "unavailable";
    const workflowStatus = pr.coverage?.workflowRuns?.status ?? "unavailable";
    const reviewThreadSource = pr.coverage?.reviewThreads?.source ?? "unavailable";
    prOpenDiff[prOpenStatus] = (prOpenDiff[prOpenStatus] ?? 0) + 1;
    workflowRuns[workflowStatus] = (workflowRuns[workflowStatus] ?? 0) + 1;
    reviewThreads[reviewThreadSource] = (reviewThreads[reviewThreadSource] ?? 0) + 1;
  }

  const notes = [];
  if (prOpenDiff.unavailable) {
    notes.push("PR-open diff growth is unavailable for some PRs and is not inferred from merge-time data.");
  }
  if (workflowRuns.unavailable) {
    notes.push("Workflow-run coverage is unavailable for some PRs, often because branch-based history is missing.");
  }

  return {
    prOpenDiff,
    workflowRuns,
    reviewThreads,
    notes,
  };
}

function summarizeBottlenecks(metricsSummary) {
  return BOTTLENECK_DEFINITIONS
    .map((definition, definitionIndex) => {
      const evidence = topEvidence(metricsSummary, definition.rankingKey);
      return {
        definitionIndex,
        rankValue: evidence[0]?.value ?? 0,
        id: definition.id,
        title: definition.title,
        metricLabel: definition.metricLabel,
        observedData: evidence,
        inferredDiagnosis: evidence.length ? definition.diagnosis : "No material signal in the fixture data.",
        suggestedAction: {
          category: definition.recommendationCategory,
          action: definition.action,
        },
      };
    })
    .filter(bottleneck => bottleneck.observedData.length > 0)
    .sort((left, right) => {
      const delta = right.rankValue - left.rankValue;
      return delta || left.definitionIndex - right.definitionIndex;
    })
    .map(({ definitionIndex, rankValue, ...bottleneck }) => bottleneck);
}

function summarizeRecommendationCategories(bottlenecks) {
  const triggeredCounts = {};
  for (const bottleneck of bottlenecks) {
    const category = bottleneck.suggestedAction.category;
    triggeredCounts[category] = (triggeredCounts[category] ?? 0) + 1;
  }

  return RECOMMENDATION_CATEGORIES.map(category => ({
    ...category,
    triggeredBottlenecks: triggeredCounts[category.id] ?? 0,
  }));
}

export function generateRepositoryFrictionReport(metricsSummary) {
  const bottlenecks = summarizeBottlenecks(metricsSummary);
  return {
    reportVersion: FRICTION_REPORT_VERSION,
    metricVersion: metricsSummary.metricVersion,
    targetRepository: metricsSummary.targetRepository,
    summary: {
      pullRequests: metricsSummary.totals?.pullRequests ?? 0,
      changedLines: metricsSummary.totals?.changedLines ?? 0,
      nonGeneratedChangedLines: metricsSummary.totals?.nonGeneratedChangedLines ?? 0,
      reviewComments: metricsSummary.totals?.reviewComments ?? 0,
      reviewThreads: metricsSummary.totals?.reviewThreads ?? 0,
      failedChecks: metricsSummary.totals?.failedChecks ?? 0,
      cancelledWorkflowRuns: metricsSummary.totals?.cancelledWorkflowRuns ?? 0,
      topBottleneckIds: bottlenecks.slice(0, 3).map(bottleneck => bottleneck.id),
    },
    coverage: summarizeCoverage(metricsSummary),
    commentSources: summarizeCommentSources(metricsSummary),
    surfaces: summarizeSurfaces(metricsSummary),
    bottlenecks,
    recommendationCategories: summarizeRecommendationCategories(bottlenecks),
    guardrails: {
      avoidsIndividualRanking: true,
      separatesObservedInferredAndSuggested: true,
      usesCompositeScore: false,
    },
    followUp: [
      "Inspect recommendations against real PR history before turning them into automated repository changes.",
      "Collect PR-open snapshots in a future GitHub App flow when diff-growth coverage matters.",
    ],
  };
}

function lineForEvidence(evidence) {
  const changedLines = evidence.changedLines === null ? "unknown changed lines" : `${evidence.changedLines} changed lines`;
  return `- PR #${evidence.number}: ${evidence.title} (${evidence.value}; ${changedLines})`;
}

function renderList(items) {
  return items.length ? items.map(item => `- ${item}`).join("\n") : "- None";
}

function renderNamedValues(entries) {
  return entries.length
    ? entries.map(entry => `- ${entry.name}: ${entry.value}`).join("\n")
    : "- None";
}

function renderRecommendationCategories(categories) {
  return categories.length
    ? categories.map(category => `- ${category.label}: ${category.triggeredBottlenecks} triggered bottleneck(s)`).join("\n")
    : "- None";
}

export function renderRepositoryFrictionMarkdown(report) {
  const repository = report.targetRepository
    ? `${report.targetRepository.owner}/${report.targetRepository.name}`
    : "unknown repository";
  const lines = [
    `# Repository Friction Report: ${repository}`,
    "",
    `Report version: ${report.reportVersion}`,
    `Metric version: ${report.metricVersion}`,
    `Analysis window: ${report.targetRepository?.analysisWindowDays ?? "unknown"} days`,
    "",
    "## Summary",
    "",
    `- Pull requests analyzed: ${report.summary.pullRequests}`,
    `- Changed lines: ${report.summary.changedLines}`,
    `- Non-generated changed lines: ${report.summary.nonGeneratedChangedLines}`,
    `- Review comments: ${report.summary.reviewComments}`,
    `- Review threads: ${report.summary.reviewThreads}`,
    `- Top bottlenecks: ${report.summary.topBottleneckIds.join(", ") || "none"}`,
    "",
    "## Ranked Bottlenecks",
    "",
  ];

  for (const bottleneck of report.bottlenecks) {
    lines.push(
      `### ${bottleneck.title}`,
      "",
      `Observed data (${bottleneck.metricLabel}):`,
      ...bottleneck.observedData.map(lineForEvidence),
      "",
      `Inferred diagnosis: ${bottleneck.inferredDiagnosis}`,
      `Suggested action: ${bottleneck.suggestedAction.action}`,
      "",
    );
  }

  lines.push(
    "## Recommendation Categories",
    "",
    renderRecommendationCategories(report.recommendationCategories ?? []),
    "",
    "## Comment Sources",
    "",
    `- Total comments: ${report.commentSources.totalComments}`,
    `- Bot/scanner comments: ${report.commentSources.botComments}`,
    `- Human reviewer comments: ${report.commentSources.humanComments}`,
    `- Author replies: ${report.commentSources.authorReplies}`,
    "",
    "By source:",
    renderNamedValues(report.commentSources.bySource),
    "",
    "## Core And Support Surfaces",
    "",
    `- Core changed lines: ${report.surfaces.coreChangedLines}`,
    `- Low-signal changed lines: ${report.surfaces.lowSignalChangedLines}`,
    `- Low-signal files: ${report.surfaces.lowSignalFiles}`,
    `- Weighted changed lines: ${report.surfaces.weightedChangedLines}`,
    `- Small-diff wide-spread PRs: ${report.surfaces.smallDiffWideSpreadCount}`,
    "",
    "Functional surfaces:",
    renderNamedValues(report.surfaces.byFunctionalSurface),
    "",
    "File roles:",
    renderNamedValues(report.surfaces.byRole),
    "",
    "## Coverage",
    "",
    "PR-open diff:",
    renderNamedValues(sortedEntries(report.coverage.prOpenDiff)),
    "",
    "Workflow runs:",
    renderNamedValues(sortedEntries(report.coverage.workflowRuns)),
    "",
    "Review thread sources:",
    renderNamedValues(sortedEntries(report.coverage.reviewThreads)),
    "",
    "Coverage notes:",
    renderList(report.coverage.notes),
    "",
    "## Guardrails",
    "",
    `- Avoids individual ranking: ${report.guardrails.avoidsIndividualRanking}`,
    `- Separates observed, inferred, and suggested fields: ${report.guardrails.separatesObservedInferredAndSuggested}`,
    `- Uses composite score: ${report.guardrails.usesCompositeScore}`,
    "",
    "## Follow-up",
    "",
    renderList(report.followUp),
    "",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

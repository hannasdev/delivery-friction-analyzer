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

const RECOMMENDATION_CATEGORY_LABELS = new Map(
  RECOMMENDATION_CATEGORIES.map(category => [category.id, category.label]),
);

const RANKING_SIGNAL_LABELS = new Map([
  ["reviewChurn", "review churn"],
  ["changedFileSpread", "change scope"],
  ["validationGap", "validation gap"],
  ["planningGap", "planning gap"],
  ["reviewSurprise", "review surprise"],
  ["fixAmplification", "fix amplification"],
]);

const WORKFLOW_CONTEXT_FIELDS = [
  ["primaryMergeMethod", "Primary merge method"],
  ["releaseStrategy", "Release strategy"],
  ["branchStrategy", "Branch strategy"],
];

const WORKFLOW_CONTEXT_VALUE_LABELS = new Map([
  ["merge_commit", "Merge commit"],
  ["squash_merge", "Squash merge"],
  ["rebase_merge", "Rebase merge"],
  ["release_prs", "Release PRs"],
  ["direct_tags", "Direct tags"],
  ["release_branches", "Release branches"],
  ["trunk_based", "Trunk-based"],
  ["main_plus_release_branches", "Main plus release branches"],
  ["long_lived_development_branches", "Long-lived development branches"],
  ["mixed", "Mixed"],
  ["unknown", "Unknown"],
]);

export const CONFIGURED_WORKFLOW_NOTE = "Configured workflow context comes from the repository profile. It is user-configured context, not observed GitHub evidence, and it does not change scores, rankings, CSV exports, or PR class matching.";

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
    title: "Change scope",
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

function nonZeroEntries(object = {}) {
  return sortedEntries(object).filter(entry => entry.value > 0);
}

function hasObservedReviewDecision(reviewDecision = {}) {
  return (reviewDecision.source ?? "unavailable") !== "unavailable"
    && (reviewDecision.state ?? "unavailable") !== "unavailable";
}

function formatObservedCount(value, observed) {
  return observed ? String(value ?? 0) : "unavailable";
}

function formatObservedBoolean(value, observed) {
  if (!observed) return "unavailable";
  return value ? "yes" : "no";
}

function roundShare(value) {
  return Math.round(value * 1000) / 1000;
}

function percentageLabel(share) {
  return `${Math.round(Number(share ?? 0) * 100)}%`;
}

function classDominancePercentageLabel(share) {
  const value = Number(share ?? 0);
  const roundedWholePercent = Math.round(value * 100);
  return value > 0.5 && roundedWholePercent <= 50
    ? `${(value * 100).toFixed(1)}%`
    : `${roundedWholePercent}%`;
}

function prClassSummary(pr = {}) {
  return {
    class: pr.prClass?.class ?? "unknown",
    classificationSource: pr.prClass?.classificationSource ?? "fallback_rule",
    ruleId: pr.prClass?.ruleId ?? null,
  };
}

function findPullRequest(metricsSummary, number) {
  return (metricsSummary.pullRequests ?? []).find(pr => pr.number === number);
}

function formatPr(pr, rankingEntry) {
  const allCommentSources = nonZeroEntries(pr?.review?.comments?.bySource);
  const commentSources = allCommentSources.slice(0, 5);
  const workflowRunConclusions = nonZeroEntries(pr?.ci?.workflowRuns?.conclusions);
  const botComments = allCommentSources
    .filter(entry => BOT_SOURCES.has(entry.name))
    .reduce((sum, entry) => sum + entry.value, 0);
  const reviewDecision = pr?.review?.decision ?? {};

  return {
    number: rankingEntry.number,
    title: rankingEntry.title,
    url: pr?.url ?? null,
    value: rankingEntry.value,
    prClass: prClassSummary(pr),
    additions: pr?.diffAtMerge?.additions ?? null,
    deletions: pr?.diffAtMerge?.deletions ?? null,
    changedFiles: pr?.diffAtMerge?.changedFiles ?? null,
    changedLines: pr?.diffAtMerge?.changedLines ?? null,
    reviewThreads: pr?.review?.threads?.totalCount ?? null,
    functionalSurfaces: pr?.files?.functionalSurfaces ?? null,
    coreChangedLines: pr?.files?.coreChangedLines ?? null,
    lowSignalFiles: pr?.files?.lowSignalFiles ?? null,
    validationEvidence: {
      workflowRunSource: pr?.ci?.workflowRuns?.source ?? "unavailable",
      workflowRunCoverage: pr?.ci?.workflowRuns?.coverage ?? "unavailable",
      workflowRunConclusions,
      failedCheckRuns: pr?.ci?.checkRuns?.failedCount ?? 0,
      failedWorkflowRuns: pr?.ci?.workflowRuns?.failedCount ?? 0,
      cancelledWorkflowRuns: pr?.ci?.workflowRuns?.cancelledCount ?? 0,
    },
    reviewEvidence: {
      reviewThreadSource: pr?.review?.threads?.source ?? "unavailable",
      reviewThreads: pr?.review?.threads?.totalCount ?? 0,
      resolvedThreads: pr?.review?.threads?.resolvedCount ?? 0,
      outdatedThreads: pr?.review?.threads?.outdatedCount ?? 0,
      reviewDecision: reviewDecision.state ?? "unavailable",
      humanReviewerCount: reviewDecision.humanReviewerCount ?? 0,
      humanApproved: reviewDecision.humanApproved ?? false,
      humanChangesRequested: reviewDecision.humanChangesRequested ?? false,
      reviewDecisionSource: reviewDecision.source ?? "unavailable",
      commentSources,
      botComments,
      humanReviewerComments: pr?.review?.comments?.bySource?.human_reviewer ?? 0,
      authorReplies: pr?.review?.comments?.bySource?.author_reply ?? 0,
    },
  };
}

function summarizePrClasses(metricsSummary) {
  const totalsByClass = new Map();
  const pullRequests = metricsSummary.pullRequests ?? [];

  for (const pr of pullRequests) {
    const prClass = prClassSummary(pr);
    const current = totalsByClass.get(prClass.class) ?? {
      class: prClass.class,
      pullRequests: 0,
      changedLines: 0,
      nonGeneratedChangedLines: 0,
      classificationSources: {},
    };
    current.pullRequests += 1;
    current.changedLines += Number(pr.diffAtMerge?.changedLines ?? 0);
    current.nonGeneratedChangedLines += Number(pr.files?.nonGeneratedChangedLines ?? 0);
    current.classificationSources[prClass.classificationSource] =
      (current.classificationSources[prClass.classificationSource] ?? 0) + 1;
    totalsByClass.set(prClass.class, current);
  }

  const totalPullRequests = pullRequests.length;
  const distribution = [...totalsByClass.values()]
    .map(entry => ({
      ...entry,
      share: totalPullRequests > 0 ? roundShare(entry.pullRequests / totalPullRequests) : 0,
      classificationSources: sortedEntries(entry.classificationSources),
    }))
    .sort((left, right) => {
      const countDelta = right.pullRequests - left.pullRequests;
      const lineDelta = right.changedLines - left.changedLines;
      return countDelta || lineDelta || left.class.localeCompare(right.class);
    });

  return {
    totalPullRequests,
    distribution,
    note: distribution.length
      ? prClassContextNote(metricsSummary.analysisFilter)
      : "No PR class evidence was available.",
  };
}

function prClassContextNote(analysisFilter) {
  return analysisFilter?.excludedPrClasses?.length
    ? "PR class filtering was explicitly applied before metrics and ranking; this distribution describes the filtered sample."
    : "PR classes are repository-profile evidence for interpretation only; they do not change rankings or exclude PRs.";
}

function topEvidence(metricsSummary, rankingKey) {
  const ranking = metricsSummary.rankings?.[rankingKey] ?? [];
  const positiveEntries = ranking.filter(entry => Number(entry.value ?? 0) > 0);
  const fallbackEntries = ranking.filter(entry => entry.value === null
    || entry.value === undefined
    || Number(entry.value) <= 0);
  const displayedEntries = positiveEntries.length ? positiveEntries : fallbackEntries;

  return displayedEntries
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
    notes.push(
      "PR-open diff growth is unavailable for PRs without captured or reconstructed open-time snapshots; it is not inferred from merge-time data.",
    );
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

function summarizeBottlenecks(metricsSummary, prClasses = summarizePrClasses(metricsSummary)) {
  return BOTTLENECK_DEFINITIONS
    .map((definition, definitionIndex) => {
      const evidence = topEvidence(metricsSummary, definition.rankingKey);
      const dominance = summarizeEvidenceDominance(evidence);
      const classDominance = summarizeEvidenceClassDominance(evidence, prClasses);
      return {
        definitionIndex,
        rankValue: evidence[0]?.value ?? 0,
        id: definition.id,
        rankingKey: definition.rankingKey,
        title: definition.title,
        metricLabel: definition.metricLabel,
        observedData: evidence,
        dominance,
        classDominance,
        inferredDiagnosis: definition.diagnosis,
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

function summarizeEvidenceDominance(evidence) {
  const values = evidence
    .map(entry => Number(entry.value ?? 0))
    .filter(value => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  if (values.length < 2 || total === 0) {
    return {
      status: "not_applicable",
      topPrNumber: evidence[0]?.number ?? null,
      topShare: null,
      note: "Not enough positive examples to evaluate outlier dominance.",
    };
  }

  const topValue = values[0];
  const rawTopShare = topValue / total;
  const topShare = Math.round(rawTopShare * 1000) / 1000;
  const status = rawTopShare > 0.5 ? "single_pr_dominates" : "distributed";
  return {
    status,
    topPrNumber: evidence[0]?.number ?? null,
    topShare,
    note: status === "single_pr_dominates"
      ? `PR #${evidence[0].number} contributes ${Math.round(topShare * 100)}% of the displayed signal; inspect raw evidence before generalizing.`
      : "Displayed examples are not dominated by one PR.",
  };
}

function summarizeEvidenceClassDominance(evidence, prClasses) {
  const classDistribution = prClasses?.distribution ?? [];
  const sampleClasses = classDistribution.filter(entry => entry.pullRequests > 0);

  if (!evidence?.length) {
    return {
      status: "not_applicable",
      class: null,
      topShare: null,
      basis: null,
      note: "No displayed examples were available to evaluate PR class dominance.",
    };
  }

  if (sampleClasses.length < 2) {
    return {
      status: "not_applicable",
      class: sampleClasses[0]?.class ?? null,
      topShare: null,
      basis: null,
      note: "Only one PR class appears in the analyzed sample; class dominance is not meaningful.",
    };
  }

  const positiveValueTotal = evidence
    .map(entry => Number(entry.value ?? 0))
    .filter(value => value > 0)
    .reduce((sum, value) => sum + value, 0);
  const basis = positiveValueTotal > 0 ? "score_value" : "displayed_example_count";
  const totalsByClass = new Map();

  for (const entry of evidence) {
    const className = entry.prClass?.class ?? "unknown";
    const current = totalsByClass.get(className) ?? {
      class: className,
      value: 0,
      displayedExamples: 0,
    };
    current.displayedExamples += 1;
    current.value += basis === "score_value" ? Math.max(0, Number(entry.value ?? 0)) : 1;
    totalsByClass.set(className, current);
  }

  const totalValue = [...totalsByClass.values()].reduce((sum, entry) => sum + entry.value, 0);
  if (totalValue === 0) {
    return {
      status: "not_applicable",
      class: null,
      topShare: null,
      basis,
      note: "Displayed examples had no class contribution value to evaluate.",
    };
  }

  const [topClass] = [...totalsByClass.values()]
    .sort((left, right) => {
      const valueDelta = right.value - left.value;
      return valueDelta || left.class.localeCompare(right.class);
    });
  const rawTopShare = topClass.value / totalValue;
  const topShare = roundShare(rawTopShare);
  const samplePullRequests = classDistribution.find(entry => entry.class === topClass.class)?.pullRequests ?? 0;
  const smallSampleNote = samplePullRequests > 0 && samplePullRequests < 3
    ? ` The ${topClass.class} class has ${samplePullRequests} PRs in the analyzed sample, so treat this as a small-sample caveat.`
    : "";
  const basisLabel = basis === "score_value" ? "displayed score value" : "displayed example count";
  const status = topShare > 0.5 ? "single_class_dominates" : "distributed";

  return {
    status,
    class: topClass.class,
    topShare,
    basis,
    displayedExamples: topClass.displayedExamples,
    samplePullRequests,
    note: status === "single_class_dominates"
      ? `PR class ${topClass.class} contributes ${classDominancePercentageLabel(topShare)} of the ${basisLabel}; compare this bottleneck against the class distribution before generalizing.${smallSampleNote}`
      : "Displayed examples are not dominated by one PR class.",
  };
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

export function normalizeConfiguredWorkflowContext(workflowContext) {
  if (!workflowContext || typeof workflowContext !== "object" || Array.isArray(workflowContext)) {
    return null;
  }

  const configuredWorkflow = {
    source: "repository_profile",
    note: CONFIGURED_WORKFLOW_NOTE,
  };
  for (const [field] of WORKFLOW_CONTEXT_FIELDS) {
    if (workflowContext[field] !== undefined) {
      configuredWorkflow[field] = workflowContext[field];
    }
  }

  return WORKFLOW_CONTEXT_FIELDS.some(([field]) => configuredWorkflow[field] !== undefined)
    ? configuredWorkflow
    : null;
}

export function configuredWorkflowEntries(configuredWorkflow) {
  if (!configuredWorkflow || typeof configuredWorkflow !== "object") return [];
  return WORKFLOW_CONTEXT_FIELDS
    .filter(([field]) => configuredWorkflow[field] !== undefined)
    .map(([field, label]) => ({
      field,
      label,
      value: configuredWorkflow[field],
      valueLabel: WORKFLOW_CONTEXT_VALUE_LABELS.get(configuredWorkflow[field]) ?? configuredWorkflow[field],
    }));
}

export function hasConfiguredWorkflowContext(configuredWorkflow) {
  return configuredWorkflowEntries(configuredWorkflow).length > 0;
}

function evidenceSignature(bottleneck) {
  return (bottleneck.observedData ?? [])
    .map(evidence => evidence.number)
    .sort((left, right) => Number(left) - Number(right))
    .join(",");
}

function formatSharedSignalBottleneck(bottleneck) {
  return {
    id: bottleneck.id,
    title: bottleneck.title,
    recommendationCategory: bottleneck.suggestedAction?.category ?? "unspecified",
  };
}

function rankingSignalLabel(rankingKey) {
  return RANKING_SIGNAL_LABELS.get(rankingKey) ?? rankingKey;
}

function recommendationCategoryDisplay(category) {
  return RECOMMENDATION_CATEGORY_LABELS.get(category) ?? category;
}

function summarizeSharedSignals(bottlenecks) {
  const groups = [];
  const byRankingKey = new Map();
  const byEvidenceSignature = new Map();

  for (const bottleneck of bottlenecks ?? []) {
    if (bottleneck.rankingKey) {
      byRankingKey.set(bottleneck.rankingKey, [
        ...(byRankingKey.get(bottleneck.rankingKey) ?? []),
        bottleneck,
      ]);
    }

    const signature = evidenceSignature(bottleneck);
    if (signature) {
      byEvidenceSignature.set(signature, [
        ...(byEvidenceSignature.get(signature) ?? []),
        bottleneck,
      ]);
    }
  }

  for (const [rankingKey, sharedBottlenecks] of byRankingKey) {
    if (sharedBottlenecks.length < 2) continue;
    const titles = sharedBottlenecks.map(bottleneck => bottleneck.title).join(", ");
    groups.push({
      type: "ranking_key",
      key: rankingKey,
      bottlenecks: sharedBottlenecks.map(formatSharedSignalBottleneck),
      note: `${titles} share the ${rankingSignalLabel(rankingKey)} ranking signal; treat them as related interpretations, not separate independent findings.`,
    });
  }

  for (const [signature, sharedBottlenecks] of byEvidenceSignature) {
    if (sharedBottlenecks.length < 2) continue;
    const prNumbers = signature.split(",").map(number => Number(number));
    const titles = sharedBottlenecks.map(bottleneck => bottleneck.title).join(", ");
    groups.push({
      type: "representative_evidence",
      prNumbers,
      bottlenecks: sharedBottlenecks.map(formatSharedSignalBottleneck),
      note: `${titles} display the same representative PR evidence (${prNumbers.map(number => `#${number}`).join(", ")}); keep recommendation actions distinct while reading the shared evidence as one underlying signal.`,
    });
  }

  return {
    groups,
    note: groups.length
      ? "Shared-signal groups are report interpretation only; they do not change scores, ranking, or recommendation categories."
      : "No displayed bottlenecks shared a ranking key or representative PR evidence.",
  };
}

function metricsWithoutPullRequest(metricsSummary, excludedPrNumber) {
  return {
    ...metricsSummary,
    pullRequests: (metricsSummary.pullRequests ?? [])
      .filter(pr => pr.number !== excludedPrNumber),
    rankings: Object.fromEntries(
      Object.entries(metricsSummary.rankings ?? {})
        .map(([key, ranking]) => [
          key,
          (ranking ?? []).filter(entry => entry.number !== excludedPrNumber),
        ]),
    ),
  };
}

function summarizeSensitivity(metricsSummary, baselineBottlenecks) {
  const dominantPrNumbers = [
    ...new Set(
      (baselineBottlenecks ?? [])
        .filter(bottleneck => bottleneck.dominance?.status === "single_pr_dominates")
        .map(bottleneck => bottleneck.dominance.topPrNumber)
        .filter(Number.isInteger),
    ),
  ].sort((left, right) => left - right);

  if (!dominantPrNumbers.length) {
    return {
      summaries: [],
      note: "No displayed bottleneck examples were dominated by one PR.",
    };
  }

  const baselineTopBottleneckIds = baselineBottlenecks.slice(0, 3).map(bottleneck => bottleneck.id);
  const baselineById = new Map(baselineBottlenecks.map(bottleneck => [bottleneck.id, bottleneck]));

  return {
    summaries: dominantPrNumbers.map(excludedPrNumber => {
      const excludedPr = findPullRequest(metricsSummary, excludedPrNumber);
      const filteredBottlenecks = summarizeBottlenecks(metricsWithoutPullRequest(metricsSummary, excludedPrNumber));
      const filteredTopBottleneckIds = filteredBottlenecks.slice(0, 3).map(bottleneck => bottleneck.id);
      const affectedBottlenecks = baselineBottlenecks
        .filter(bottleneck => bottleneck.dominance?.status === "single_pr_dominates"
          && bottleneck.dominance?.topPrNumber === excludedPrNumber)
        .map(bottleneck => ({
          id: bottleneck.id,
          title: bottleneck.title,
          topShare: bottleneck.dominance?.topShare ?? null,
        }));
      const changedTopBottlenecks = baselineTopBottleneckIds.join(",") !== filteredTopBottleneckIds.join(",");

      return {
        excludedPr: {
          number: excludedPrNumber,
          title: excludedPr?.title ?? null,
          url: excludedPr?.url ?? null,
        },
        affectedBottlenecks,
        baselineTopBottleneckIds,
        topBottleneckIdsWithoutPr: filteredTopBottleneckIds,
        changedTopBottlenecks,
        interpretation: changedTopBottlenecks
          ? "Top bottleneck ordering changes when this dominant PR is excluded; treat the baseline as outlier-sensitive."
          : "Top bottleneck ordering is unchanged when this dominant PR is excluded; the baseline appears more robust to this outlier.",
        replacementTopBottlenecks: filteredTopBottleneckIds
          .map(id => filteredBottlenecks.find(bottleneck => bottleneck.id === id) ?? baselineById.get(id))
          .filter(Boolean)
          .map(bottleneck => ({ id: bottleneck.id, title: bottleneck.title })),
      };
    }),
    note: "Sensitivity summaries are robustness context only. They do not remove PRs from the baseline report or replace the original ranking.",
  };
}

export function generateRepositoryFrictionReport(metricsSummary, options = {}) {
  const { workflowContext } = options ?? {};
  const prClasses = summarizePrClasses(metricsSummary);
  const bottlenecksWithSharedSignalKeys = summarizeBottlenecks(metricsSummary, prClasses);
  const sharedSignals = summarizeSharedSignals(bottlenecksWithSharedSignalKeys);
  const bottlenecks = bottlenecksWithSharedSignalKeys.map(({ rankingKey, ...bottleneck }) => bottleneck);
  const configuredWorkflow = normalizeConfiguredWorkflowContext(workflowContext);
  return {
    reportVersion: FRICTION_REPORT_VERSION,
    metricVersion: metricsSummary.metricVersion,
    targetRepository: metricsSummary.targetRepository,
    ...(metricsSummary.analysisFilter ? { analysisFilter: metricsSummary.analysisFilter } : {}),
    ...(configuredWorkflow ? { configuredWorkflow } : {}),
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
    prClasses,
    bottlenecks,
    sharedSignals,
    sensitivity: summarizeSensitivity(metricsSummary, bottlenecks),
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

function escapeMarkdownText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/[`*_\[\]]/g, "\\$&");
}

function escapeMarkdownTableCell(value) {
  return escapeMarkdownText(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function rawMarkdownCell(markdown) {
  return { markdown };
}

function formatMarkdownTableCell(value) {
  if (value && typeof value === "object" && "markdown" in value) {
    return String(value.markdown).replace(/\n/g, " ");
  }
  return escapeMarkdownTableCell(value);
}

function formatNamedValues(entries) {
  return entries.length
    ? entries.map(entry => `${entry.name}=${entry.value}`).join(", ")
    : "none";
}

function formatPrClass(prClass = {}) {
  const className = prClass.class ?? "unknown";
  const source = prClass.classificationSource ?? "fallback_rule";
  const rule = prClass.ruleId ? `, rule=${prClass.ruleId}` : "";
  return `${className} (source=${source}${rule})`;
}

function formatClassSources(entries) {
  return entries?.length ? formatNamedValues(entries) : "none";
}

function formatCoverageEntries(entries) {
  return entries.length
    ? entries.map(entry => `${entry.name}: ${entry.value}`).join(", ")
    : "none";
}

function renderMarkdownTable(headers, rows) {
  if (!rows.length) return "None";
  return [
    `| ${headers.map(formatMarkdownTableCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(row => `| ${row.map(formatMarkdownTableCell).join(" | ")} |`),
  ].join("\n");
}

function sharedEvidenceNotes(bottlenecks) {
  const bySignature = new Map();
  for (const bottleneck of bottlenecks ?? []) {
    const signature = evidenceSignature(bottleneck);
    if (!signature) continue;
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), bottleneck.title]);
  }

  const notes = new Map();
  for (const bottleneck of bottlenecks ?? []) {
    const titles = bySignature.get(evidenceSignature(bottleneck)) ?? [];
    const relatedTitles = titles.filter(title => title !== bottleneck.title);
    if (relatedTitles.length > 0) {
      notes.set(bottleneck.id, `Shares the same representative PR evidence as ${relatedTitles.join(", ")}.`);
    }
  }
  return notes;
}

function prReference(evidence) {
  const label = `#${evidence.number}`;
  return evidence.url ? rawMarkdownCell(`[${label}](${evidence.url})`) : label;
}

function sensitivityPrReference(summary) {
  const label = `#${summary.excludedPr.number}`;
  return summary.excludedPr.url ? rawMarkdownCell(`[${label}](${summary.excludedPr.url})`) : label;
}

function evidenceValueLabel(value) {
  return value === null || value === undefined ? "unknown" : String(value);
}

function evidenceRows(observedData) {
  return (observedData ?? []).map(evidence => [
      prReference(evidence),
      evidence.title,
      evidenceValueLabel(evidence.value),
      evidence.prClass?.class ?? "unknown",
      evidenceValueLabel(evidence.additions),
      evidenceValueLabel(evidence.deletions),
      evidenceValueLabel(evidence.changedFiles),
      evidenceValueLabel(evidence.changedLines),
    ]);
}

function renderEvidenceTable(observedData) {
  return renderMarkdownTable(
    [
      "PR",
      "Title",
      "Score",
      "Class",
      "Additions",
      "Deletions",
      "Files changed",
      "Changed lines",
    ],
    evidenceRows(observedData),
  );
}

function renderDetailList(items) {
  return items.length ? items.map(item => `- ${escapeMarkdownText(item)}`).join("\n") : "- None";
}

function renderEvidenceDetails(observedData) {
  return (observedData ?? []).map(evidence => {
    const validationEvidence = evidence.validationEvidence ?? {};
    const reviewEvidence = evidence.reviewEvidence ?? {};
    const workflowRunConclusions = validationEvidence.workflowRunConclusions ?? [];
    const reviewCommentSources = reviewEvidence.commentSources ?? [];
    const observedReviewDecision = hasObservedReviewDecision({
      state: reviewEvidence.reviewDecision,
      source: reviewEvidence.reviewDecisionSource,
    });

    return [
      `Evidence details for PR #${evidence.number}:`,
      "",
      "Validation:",
      "",
      renderDetailList([
        `Workflow coverage: ${validationEvidence.workflowRunCoverage ?? "unavailable"}`,
        `Workflow conclusions: ${formatNamedValues(workflowRunConclusions)}`,
        `Failed checks: ${validationEvidence.failedCheckRuns ?? 0}`,
        `Failed workflows: ${validationEvidence.failedWorkflowRuns ?? 0}`,
        `Cancelled workflows: ${validationEvidence.cancelledWorkflowRuns ?? 0}`,
      ]),
      "",
      "Review:",
      "",
      renderDetailList([
        `Review thread source: ${reviewEvidence.reviewThreadSource ?? "unavailable"}`,
        `Threads: ${reviewEvidence.reviewThreads ?? 0}`,
        `Resolved threads: ${reviewEvidence.resolvedThreads ?? 0}`,
        `Outdated threads: ${reviewEvidence.outdatedThreads ?? 0}`,
        `Review decision: ${reviewEvidence.reviewDecision ?? "unavailable"} (source: ${reviewEvidence.reviewDecisionSource ?? "unavailable"})`,
        `Human reviewers: ${formatObservedCount(reviewEvidence.humanReviewerCount, observedReviewDecision)}`,
        `Human approved: ${formatObservedBoolean(reviewEvidence.humanApproved, observedReviewDecision)}`,
        `Human changes requested: ${formatObservedBoolean(reviewEvidence.humanChangesRequested, observedReviewDecision)}`,
        `Comment sources: ${formatNamedValues(reviewCommentSources)}`,
      ]),
      "",
      "Source labels:",
      "",
      renderDetailList([
        `PR class: ${formatPrClass(evidence.prClass)}`,
        `Workflow source: ${validationEvidence.workflowRunSource ?? "unavailable"}`,
      ]),
    ].join("\n");
  }).join("\n\n");
}

function recommendationCategoryLabel(bottleneck) {
  return bottleneck.suggestedAction?.category ?? "unspecified";
}

function recommendationActionText(bottleneck) {
  return bottleneck.suggestedAction?.action ?? "No recommendation was recorded.";
}

function renderList(items) {
  return items.length ? items.map(item => `- ${item}`).join("\n") : "- None";
}

function renderNamedValuesTable(entries) {
  return renderMarkdownTable(
    ["Name", "Value"],
    (entries ?? []).map(entry => [entry.name, entry.value]),
  );
}

function renderRecommendationCategories(categories) {
  return renderMarkdownTable(
    ["Category", "Triggered bottlenecks", "Meaning"],
    (categories ?? []).map(category => [category.label, category.triggeredBottlenecks, category.description]),
  );
}

function triggeredRecommendationCategories(categories) {
  return (categories ?? []).filter(category => Number(category.triggeredBottlenecks ?? 0) > 0);
}

function renderRecommendationCategorySnapshot(categories) {
  const triggered = triggeredRecommendationCategories(categories);
  if (!triggered.length) {
    return "No recommendation categories were triggered by the displayed bottleneck evidence.";
  }

  return renderMarkdownTable(
    ["Category", "Triggered bottlenecks"],
    triggered.map(category => [
      category.label,
      category.triggeredBottlenecks,
    ]),
  );
}

function formatCount(value, singular, plural = `${singular}s`) {
  const count = Number(value ?? 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderInterpretationAndRecommendation(bottleneck) {
  return renderMarkdownTable(
    ["Field", "Value"],
    [
      ["Inferred diagnosis", bottleneck.inferredDiagnosis],
      ["Suggested action", recommendationActionText(bottleneck)],
    ],
  );
}

function renderPriorityExplanation() {
  return renderList([
    "Bottlenecks are ordered by their strongest displayed representative score, not by an opaque composite priority score.",
    "Each score comes from one metric family, such as review-loop drag, validation failures, change scope, planning signals, review surprise, or post-review commits.",
    "Change scope is the internal changed-file-spread signal: core files touched plus directories touched plus functional surfaces touched. It is not a line-count metric.",
    "PR size columns show final/current additions, deletions, changed files, and changed lines so readers can compare size against the detected friction signals.",
    "PR size columns are context for interpreting displayed examples; bottleneck ordering uses each metric family's representative score and stable tie-breaks, not the PR size columns.",
    "Coverage caveats and outlier dominance should be considered before treating the first bottleneck as the most important repository problem.",
  ]);
}

function topBottleneckLabels(report) {
  const bottlenecksById = new Map((report.bottlenecks ?? []).map(bottleneck => [bottleneck.id, bottleneck]));
  const ids = report.summary?.topBottleneckIds ?? [];
  const labels = ids
    .map(id => bottlenecksById.get(id)?.title ?? id)
    .filter(Boolean);
  return labels.length ? labels.join(", ") : "none";
}

function triggeredCategoryLabels(report) {
  const categories = triggeredRecommendationCategories(report.recommendationCategories);
  return categories.length
    ? categories.map(category => `${category.label} (${category.triggeredBottlenecks})`).join(", ")
    : "none";
}

function formatAnalysisFilterStatus(report) {
  const filter = report.analysisFilter;
  if (!filter?.excludedPrClasses?.length) return "none";
  return `excluded PR class(es): ${filter.excludedPrClasses.join(", ")}; filtered sample ${filter.filteredPullRequests} of ${formatCount(filter.originalPullRequests, "collected PR")}`;
}

function renderSummaryTable(report) {
  const summary = report.summary ?? {};
  return renderMarkdownTable(
    ["Metric", "Value"],
    [
      ["Pull requests analyzed", summary.pullRequests],
      ["Changed lines", summary.changedLines],
      ["Non-generated changed lines", summary.nonGeneratedChangedLines],
      ["Review comments", summary.reviewComments],
      ["Review threads", summary.reviewThreads],
      ["Failed checks", summary.failedChecks ?? 0],
      ["Cancelled workflow runs", summary.cancelledWorkflowRuns ?? 0],
      ["Top findings", topBottleneckLabels(report)],
      ["Triggered recommendation categories", triggeredCategoryLabels(report)],
      ["Analysis filter", formatAnalysisFilterStatus(report)],
    ],
  );
}

function renderCoverageSummary(coverage) {
  return renderMarkdownTable(
    ["Evidence area", "Observed coverage"],
    [
      ["PR-open diff", formatCoverageEntries(sortedEntries(coverage.prOpenDiff))],
      ["Workflow runs", formatCoverageEntries(sortedEntries(coverage.workflowRuns))],
      ["Review thread sources", formatCoverageEntries(sortedEntries(coverage.reviewThreads))],
    ],
  );
}

function renderKeyFindings(report) {
  const topBottlenecks = topBottleneckLabels(report);
  const strongest = report.bottlenecks?.[0];
  const dominanceCallouts = (report.bottlenecks ?? [])
    .filter(bottleneck => bottleneck.dominance?.status === "single_pr_dominates")
    .map(bottleneck => `${bottleneck.title}: ${bottleneck.dominance.note}`);
  const classDominanceCallouts = (report.bottlenecks ?? [])
    .filter(bottleneck => bottleneck.classDominance?.status === "single_class_dominates")
    .map(bottleneck => `${bottleneck.title}: ${bottleneck.classDominance.note}`);
  const coverageNotes = report.coverage?.notes?.length
    ? report.coverage.notes.join(" ")
    : "No coverage caveats were recorded for the displayed evidence.";

  return renderList([
    `Top bottlenecks: ${topBottlenecks}.`,
    strongest
      ? `Strongest displayed signal: ${strongest.title} (${strongest.metricLabel}).`
      : "No bottleneck evidence was available.",
    dominanceCallouts.length
      ? `Outlier caveat: ${dominanceCallouts.join(" ")}`
      : "Outlier caveat: displayed bottleneck examples are not dominated by a single PR.",
    classDominanceCallouts.length
      ? `PR class caveat: ${classDominanceCallouts.join(" ")}`
      : classDominanceFallback(report.prClasses),
    `Coverage caveat: ${coverageNotes}`,
  ]);
}

function summarizeFocusCaveats(report) {
  const caveats = [];
  const coverageNotes = report.coverage?.notes ?? [];
  const dominantPrs = (report.bottlenecks ?? [])
    .filter(bottleneck => bottleneck.dominance?.status === "single_pr_dominates");
  const dominantClasses = (report.bottlenecks ?? [])
    .filter(bottleneck => bottleneck.classDominance?.status === "single_class_dominates");

  if (coverageNotes.length) caveats.push(formatCount(coverageNotes.length, "coverage caveat"));
  if (dominantPrs.length) caveats.push(formatCount(dominantPrs.length, "outlier caveat"));
  if (dominantClasses.length) caveats.push(formatCount(dominantClasses.length, "PR class caveat"));
  if (!caveats.length) return "No early confidence caveats were recorded for the displayed evidence.";

  return `${caveats.join(", ")}. Read the evidence and caveat sections before generalizing.`;
}

function renderFocusSnapshot(report) {
  const summary = report.summary ?? {};
  const categories = triggeredCategoryLabels(report);
  const evidenceReviewed = [
    formatCount(summary.pullRequests, "PR"),
    formatCount(summary.changedLines, "changed line"),
    formatCount(summary.nonGeneratedChangedLines, "non-generated changed line"),
    formatCount(summary.reviewComments, "review comment"),
    formatCount(summary.reviewThreads, "review thread"),
    formatCount(summary.failedChecks, "failed check"),
    formatCount(summary.cancelledWorkflowRuns, "cancelled workflow run"),
  ].join(", ");
  const firstInspection = (report.bottlenecks ?? [])
    .slice(0, 3)
    .map(bottleneck => bottleneck.title)
    .join(", ") || "No detailed bottleneck evidence was available.";

  return renderMarkdownTable(
    ["Question", "Answer"],
    [
      ["Focus first", firstInspection],
      ["Action categories", categories],
      ["Evidence reviewed", evidenceReviewed],
      ["Confidence caveats", summarizeFocusCaveats(report)],
    ],
  );
}

function classDominanceFallback(prClasses) {
  const sampleClasses = (prClasses?.distribution ?? []).filter(entry => entry.pullRequests > 0);
  if (!sampleClasses.length) {
    return "PR class caveat: PR class context was not available for the analyzed sample.";
  }
  return sampleClasses.length < 2
    ? "PR class caveat: only one PR class appears in the analyzed sample, so class dominance comparison is not meaningful."
    : "PR class caveat: displayed bottleneck examples are not dominated by one PR class.";
}

function renderPrClassContext(prClasses) {
  const distribution = prClasses?.distribution ?? [];
  if (!distribution.length) return "";

  return [
    "## PR Class Context",
    "",
    prClasses.note ?? "PR class evidence is interpretation context only.",
    "",
    renderMarkdownTable(
      ["Class", "PRs", "Changed lines", "Share", "Sources"],
      distribution.map(entry => [
        entry.class,
        entry.pullRequests,
        entry.changedLines,
        percentageLabel(entry.share),
        formatClassSources(entry.classificationSources),
      ]),
    ),
    "",
  ].join("\n");
}

function renderConfiguredWorkflowContext(configuredWorkflow) {
  const entries = configuredWorkflowEntries(configuredWorkflow);
  if (!entries.length) return "";

  return [
    "## Configured Workflow Context",
    "",
    configuredWorkflow.note ?? CONFIGURED_WORKFLOW_NOTE,
    "",
    renderMarkdownTable(
      ["Field", "Configured value"],
      entries.map(entry => [entry.label, entry.valueLabel]),
    ),
    "",
  ].join("\n");
}

function classDominanceCaveat(bottleneck) {
  return bottleneck.classDominance?.status === "single_class_dominates"
    ? bottleneck.classDominance.note
    : null;
}

function renderSharedSignalInterpretation(sharedSignals) {
  const groups = sharedSignals?.groups ?? [];
  if (!groups.length) return "";

  return [
    "## Shared Signal Interpretation",
    "",
    sharedSignals.note ?? "Shared-signal groups are report interpretation only.",
    "",
    renderList(groups.map(group => {
      const categories = [
        ...new Set((group.bottlenecks ?? []).map(bottleneck => bottleneck.recommendationCategory)),
      ].map(recommendationCategoryDisplay).join(", ");
      return `${group.note} Recommendation categories remain distinct: ${categories || "none"}.`;
    })),
    "",
  ].join("\n");
}

function renderSensitivityAnalysis(sensitivity) {
  const summaries = sensitivity?.summaries ?? [];
  if (!summaries.length) return "";

  const rows = summaries.map(summary => [
    sensitivityPrReference(summary),
    summary.excludedPr.title ?? "unknown",
    summary.affectedBottlenecks
      .map(bottleneck => `${bottleneck.title} (${Math.round(Number(bottleneck.topShare ?? 0) * 100)}%)`)
      .join(", "),
    (summary.baselineTopBottleneckIds ?? []).join(", ") || "none",
    (summary.topBottleneckIdsWithoutPr ?? []).join(", ") || "none",
    summary.interpretation,
  ]);

  return [
    "## Outlier And Sensitivity Analysis",
    "",
    sensitivity.note ?? "Sensitivity summaries are robustness context only.",
    "",
    renderMarkdownTable(
      [
        "Excluded PR",
        "Title",
        "Affected bottlenecks",
        "Baseline top bottlenecks",
        "Top bottlenecks without PR",
        "Robustness interpretation",
      ],
      rows,
    ),
    "",
  ].join("\n");
}

function renderCommentSources(commentSources) {
  const dominantSource = commentSources.dominantSource ?? { name: "none", value: 0 };
  return [
    renderMarkdownTable(
      ["Metric", "Value"],
      [
        ["Total comments", commentSources.totalComments],
        ["Bot/scanner comments", commentSources.botComments],
        ["Human reviewer comments", commentSources.humanComments],
        ["Author replies", commentSources.authorReplies],
        ["Dominant source", `${dominantSource.name} (${dominantSource.value})`],
      ],
    ),
    "",
    "By source:",
    "",
    renderNamedValuesTable(commentSources.bySource),
  ].join("\n");
}

function renderSurfaces(surfaces) {
  return [
    renderMarkdownTable(
      ["Metric", "Value"],
      [
        ["Core changed lines", surfaces.coreChangedLines],
        ["Low-signal changed lines", surfaces.lowSignalChangedLines],
        ["Low-signal files", surfaces.lowSignalFiles],
        ["Weighted changed lines", surfaces.weightedChangedLines],
        ["Small-diff wide-spread PRs", surfaces.smallDiffWideSpreadCount],
      ],
    ),
    "",
    "Functional surfaces:",
    "",
    renderNamedValuesTable(surfaces.byFunctionalSurface),
    "",
    "File roles:",
    "",
    renderNamedValuesTable(surfaces.byRole),
  ].join("\n");
}

function renderGuardrails(guardrails) {
  return renderMarkdownTable(
    ["Guardrail", "Value"],
    [
      ["Avoids individual ranking", guardrails.avoidsIndividualRanking],
      ["Separates observed, inferred, and suggested fields", guardrails.separatesObservedInferredAndSuggested],
      ["Uses composite score", guardrails.usesCompositeScore],
    ],
  );
}

export function renderRepositoryFrictionMarkdown(report) {
  const repository = report.targetRepository
    ? `${report.targetRepository.owner}/${report.targetRepository.name}`
    : "unknown repository";
  const sharedSignals = report.sharedSignals ?? summarizeSharedSignals(report.bottlenecks);
  const sharedNotes = sharedEvidenceNotes(report.bottlenecks);
  const analysisFilterLines = analysisFilterMarkdownLines(report.analysisFilter);
  const lines = [
    `# Repository Friction Report: ${repository}`,
    "",
    `Report version: ${report.reportVersion}`,
    `Metric version: ${report.metricVersion}`,
    `Pull requests analyzed: ${report.summary?.pullRequests ?? "unknown"}`,
    "",
    ...analysisFilterLines,
    "## Executive Summary",
    "",
    renderSummaryTable(report),
    "",
    "## Focus Snapshot",
    "",
    renderFocusSnapshot(report),
    "",
    "## Recommendation Category Snapshot",
    "",
    renderRecommendationCategorySnapshot(report.recommendationCategories ?? []),
    "",
    "## How To Read This Report",
    "",
    "- Observed evidence is measured from GitHub data and repository-profile classifications.",
    "- Interpretation is the analyzer's explanation of what the observed evidence suggests.",
    "- Recommendation is a workflow intervention to consider; the report does not modify repositories.",
    "- Confidence and caveats call out outliers, missing coverage, and evidence-quality limits before you act.",
    ...(hasConfiguredWorkflowContext(report.configuredWorkflow)
      ? ["- Configured workflow context, when shown, comes from the repository profile and is not observed GitHub evidence."]
      : []),
    "",
    ...(hasConfiguredWorkflowContext(report.configuredWorkflow)
      ? [renderConfiguredWorkflowContext(report.configuredWorkflow)]
      : []),
    "## Evidence Quality And Coverage",
    "",
    renderCoverageSummary(report.coverage),
    "",
    "Coverage notes:",
    "",
    renderList(report.coverage.notes),
    "",
    "## Key Findings",
    "",
    renderKeyFindings(report),
    "",
    renderPrClassContext(report.prClasses),
    renderSharedSignalInterpretation(sharedSignals),
    renderSensitivityAnalysis(report.sensitivity),
    "## How Bottlenecks Are Prioritized",
    "",
    renderPriorityExplanation(),
    "",
    "## Ranked Bottlenecks",
    "",
  ];

  for (const bottleneck of report.bottlenecks) {
    lines.push(
      `### ${bottleneck.title}`,
      "",
      `Recommendation category: ${recommendationCategoryLabel(bottleneck)}`,
      "",
      `#### ${bottleneck.title} Observed Evidence (${bottleneck.metricLabel})`,
      "",
      renderEvidenceTable(bottleneck.observedData),
      "",
      renderEvidenceDetails(bottleneck.observedData),
      "",
      `#### ${bottleneck.title} Interpretation And Recommendation`,
      "",
      renderInterpretationAndRecommendation(bottleneck),
      "",
      `#### ${bottleneck.title} Confidence And Caveats`,
      "",
      renderList([
        bottleneck.dominance?.note ?? "Not enough positive examples to evaluate outlier dominance.",
        classDominanceCaveat(bottleneck),
        sharedNotes.get(bottleneck.id),
      ].filter(Boolean)),
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
    renderCommentSources(report.commentSources),
    "",
    "## Core And Support Surfaces",
    "",
    renderSurfaces(report.surfaces),
    "",
    "## Methodology Summary",
    "",
    "- Pull requests are selected upstream by the collection or fixture workflow; this renderer explains the resulting metrics summary.",
    "- File roles and functional surfaces come from repository-profile classification, not from language names alone.",
    "- Bottlenecks are ranked by their strongest representative observed signal, with stable category order only used to break ties.",
    "- Recommendations are inferred from transparent component evidence and representative PR examples; they are not automated changes.",
    "- Missing or partial GitHub data remains visible in coverage tables rather than being inferred from unrelated fields.",
    ...(hasConfiguredWorkflowContext(report.configuredWorkflow)
      ? ["- Configured workflow context is user-configured repository-profile context; it does not change scoring, ranking, CSV exports, or PR class matching."]
      : []),
    "- Sensitivity analysis, when present, excludes one dominant representative PR at a time to show robustness context without changing the baseline ranking.",
    report.analysisFilter?.excludedPrClasses?.length
      ? "- PR class filtering was explicitly applied before metrics and ranking; PR class context still supports interpretation of the filtered sample."
      : "- PR class context is interpretation support only; it does not filter PRs or change bottleneck ranking.",
    "- Full live analysis runs also write a detailed companion methodology artifact: `methodology.md`.",
    "",
    "## Guardrails And Follow-Up",
    "",
    renderGuardrails(report.guardrails),
    "",
    "Follow-up:",
    "",
    renderList(report.followUp),
    "",
    "Artifact sensitivity:",
    "",
    report.artifactSensitivity ?? "Generated artifacts may include repository names, PR URLs, titles, file paths, and comment metadata. Treat them as local/private unless intentionally shared.",
    "",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function analysisFilterMarkdownLines(analysisFilter) {
  if (!analysisFilter?.excludedPrClasses?.length) return [];
  return [
    `Analysis filter: excluded PR class(es): ${analysisFilter.excludedPrClasses.join(", ")}.`,
    `Filtered sample: ${analysisFilter.filteredPullRequests} of ${analysisFilter.originalPullRequests} collected pull request(s).`,
    "",
  ];
}

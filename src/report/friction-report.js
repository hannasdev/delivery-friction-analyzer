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

function nonZeroEntries(object = {}) {
  return sortedEntries(object).filter(entry => entry.value > 0);
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
      commentSources,
      botComments,
      humanReviewerComments: pr?.review?.comments?.bySource?.human_reviewer ?? 0,
      authorReplies: pr?.review?.comments?.bySource?.author_reply ?? 0,
    },
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
      const dominance = summarizeEvidenceDominance(evidence);
      return {
        definitionIndex,
        rankValue: evidence[0]?.value ?? 0,
        id: definition.id,
        title: definition.title,
        metricLabel: definition.metricLabel,
        observedData: evidence,
        dominance,
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

function escapeMarkdownText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_\[\]]/g, "\\$&");
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

function evidenceSignature(bottleneck) {
  return (bottleneck.observedData ?? []).map(evidence => evidence.number).join(",");
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

function changedLinesLabel(value) {
  return value === null || value === undefined ? "unknown" : String(value);
}

function evidenceRows(observedData) {
  return (observedData ?? []).map(evidence => {
    const validationEvidence = evidence.validationEvidence ?? {};
    const reviewEvidence = evidence.reviewEvidence ?? {};
    const workflowRunConclusions = validationEvidence.workflowRunConclusions ?? [];
    const reviewCommentSources = reviewEvidence.commentSources ?? [];

    return [
      prReference(evidence),
      evidence.title,
      evidence.value,
      changedLinesLabel(evidence.changedLines),
      [
        `coverage ${validationEvidence.workflowRunCoverage ?? "unavailable"}`,
        `conclusions ${formatNamedValues(workflowRunConclusions)}`,
        `failed checks ${validationEvidence.failedCheckRuns ?? 0}`,
        `failed workflows ${validationEvidence.failedWorkflowRuns ?? 0}`,
        `cancelled workflows ${validationEvidence.cancelledWorkflowRuns ?? 0}`,
      ].join("; "),
      [
        `threads ${reviewEvidence.reviewThreads ?? 0}`,
        `resolved ${reviewEvidence.resolvedThreads ?? 0}`,
        `outdated ${reviewEvidence.outdatedThreads ?? 0}`,
        `comments ${formatNamedValues(reviewCommentSources)}`,
      ].join("; "),
      [
        `workflow ${validationEvidence.workflowRunSource ?? "unavailable"}`,
        `review ${reviewEvidence.reviewThreadSource ?? "unavailable"}`,
      ].join("; "),
    ];
  });
}

function renderEvidenceTable(observedData) {
  return renderMarkdownTable(
    ["PR", "Title", "Score", "Changed lines", "Validation evidence", "Review evidence", "Source labels"],
    evidenceRows(observedData),
  );
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

function renderSummaryTable(summary) {
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
      ["Top bottlenecks", (summary.topBottleneckIds ?? []).join(", ") || "none"],
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
  const topBottlenecks = (report.summary.topBottleneckIds ?? []).join(", ") || "none";
  const strongest = report.bottlenecks?.[0];
  const dominanceCallouts = (report.bottlenecks ?? [])
    .filter(bottleneck => bottleneck.dominance?.status === "single_pr_dominates")
    .map(bottleneck => `${bottleneck.title}: ${bottleneck.dominance.note}`);
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
    `Coverage caveat: ${coverageNotes}`,
  ]);
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
    renderNamedValuesTable(surfaces.byFunctionalSurface),
    "",
    "File roles:",
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
  const sharedNotes = sharedEvidenceNotes(report.bottlenecks);
  const lines = [
    `# Repository Friction Report: ${repository}`,
    "",
    `Report version: ${report.reportVersion}`,
    `Metric version: ${report.metricVersion}`,
    `Analysis window: ${report.targetRepository?.analysisWindowDays ?? "unknown"} days`,
    "",
    "## Executive Summary",
    "",
    renderSummaryTable(report.summary),
    "",
    "## How To Read This Report",
    "",
    "- Observed evidence is measured from GitHub data and repository-profile classifications.",
    "- Interpretation is the analyzer's explanation of what the observed evidence suggests.",
    "- Recommendation is a workflow intervention to consider; the report does not modify repositories.",
    "- Confidence and caveats call out outliers, missing coverage, and evidence-quality limits before you act.",
    "",
    "## Evidence Quality And Coverage",
    "",
    renderCoverageSummary(report.coverage),
    "",
    "Coverage notes:",
    renderList(report.coverage.notes),
    "",
    "## Key Findings",
    "",
    renderKeyFindings(report),
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
      `#### Observed Evidence (${bottleneck.metricLabel})`,
      "",
      renderEvidenceTable(bottleneck.observedData),
      "",
      "#### Interpretation",
      "",
      bottleneck.inferredDiagnosis,
      "",
      "#### Recommendation",
      "",
      recommendationActionText(bottleneck),
      "",
      "#### Confidence And Caveats",
      "",
      renderList([
        bottleneck.dominance?.note ?? "Not enough positive examples to evaluate outlier dominance.",
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

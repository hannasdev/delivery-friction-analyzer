const BOT_OR_SCANNER_SOURCES = new Set([
  "copilot",
  "github_actions_bot",
  "dependency_bot",
  "code_scanning",
  "unknown_bot",
]);
const HUMAN_OR_AUTHOR_SOURCES = new Set(["human_reviewer", "author_reply"]);

const SCORE_COLUMNS = [
  ["review_churn_score", "reviewChurn"],
  ["changed_file_spread_score", "changedFileSpread"],
  ["validation_gap_score", "validationGap"],
  ["planning_gap_score", "planningGap"],
  ["review_surprise_score", "reviewSurprise"],
  ["fix_amplification_score", "fixAmplification"],
];

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const rawValue = String(value);
  const stringValue = typeof value === "string" && (/^[=+\-@\t\r\n]/.test(rawValue) || /^\s*[=+\-@]/u.test(rawValue))
    ? `'${rawValue}`
    : rawValue;
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function renderCsv(headers, rows) {
  return `${[
    headers.map(csvValue).join(","),
    ...rows.map(row => headers.map(header => csvValue(row[header])).join(",")),
  ].join("\n")}\n`;
}

function analysisFilterCsvMetadata(analysisFilter) {
  if (!analysisFilter?.excludedPrClasses?.length) return { headers: [], row: {} };
  return {
    headers: [
      "analysis_filter_excluded_pr_classes",
      "analysis_filter_original_pull_requests",
      "analysis_filter_filtered_pull_requests",
    ],
    row: {
      analysis_filter_excluded_pr_classes: analysisFilter.excludedPrClasses.join(";"),
      analysis_filter_original_pull_requests: analysisFilter.originalPullRequests,
      analysis_filter_filtered_pull_requests: analysisFilter.filteredPullRequests,
    },
  };
}

function renderEvidenceCsv(headers, rows, analysisFilter) {
  const metadata = analysisFilterCsvMetadata(analysisFilter);
  if (!metadata.headers.length) return renderCsv(headers, rows);
  return renderCsv(
    [...headers, ...metadata.headers],
    rows.map(row => ({ ...row, ...metadata.row })),
  );
}

function rankingValueMaps(metricsSummary) {
  return Object.fromEntries(
    SCORE_COLUMNS.map(([, rankingKey]) => [
      rankingKey,
      new Map((metricsSummary.rankings?.[rankingKey] ?? []).map(entry => [entry.number, entry.value])),
    ]),
  );
}

function sortedPullRequests(metricsSummary) {
  return [...(metricsSummary.pullRequests ?? [])].sort((left, right) => left.number - right.number);
}

function formatCommentSources(entries) {
  return (entries ?? []).map(entry => `${entry.name}=${entry.value}`).join("; ");
}

function formatSourceLabels(evidence) {
  return [
    `workflow=${evidence.validationEvidence?.workflowRunSource ?? "unavailable"}`,
    `review=${evidence.reviewEvidence?.reviewThreadSource ?? "unavailable"}`,
  ].join("; ");
}

function hasObservedWorkflowRuns(workflowRuns = {}) {
  return (workflowRuns.coverage ?? workflowRuns.workflowRunCoverage) === "observed";
}

function hasObservedReviewThreads(reviewThreads = {}) {
  const source = reviewThreads.source ?? reviewThreads.reviewThreadSource ?? "unavailable";
  return String(source).startsWith("graphql");
}

function hasObservedReviewDecision(reviewDecision = {}) {
  return (reviewDecision.source ?? "unavailable") !== "unavailable"
    && (reviewDecision.state ?? "unavailable") !== "unavailable";
}

function unavailableUnlessObserved(value, observed) {
  return observed ? value : null;
}

function prMetricsCsv(metricsSummary, analysisFilter) {
  const scoreMaps = rankingValueMaps(metricsSummary);
  const headers = [
    "pr_number",
    "title",
    "url",
    "pr_class",
    "pr_classification_source",
    "pr_class_rule_id",
    "changed_lines",
    "non_generated_changed_lines",
    "review_comments",
    "review_threads",
    "review_decision",
    "human_reviewer_count",
    "human_approved",
    "human_changes_requested",
    "failed_checks",
    "failed_workflow_runs",
    "cancelled_workflow_runs",
    "post_review_commits",
    "review_thread_source",
    "workflow_run_source",
    "workflow_run_coverage",
    ...SCORE_COLUMNS.map(([header]) => header),
  ];
  const rows = sortedPullRequests(metricsSummary).map(pr => {
    const observedReviewThreads = hasObservedReviewThreads(pr.review?.threads);
    const observedReviewDecision = hasObservedReviewDecision(pr.review?.decision);
    const observedWorkflowRuns = hasObservedWorkflowRuns(pr.ci?.workflowRuns);
    const row = {
      pr_number: pr.number,
      title: pr.title,
      url: pr.url,
      pr_class: pr.prClass?.class ?? "unknown",
      pr_classification_source: pr.prClass?.classificationSource ?? "fallback_rule",
      pr_class_rule_id: pr.prClass?.ruleId ?? null,
      changed_lines: pr.diffAtMerge?.changedLines,
      non_generated_changed_lines: pr.files?.nonGeneratedChangedLines,
      review_comments: pr.review?.comments?.totalCount,
      review_threads: unavailableUnlessObserved(pr.review?.threads?.totalCount, observedReviewThreads),
      review_decision: pr.review?.decision?.state ?? "unavailable",
      human_reviewer_count: unavailableUnlessObserved(pr.review?.decision?.humanReviewerCount ?? 0, observedReviewDecision),
      human_approved: unavailableUnlessObserved(pr.review?.decision?.humanApproved ?? false, observedReviewDecision),
      human_changes_requested: unavailableUnlessObserved(pr.review?.decision?.humanChangesRequested ?? false, observedReviewDecision),
      failed_checks: pr.ci?.checkRuns?.failedCount,
      failed_workflow_runs: unavailableUnlessObserved(pr.ci?.workflowRuns?.failedCount, observedWorkflowRuns),
      cancelled_workflow_runs: unavailableUnlessObserved(pr.ci?.workflowRuns?.cancelledCount, observedWorkflowRuns),
      post_review_commits: pr.iteration?.commitsAfterFirstReview,
      review_thread_source: pr.review?.threads?.source ?? "unavailable",
      workflow_run_source: pr.ci?.workflowRuns?.source ?? "unavailable",
      workflow_run_coverage: pr.ci?.workflowRuns?.coverage ?? "unavailable",
    };
    for (const [header, rankingKey] of SCORE_COLUMNS) {
      row[header] = scoreMaps[rankingKey].get(pr.number);
    }
    return row;
  });
  return renderEvidenceCsv(headers, rows, analysisFilter);
}

function bottleneckExamplesCsv(report, analysisFilter) {
  const headers = [
    "bottleneck_id",
    "bottleneck_title",
    "recommendation_category",
    "pr_number",
    "title",
    "url",
    "score",
    "changed_lines",
    "failed_checks",
    "failed_workflow_runs",
    "cancelled_workflow_runs",
    "review_threads",
    "resolved_threads",
    "outdated_threads",
    "comment_sources",
    "workflow_run_source",
    "workflow_run_coverage",
    "review_thread_source",
    "dominance_status",
    "dominant_pr_number",
    "evidence_source_labels",
  ];
  const rows = [];
  for (const bottleneck of report.bottlenecks ?? []) {
    for (const evidence of bottleneck.observedData ?? []) {
      const observedWorkflowRuns = hasObservedWorkflowRuns(evidence.validationEvidence);
      const observedReviewThreads = hasObservedReviewThreads(evidence.reviewEvidence);
      rows.push({
        bottleneck_id: bottleneck.id,
        bottleneck_title: bottleneck.title,
        recommendation_category: bottleneck.suggestedAction?.category,
        pr_number: evidence.number,
        title: evidence.title,
        url: evidence.url,
        score: evidence.value,
        changed_lines: evidence.changedLines,
        failed_checks: evidence.validationEvidence?.failedCheckRuns,
        failed_workflow_runs: unavailableUnlessObserved(evidence.validationEvidence?.failedWorkflowRuns, observedWorkflowRuns),
        cancelled_workflow_runs: unavailableUnlessObserved(evidence.validationEvidence?.cancelledWorkflowRuns, observedWorkflowRuns),
        review_threads: unavailableUnlessObserved(evidence.reviewEvidence?.reviewThreads, observedReviewThreads),
        resolved_threads: unavailableUnlessObserved(evidence.reviewEvidence?.resolvedThreads, observedReviewThreads),
        outdated_threads: unavailableUnlessObserved(evidence.reviewEvidence?.outdatedThreads, observedReviewThreads),
        comment_sources: formatCommentSources(evidence.reviewEvidence?.commentSources),
        workflow_run_source: evidence.validationEvidence?.workflowRunSource ?? "unavailable",
        workflow_run_coverage: evidence.validationEvidence?.workflowRunCoverage ?? "unavailable",
        review_thread_source: evidence.reviewEvidence?.reviewThreadSource ?? "unavailable",
        dominance_status: bottleneck.dominance?.status,
        dominant_pr_number: bottleneck.dominance?.topPrNumber,
        evidence_source_labels: formatSourceLabels(evidence),
      });
    }
  }
  return renderEvidenceCsv(headers, rows, analysisFilter);
}

function commentSourcesCsv(report, analysisFilter) {
  const totalComments = Number(report.commentSources?.totalComments ?? 0);
  const headers = [
    "source_name",
    "total_comments",
    "is_bot_or_scanner",
    "is_human_or_author",
    "share_of_all_comments",
  ];
  const rows = (report.commentSources?.bySource ?? []).map(entry => ({
    source_name: entry.name,
    total_comments: entry.value,
    is_bot_or_scanner: BOT_OR_SCANNER_SOURCES.has(entry.name),
    is_human_or_author: HUMAN_OR_AUTHOR_SOURCES.has(entry.name),
    share_of_all_comments: totalComments > 0 ? Math.round((entry.value / totalComments) * 10000) / 10000 : 0,
  }));
  return renderEvidenceCsv(headers, rows, analysisFilter);
}

function collectionCoverageCsv(collectionCoverage, analysisFilter) {
  const headers = [
    "api_family",
    "status",
    "attempts",
    "source",
    "diagnostics",
    "downstream_impact",
  ];
  const rows = [...(collectionCoverage?.apiFamilies ?? [])]
    .sort((left, right) => String(left.family).localeCompare(String(right.family)))
    .map(family => ({
      api_family: family.family,
      status: family.status,
      attempts: family.attempts ?? 1,
      source: family.source,
      diagnostics: (family.diagnostics ?? []).join(" | "),
      downstream_impact: family.downstreamImpact,
    }));
  return renderEvidenceCsv(headers, rows, analysisFilter);
}

export function generateEvidenceCsvArtifacts({ metricsSummary, report, collectionCoverage }) {
  const analysisFilter = report?.analysisFilter ?? metricsSummary?.analysisFilter;
  return {
    prMetricsCsv: prMetricsCsv(metricsSummary, analysisFilter),
    bottleneckExamplesCsv: bottleneckExamplesCsv(report, analysisFilter),
    commentSourcesCsv: commentSourcesCsv(report, analysisFilter),
    collectionCoverageCsv: collectionCoverageCsv(collectionCoverage, analysisFilter),
  };
}

function repositoryLabel(report) {
  return report.targetRepository
    ? `${report.targetRepository.owner}/${report.targetRepository.name}`
    : "unknown repository";
}

function formatCoverageFamilies(collectionCoverage) {
  const families = collectionCoverage?.apiFamilies ?? [];
  if (!families.length) return "- No collection coverage families were recorded.";
  return families
    .map(family => {
      const diagnosticsText = (family.diagnostics ?? []).join(" | ").replace(/\.+$/u, "");
      const impactText = String(family.downstreamImpact ?? "").replace(/\.+$/u, "");
      const diagnostics = (family.diagnostics ?? []).length
        ? ` Diagnostics: ${diagnosticsText}.`
        : "";
      const impact = family.downstreamImpact ? ` Impact: ${impactText}.` : "";
      return `- ${family.family}: ${family.status}; attempts=${family.attempts ?? 1}; source=${family.source ?? "unavailable"}.${diagnostics}${impact}`;
    })
    .join("\n");
}

function formatArtifactList(artifactFileNames, csvEnabled) {
  const entries = [
    ["Markdown report", artifactFileNames.reportMarkdown],
    ["JSON report", artifactFileNames.reportJson],
    ["Methodology", artifactFileNames.methodology],
    ["Source bundle", artifactFileNames.sourceBundle],
    ["Normalized data", artifactFileNames.normalized],
    ["Metrics summary", artifactFileNames.metricsSummary],
  ];
  if (csvEnabled) {
    entries.push(
      ["PR metrics CSV", artifactFileNames.prMetricsCsv],
      ["Bottleneck examples CSV", artifactFileNames.bottleneckExamplesCsv],
      ["Comment sources CSV", artifactFileNames.commentSourcesCsv],
      ["Collection coverage CSV", artifactFileNames.collectionCoverageCsv],
    );
  }
  return entries.map(([label, fileName]) => `- ${label}: \`${fileName}\``).join("\n");
}

function formatAnalysisFilter(report) {
  const analysisFilter = report.analysisFilter;
  if (!analysisFilter?.excludedPrClasses?.length) {
    return "No PR class filter was applied; downstream artifacts use the full collected sample.";
  }
  return [
    `Excluded PR class(es): ${analysisFilter.excludedPrClasses.join(", ")}.`,
    `Filtered sample: ${analysisFilter.filteredPullRequests} of ${analysisFilter.originalPullRequests} collected pull request(s).`,
    "`source-bundle.json` preserves the full collected sample; normalized, metrics, report, methodology, and CSV artifacts use the filtered sample.",
  ].join(" ");
}

function formatSensitivitySummaries(report) {
  const summaries = report.sensitivity?.summaries ?? [];
  if (!summaries.length) return "- No displayed bottleneck examples were dominated by one PR.";
  return summaries.map(summary => {
    const affected = summary.affectedBottlenecks.map(bottleneck => bottleneck.title).join(", ") || "none";
    return [
      `- PR #${summary.excludedPr.number} (${summary.excludedPr.title ?? "unknown title"}) dominated: ${affected}.`,
      `  Baseline top bottlenecks: ${(summary.baselineTopBottleneckIds ?? []).join(", ") || "none"}.`,
      `  Top bottlenecks without that PR: ${(summary.topBottleneckIdsWithoutPr ?? []).join(", ") || "none"}.`,
      `  Interpretation: ${summary.interpretation}`,
    ].join("\n");
  }).join("\n");
}

export function renderRepositoryFrictionMethodology({
  report,
  sourceBundle,
  profilePath,
  artifactFileNames,
  csvEnabled,
}) {
  const selection = sourceBundle?.selection ?? {};
  const collectionCoverage = sourceBundle?.coverage ?? report.collectionCoverage;

  return `${[
    `# Methodology: ${repositoryLabel(report)}`,
    "",
    `Report version: ${report.reportVersion}`,
    `Metric version: ${report.metricVersion}`,
    `Repository: ${repositoryLabel(report)}`,
    `Profile path: ${profilePath ?? "not recorded"}`,
    `Requested pull requests: ${selection.requestedLimit ?? "unknown"}`,
    `Collected pull requests: ${selection.collectedCount ?? report.summary?.pullRequests ?? "unknown"}`,
    `Collection coverage: ${collectionCoverage?.status ?? "unknown"}`,
    `Analysis filter: ${formatAnalysisFilter(report)}`,
    "",
    "## What This Analysis Uses",
    "",
    "The analyzer collects merged GitHub pull requests, normalizes repository-specific fields through the supplied profile, computes transparent component metrics, and renders a repository-level report. It does not inspect local working trees, mutate repositories, rank people, or apply recommendations automatically.",
    "",
    "## Pull Request Selection",
    "",
    "Pull requests are selected by the collection step before report rendering. The default live path samples the latest merged pull requests up to the requested limit. Coverage gaps are preserved as explicit unavailable or partial values instead of being inferred from unrelated fields.",
    report.analysisFilter?.excludedPrClasses?.length
      ? "PR class filtering is applied after collection and normalization, before metrics computation, so downstream totals, rankings, reports, methodology, and CSVs describe the filtered sample while the source bundle remains auditable."
      : "No PR class filtering was applied for this run.",
    "",
    "## Profile Classification",
    "",
    "The repository profile maps file paths to categories, roles, and functional surfaces. Those classifications drive non-generated changed-line counts, support-surface summaries, planning-document signals, and low-signal weighting.",
    "",
    "## Scores And Rankings",
    "",
    "The report ranks bottlenecks by transparent component metrics from `friction-metrics.v1`: review churn, change scope (the internal changed-file-spread signal: core files plus directories plus functional surfaces touched), validation gap, planning gap, review surprise, and fix amplification. These are not an opaque composite score, and they are not individual contributor or reviewer rankings.",
    "",
    "## Coverage And Limitations",
    "",
    formatCoverageFamilies(collectionCoverage),
    "",
    "Missing PR-open diffs, workflow runs, or review-thread data remain visible in coverage tables. Recommendations should be checked against repository context before maintainers turn them into process changes.",
    "",
    "## Dominance And Sensitivity",
    "",
    "When displayed bottleneck examples are dominated by one PR, the report recomputes the displayed top bottlenecks after excluding that PR from the report-layer sample. This is robustness context only; it does not replace the baseline ranking or imply the PR should be ignored.",
    "",
    formatSensitivitySummaries(report),
    "",
    "## Generated Artifacts",
    "",
    formatArtifactList(artifactFileNames, csvEnabled),
    "",
    "## Artifact Sensitivity",
    "",
    csvEnabled
      ? "Generated artifacts may include repository names, PR URLs, titles, file paths, comment-source counts, and coverage diagnostics. CSV files are curated for spreadsheet inspection but should still be treated as local/private unless intentionally shared."
      : "Generated artifacts may include repository names, PR URLs, titles, file paths, comment metadata, and coverage diagnostics. CSV export generation was disabled for this run.",
    "",
  ].join("\n").trimEnd()}\n`;
}

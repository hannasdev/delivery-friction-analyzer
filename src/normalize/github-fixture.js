import { classifyCommentSource, groupByCommentSource } from "../github/comment-source.js";
import { classifyFilePath } from "../profile/file-role.js";
import { assertValidContributorSource, contributorHintsFromSource } from "../profile/contributor-source.js";
import { assertValidPrClassRules, classifyPullRequest } from "../profile/pr-class.js";
import { assertValidWorkflowContext } from "../profile/workflow.js";

function minDate(values) {
  return values.filter(Boolean).sort()[0] ?? null;
}

function maxDate(values) {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

function flattenThreadComments(reviewThreads = {}) {
  return (reviewThreads.nodes ?? []).flatMap(thread => (
    (thread.comments ?? []).map(comment => ({
      ...comment,
      threadId: thread.id,
      path: comment.path ?? thread.path,
      isResolved: thread.isResolved,
      isOutdated: thread.isOutdated,
    }))
  ));
}

function classifyReviewEventSource(author, { pullRequestAuthorLogin } = {}) {
  const source = classifyCommentSource(author, { pullRequestAuthorLogin });
  const login = String(author?.login ?? "").trim();
  if (source !== "unknown" || !login) {
    return source;
  }
  return "human_reviewer";
}

function normalizeReview(review, { pullRequestAuthorLogin } = {}) {
  const author = review.author ?? {};
  return {
    id: review.id,
    submittedAt: review.submittedAt,
    state: review.state,
    commitOid: review.commitOid ?? review.commit?.oid ?? null,
    source: classifyReviewEventSource(author, { pullRequestAuthorLogin }),
    generatedCommentCount: review.generatedCommentCount ?? null,
    failedAttempt: Boolean(review.failedAttempt),
  };
}

function reviewAuthorKey(review) {
  const author = review.author ?? {};
  return author.login ?? author.id ?? author.node_id ?? author.nodeId ?? review.id ?? null;
}

function reviewState(review) {
  return String(review.state ?? "").toLowerCase();
}

function submittedAtMs(review) {
  const submittedAt = Date.parse(review.submittedAt);
  return Number.isFinite(submittedAt) ? submittedAt : null;
}

function reviewDecisionState(humanReviews) {
  const reviewStates = new Set(humanReviews.map(reviewState));
  const terminalReviews = humanReviews.filter(review => ["approved", "changes_requested"].includes(reviewState(review)));
  const allTerminalReviewsHaveTimestamps = terminalReviews.length > 0
    && terminalReviews.every(review => submittedAtMs(review) !== null);

  if (allTerminalReviewsHaveTimestamps) {
    const latestTerminalReview = [...terminalReviews].sort((left, right) => submittedAtMs(right) - submittedAtMs(left))[0];
    return reviewState(latestTerminalReview);
  }
  if (reviewStates.has("changes_requested")) return "changes_requested";
  if (reviewStates.has("approved")) return "approved";
  if (humanReviews.length > 0) return "commented";
  return "none";
}

function summarizeReviewDecision(pr) {
  if (!Array.isArray(pr.reviews)) {
    return {
      state: "unavailable",
      humanApproved: false,
      humanChangesRequested: false,
      humanReviewerCount: 0,
      source: "unavailable",
    };
  }

  const humanReviews = pr.reviews.filter(review => (
    classifyReviewEventSource(review.author, { pullRequestAuthorLogin: pr.author?.login }) === "human_reviewer"
  ));
  const humanReviewerKeys = new Set(humanReviews.map(reviewAuthorKey).filter(Boolean));
  const states = new Set(humanReviews.map(reviewState));

  return {
    state: reviewDecisionState(humanReviews),
    humanApproved: states.has("approved"),
    humanChangesRequested: states.has("changes_requested"),
    humanReviewerCount: humanReviewerKeys.size,
    source: "reviews",
  };
}

function normalizeCommit(commit) {
  return {
    oid: commit.oid,
    authoredDate: commit.authoredDate ?? null,
    committedDate: commit.committedDate ?? null,
    messageHeadline: commit.messageHeadline ?? null,
  };
}

export function normalizeFixtureBundle(bundle, { repositoryProfile } = {}) {
  const profile = repositoryProfile ?? {};
  assertValidPrClassRules(profile);
  assertValidWorkflowContext(profile);
  assertValidContributorSource(profile);
  const contributorHints = contributorHintsFromSource(bundle.contributorSource);

  const pullRequests = (bundle.pullRequests ?? []).map(pr => {
    const reviewDates = (pr.reviews ?? []).map(review => review.submittedAt);
    const threadComments = flattenThreadComments(pr.reviewThreads);
    return {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      authorLogin: pr.author?.login ?? null,
      prClass: classifyPullRequest(pr, profile),
      lifecycle: {
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt ?? null,
        firstCommitAt: minDate((pr.commits ?? []).map(commit => commit.authoredDate)),
        firstReviewAt: minDate(reviewDates),
        lastReviewAt: maxDate(reviewDates),
      },
      commits: (pr.commits ?? []).map(normalizeCommit),
      diffAtMerge: {
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
      },
      prOpenDiff: pr.prOpenDiff ?? { source: "unavailable", confidence: "unavailable" },
      files: (pr.files ?? []).map(file => ({
        ...classifyFilePath(file.path, profile),
        additions: file.additions,
        deletions: file.deletions,
        changeType: file.changeType,
      })),
      reviews: (pr.reviews ?? []).map(review => normalizeReview(review, { pullRequestAuthorLogin: pr.author?.login })),
      reviewDecision: summarizeReviewDecision(pr),
      reviewThreads: {
        source: pr.reviewThreads?.source ?? "unavailable",
        totalCount: pr.reviewThreads?.totalCount ?? 0,
        resolvedCount: (pr.reviewThreads?.nodes ?? []).filter(thread => thread.isResolved).length,
        outdatedCount: (pr.reviewThreads?.nodes ?? []).filter(thread => thread.isOutdated).length,
      },
      reviewComments: {
        totalCount: threadComments.length,
        bySource: groupByCommentSource(threadComments, { pullRequestAuthorLogin: pr.author?.login, contributorHints }),
      },
      checkRuns: (pr.statusCheckRollup ?? []).map(check => ({
        source: check.__typename === "StatusContext" ? "status_context" : "check_run",
        name: check.name ?? check.context ?? null,
        workflowName: check.workflowName ?? null,
        status: check.status ?? check.state ?? null,
        conclusion: check.conclusion ?? check.state ?? null,
        startedAt: check.startedAt ?? null,
        completedAt: check.completedAt ?? null,
      })),
      workflowRuns: pr.workflowRuns ?? { source: "unavailable", totalCount: null, conclusions: {} },
    };
  });

  return {
    schemaVersion: "normalized-fixture.v1",
    targetRepository: bundle.targetRepository,
    languageDistribution: bundle.languageDistribution,
    ...(bundle.contributorSource ? { contributorSource: bundle.contributorSource } : {}),
    pullRequests,
  };
}

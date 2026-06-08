import { classifyCommentSource, groupByCommentSource } from "../github/comment-source.js";
import { classifyFilePath } from "../profile/file-role.js";

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

function normalizeReview(review) {
  const author = review.author ?? {};
  return {
    id: review.id,
    submittedAt: review.submittedAt,
    state: review.state,
    commitOid: review.commitOid ?? review.commit?.oid ?? null,
    source: classifyCommentSource(author),
    generatedCommentCount: review.generatedCommentCount ?? null,
    failedAttempt: Boolean(review.failedAttempt),
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
  const pullRequests = (bundle.pullRequests ?? []).map(pr => {
    const reviewDates = (pr.reviews ?? []).map(review => review.submittedAt);
    const threadComments = flattenThreadComments(pr.reviewThreads);
    return {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      authorLogin: pr.author?.login ?? null,
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
        ...classifyFilePath(file.path, repositoryProfile),
        additions: file.additions,
        deletions: file.deletions,
        changeType: file.changeType,
      })),
      reviews: (pr.reviews ?? []).map(normalizeReview),
      reviewThreads: {
        source: pr.reviewThreads?.source ?? "unavailable",
        totalCount: pr.reviewThreads?.totalCount ?? 0,
        resolvedCount: (pr.reviewThreads?.nodes ?? []).filter(thread => thread.isResolved).length,
        outdatedCount: (pr.reviewThreads?.nodes ?? []).filter(thread => thread.isOutdated).length,
      },
      reviewComments: {
        totalCount: threadComments.length,
        bySource: groupByCommentSource(threadComments, { pullRequestAuthorLogin: pr.author?.login }),
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
    pullRequests,
  };
}

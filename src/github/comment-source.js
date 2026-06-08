const SOURCE = {
  copilot: "copilot",
  human: "human_reviewer",
  authorReply: "author_reply",
  githubActions: "github_actions_bot",
  dependencyBot: "dependency_bot",
  codeScanning: "code_scanning",
  unknownBot: "unknown_bot",
  unknown: "unknown",
};

export const COMMENT_SOURCES = Object.freeze(Object.values(SOURCE));

export function classifyCommentSource(author = {}, { pullRequestAuthorLogin } = {}) {
  const login = String(author.login ?? "").toLowerCase();
  const type = String(author.type ?? author.__typename ?? "").toLowerCase();
  const url = String(author.htmlUrl ?? author.html_url ?? "").toLowerCase();
  const prAuthorLogin = String(pullRequestAuthorLogin ?? "").toLowerCase();

  if (login === "copilot" || login === "copilot-pull-request-reviewer" || url.includes("/apps/copilot-pull-request-reviewer")) {
    return SOURCE.copilot;
  }

  if (login === "github-actions[bot]" || login === "github-actions" || login.includes("github-actions")) {
    return SOURCE.githubActions;
  }

  if (login.startsWith("dependabot") || login.includes("renovate")) {
    return SOURCE.dependencyBot;
  }

  if (login.includes("codeql") || login.includes("code-scanning") || login.includes("github-code-scanning")) {
    return SOURCE.codeScanning;
  }

  if (type === "bot" || login.endsWith("[bot]")) {
    return SOURCE.unknownBot;
  }

  if (prAuthorLogin && login === prAuthorLogin) {
    return SOURCE.authorReply;
  }

  if (type === "user" || author.authorAssociation) {
    return SOURCE.human;
  }

  return SOURCE.unknown;
}

export function groupByCommentSource(comments, options = {}) {
  const grouped = Object.fromEntries(COMMENT_SOURCES.map(source => [source, 0]));
  for (const comment of comments ?? []) {
    grouped[classifyCommentSource(comment.author, options)] += 1;
  }
  return grouped;
}

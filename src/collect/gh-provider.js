import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const PR_VIEW_FIELDS = [
  "additions",
  "author",
  "baseRefName",
  "changedFiles",
  "commits",
  "createdAt",
  "deletions",
  "files",
  "headRefName",
  "headRefOid",
  "mergedAt",
  "number",
  "reviews",
  "state",
  "statusCheckRollup",
  "title",
  "updatedAt",
  "url",
];

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 100) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              databaseId
              author {
                login
                __typename
              }
              path
              line
              originalLine
              createdAt
              updatedAt
              url
            }
          }
        }
      }
    }
  }
}
`;

function parseJson(stdout, args) {
  try {
    return JSON.parse(stdout || "{}");
  } catch (error) {
    throw new Error(`gh returned invalid JSON for ${args.slice(0, 3).join(" ")}: ${error.message}`);
  }
}

function normalizeGhError(error) {
  const normalized = new Error(error.message);
  normalized.stderr = error.stderr;
  normalized.stdout = error.stdout;
  normalized.exitCode = error.code;
  throw normalized;
}

function graphqlErrorMessage(errors) {
  const messages = errors
    .map(error => error?.message)
    .filter(Boolean);
  if (messages.length === 0) {
    return "GitHub GraphQL returned errors.";
  }
  return `GitHub GraphQL returned errors: ${messages.join("; ")}`;
}

export function createGhCliProvider({ ghPath = "gh", runCommand } = {}) {
  async function runGh(args) {
    if (runCommand) {
      return runCommand(args);
    }

    try {
      const { stdout } = await execFile(ghPath, args, {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      normalizeGhError(error);
    }
  }

  async function runGhJson(args) {
    return parseJson(await runGh(args), args);
  }

  return {
    kind: "gh-cli",

    async getRepository({ owner, name }) {
      return runGhJson(["api", `repos/${owner}/${name}`]);
    },

    async getLanguages({ owner, name }) {
      return runGhJson(["api", `repos/${owner}/${name}/languages`]);
    },

    async listMergedPullRequests({ owner, name, limit }) {
      const prs = await runGhJson([
        "pr",
        "list",
        "--repo",
        `${owner}/${name}`,
        "--state",
        "merged",
        "--search",
        "is:merged sort:merged-desc",
        "--limit",
        String(limit),
        "--json",
        "number,mergedAt,updatedAt",
      ]);

      return [...prs]
        .sort((left, right) => String(right.mergedAt ?? "").localeCompare(String(left.mergedAt ?? "")))
        .slice(0, limit);
    },

    async getPullRequest({ owner, name, number }) {
      return runGhJson([
        "pr",
        "view",
        String(number),
        "--repo",
        `${owner}/${name}`,
        "--json",
        PR_VIEW_FIELDS.join(","),
      ]);
    },

    async getReviewThreads({ owner, name, number }) {
      const nodes = [];
      let totalCount = 0;
      let cursor = null;

      do {
        const args = [
          "api",
          "graphql",
          "-f",
          `owner=${owner}`,
          "-f",
          `name=${name}`,
          "-F",
          `number=${number}`,
          "-f",
          `query=${REVIEW_THREADS_QUERY}`,
        ];
        if (cursor) {
          args.push("-f", `cursor=${cursor}`);
        }
        const data = await runGhJson(args);
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          throw new Error(graphqlErrorMessage(data.errors));
        }
        const root = data.data ?? data;
        const page = root.repository?.pullRequest?.reviewThreads;
        totalCount = page?.totalCount ?? nodes.length;
        nodes.push(...(page?.nodes ?? []));
        cursor = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
      } while (cursor);

      return { totalCount, nodes };
    },

    async getWorkflowRuns({ owner, name, branch }) {
      const workflowRuns = [];
      let totalCount = 0;
      let page = 1;
      let lastData = {};

      do {
        const data = await runGhJson([
          "api",
          `repos/${owner}/${name}/actions/runs`,
          "--method",
          "GET",
          "-f",
          `branch=${branch}`,
          "-f",
          "event=pull_request",
          "-f",
          "per_page=100",
          "-f",
          `page=${page}`,
        ]);
        const pageRuns = data.workflow_runs ?? data.workflowRuns ?? [];
        lastData = data;
        workflowRuns.push(...pageRuns);
        totalCount = data.total_count ?? data.totalCount ?? workflowRuns.length;
        page += 1;
        if (pageRuns.length === 0) {
          break;
        }
      } while (workflowRuns.length < totalCount);

      return {
        ...lastData,
        total_count: totalCount,
        workflow_runs: workflowRuns,
      };
    },
  };
}

export const CONTRIBUTOR_SOURCE_TYPES = Object.freeze([
  "all_contributors",
]);

export const DEFAULT_ALL_CONTRIBUTORS_PATH = ".all-contributorsrc";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasParentDirectorySegment(path) {
  return String(path).split(/[\\/]+/).includes("..");
}

export function normalizeContributorSourceConfig(contributors = null) {
  if (!contributors || typeof contributors !== "object" || Array.isArray(contributors)) {
    return null;
  }
  if (contributors.sourceType === undefined && contributors.path === undefined) {
    return null;
  }
  return {
    sourceType: contributors.sourceType ?? "all_contributors",
    path: contributors.path ?? DEFAULT_ALL_CONTRIBUTORS_PATH,
  };
}

export function validateContributorSource(profile = {}) {
  const errors = [];
  if (!isObject(profile) || !Object.prototype.hasOwnProperty.call(profile, "contributors")) {
    return errors;
  }

  const contributors = profile.contributors;
  if (!isObject(contributors)) {
    return ["contributors must be an object when provided"];
  }
  if (Object.keys(contributors).length === 0) {
    return ["contributors must include at least one field when provided"];
  }

  for (const key of Object.keys(contributors)) {
    if (!["sourceType", "path"].includes(key)) {
      errors.push(`contributors.${key} is not supported`);
    }
  }

  const sourceType = contributors.sourceType ?? "all_contributors";
  if (!CONTRIBUTOR_SOURCE_TYPES.includes(sourceType)) {
    errors.push(`contributors.sourceType must be one of: ${CONTRIBUTOR_SOURCE_TYPES.join(", ")}`);
  }

  if (contributors.path !== undefined) {
    if (typeof contributors.path !== "string" || contributors.path.trim() === "") {
      errors.push("contributors.path must be a non-empty string when provided");
    } else if (contributors.path.startsWith("/") || hasParentDirectorySegment(contributors.path)) {
      errors.push("contributors.path must be a repository-relative path without parent-directory segments");
    }
  }

  return errors;
}

export function assertValidContributorSource(profile = {}) {
  const errors = validateContributorSource(profile);
  if (errors.length > 0) {
    throw new Error(`invalid contributor source profile context: ${errors.join("; ")}`);
  }
}

function loginFromContributor(contributor) {
  if (!isObject(contributor)) return null;
  const candidate = contributor.login ?? contributor.github ?? contributor.username;
  if (typeof candidate !== "string") return null;
  const login = candidate.trim().replace(/^@/, "");
  return login ? login.toLowerCase() : null;
}

export function parseAllContributorsHints(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      status: "malformed",
      hints: { logins: [] },
      diagnostics: [`Could not parse .all-contributorsrc JSON: ${error.message}`],
    };
  }

  if (!isObject(parsed) || !Array.isArray(parsed.contributors)) {
    return {
      status: "malformed",
      hints: { logins: [] },
      diagnostics: [".all-contributorsrc must contain a contributors array."],
    };
  }

  const logins = new Set();
  let malformedEntries = 0;
  for (const contributor of parsed.contributors) {
    const login = loginFromContributor(contributor);
    if (login) {
      logins.add(login);
    } else {
      malformedEntries += 1;
    }
  }

  return {
    status: malformedEntries > 0 ? "partial" : "available",
    hints: { logins: [...logins].sort() },
    diagnostics: malformedEntries > 0
      ? [`Skipped ${malformedEntries} contributor entr${malformedEntries === 1 ? "y" : "ies"} without a supported login hint.`]
      : [],
  };
}

export function contributorHintsFromSource(contributorSource = null) {
  const usableStatuses = new Set(["available", "partial"]);
  if (!usableStatuses.has(contributorSource?.coverage?.status)) {
    return { logins: new Set() };
  }
  const logins = contributorSource?.hints?.logins;
  if (!Array.isArray(logins)) {
    return { logins: new Set() };
  }
  return {
    logins: new Set(logins.map(login => String(login).toLowerCase()).filter(Boolean)),
  };
}

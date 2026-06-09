export const COVERAGE_STATUS = Object.freeze({
  available: "available",
  partial: "partial",
  unavailable: "unavailable",
  rateLimited: "rate_limited",
});

const TOKEN_PATTERNS = [
  /\bghp_[A-Za-z0-9_]+\b/g,
  /\bgho_[A-Za-z0-9_]+\b/g,
  /\bghu_[A-Za-z0-9_]+\b/g,
  /\bghs_[A-Za-z0-9_]+\b/g,
  /\bghr_[A-Za-z0-9_]+\b/g,
  /\bgithub_pat_[A-Za-z0-9_]+(?:_[A-Za-z0-9_]+)*\b/g,
  /\b(GITHUB_TOKEN|GH_TOKEN|GH_ENTERPRISE_TOKEN)=\S+/gi,
  /\b(authorization:\s*)(bearer|token)\s+\S+/gi,
  /\b(token\s+)[A-Za-z0-9_./+=-]{16,}\b/gi,
];

const LOCAL_CREDENTIAL_PATH_PATTERNS = [
  /\/Users\/[^/\s]+\/\.config\/gh\/hosts\.yml/g,
  /\/Users\/[^/\s]+\/\.git-credentials/g,
  /\/home\/[^/\s]+\/\.config\/gh\/hosts\.yml/g,
  /\/home\/[^/\s]+\/\.git-credentials/g,
];

export function redactDiagnostic(value) {
  let text = String(value ?? "");
  for (const pattern of TOKEN_PATTERNS) {
    text = text.replace(pattern, match => {
      const envPrefix = match.match(/^(GITHUB_TOKEN|GH_TOKEN|GH_ENTERPRISE_TOKEN)=/i)?.[0];
      if (envPrefix) return `${envPrefix}[REDACTED]`;
      return "[REDACTED]";
    });
  }
  for (const pattern of LOCAL_CREDENTIAL_PATH_PATTERNS) {
    text = text.replace(pattern, "[local credential path]");
  }
  return text;
}

export function classifyCoverageStatus(error) {
  const text = `${error?.message ?? ""}\n${error?.stderr ?? ""}`.toLowerCase();
  if (text.includes("rate limit") || text.includes("secondary rate") || text.includes("api rate limit exceeded")) {
    return COVERAGE_STATUS.rateLimited;
  }
  return COVERAGE_STATUS.unavailable;
}

export function coverageEntry({ family, source, status, diagnostics = [], downstreamImpact = null, attempts = 1 }) {
  return {
    family,
    source,
    status,
    attempts,
    diagnostics: diagnostics.map(redactDiagnostic).filter(Boolean),
    downstreamImpact,
  };
}

export function mergeCoverageEntries({ family, source, entries, downstreamImpact = null }) {
  const statuses = new Set(entries.map(entry => entry.status));
  let status = COVERAGE_STATUS.available;
  if (statuses.has(COVERAGE_STATUS.rateLimited)) {
    status = COVERAGE_STATUS.rateLimited;
  } else if (statuses.has(COVERAGE_STATUS.unavailable)) {
    status = statuses.size > 1 ? COVERAGE_STATUS.partial : COVERAGE_STATUS.unavailable;
  } else if (statuses.has(COVERAGE_STATUS.partial)) {
    status = COVERAGE_STATUS.partial;
  }

  return coverageEntry({
    family,
    source,
    status,
    attempts: entries.reduce((sum, entry) => sum + (entry.attempts ?? 1), 0),
    diagnostics: entries.flatMap(entry => entry.diagnostics ?? []),
    downstreamImpact,
  });
}

export const FILE_CATEGORIES = Object.freeze([
  "code",
  "tests",
  "docs",
  "config",
  "generated",
  "infrastructure",
  "unknown",
]);

export const FILE_ROLES = Object.freeze([
  "core_product_code",
  "product_ui",
  "tests",
  "generated_docs",
  "release_notes",
  "planning_docs",
  "marketing_site",
  "config",
  "infrastructure",
  "fixtures",
  "generated_or_vendored",
  "unknown",
]);

function ruleMatches(path, match = {}) {
  if (match.exact && path !== match.exact) return false;
  if (match.prefix && !path.startsWith(match.prefix)) return false;
  if (match.suffix && !path.endsWith(match.suffix)) return false;
  if (match.includes && !path.includes(match.includes)) return false;
  if (match.regex && !new RegExp(match.regex).test(path)) return false;
  return Boolean(match.exact || match.prefix || match.suffix || match.includes || match.regex);
}

function inferCategory(path) {
  if (/(^|\/)(test|tests|__tests__)\//.test(path) || /\.(test|spec)\.[cm]?[jt]s$/.test(path)) return "tests";
  if (/\.(md|mdx|txt|adoc)$/.test(path)) return "docs";
  if (/(^|\/)(Dockerfile|docker-compose\.ya?ml)$/.test(path) || path.startsWith(".github/")) return "infrastructure";
  if (/\.(json|ya?ml|toml|ini|env)$/.test(path)) return "config";
  if (/\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|rb|php|cs|swift|kt)$/.test(path)) return "code";
  return "unknown";
}

export function classifyFilePath(path, profile = {}) {
  const normalizedPath = String(path ?? "");
  for (const rule of profile.rules ?? []) {
    if (ruleMatches(normalizedPath, rule.match)) {
      return {
        path: normalizedPath,
        category: rule.category,
        role: rule.role,
        functionalSurface: rule.functionalSurface ?? rule.role,
        generated: Boolean(rule.generated),
        classificationSource: "repository_profile",
        ruleId: rule.id,
      };
    }
  }

  const category = inferCategory(normalizedPath);
  return {
    path: normalizedPath,
    category,
    role: category === "tests" ? "tests" : "unknown",
    functionalSurface: "unknown",
    generated: false,
    classificationSource: "fallback_rule",
    ruleId: null,
  };
}

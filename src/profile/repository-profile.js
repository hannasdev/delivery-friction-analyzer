import { FILE_CATEGORIES, FILE_ROLES } from "./file-role.js";
import { validateContributorSource } from "./contributor-source.js";
import { validatePrClassRules } from "./pr-class.js";
import { validateWorkflowContext } from "./workflow.js";

const REPOSITORY_PROFILE_SCHEMA_VERSION = "repository-profile.v1";
const REPO_SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "repository",
  "rules",
  "prClasses",
  "workflow",
  "contributors",
]);
const REPOSITORY_KEYS = new Set(["owner", "name"]);
const FILE_RULE_KEYS = new Set([
  "id",
  "match",
  "category",
  "role",
  "functionalSurface",
  "generated",
  "notes",
]);
const MATCH_KEYS = new Set(["exact", "prefix", "suffix", "includes", "regex"]);

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function unsupportedKeys(value, allowedKeys, path) {
  return Object.keys(value)
    .filter(key => !allowedKeys.has(key))
    .map(key => `${path}.${key} is not supported`);
}

function ruleLabel(rule, index) {
  return typeof rule?.id === "string" && rule.id.length ? rule.id : `index ${index}`;
}

function validateRepositoryIdentity(profile) {
  const errors = [];
  if (!isPlainObject(profile.repository)) {
    return ["repository must be an object with owner and name"];
  }

  errors.push(...unsupportedKeys(profile.repository, REPOSITORY_KEYS, "repository"));
  for (const field of ["owner", "name"]) {
    const value = profile.repository[field];
    if (typeof value !== "string" || !REPO_SEGMENT_PATTERN.test(value)) {
      errors.push(`repository.${field} must be a GitHub owner/name segment using letters, numbers, dots, underscores, or dashes`);
    }
  }
  return errors;
}

function validateFileRuleMatch(rule, index) {
  const errors = [];
  const label = ruleLabel(rule, index);
  const match = rule.match;
  if (!isPlainObject(match)) {
    return [`rules[${index}] "${label}" match must be an object`];
  }

  errors.push(...unsupportedKeys(match, MATCH_KEYS, `rules[${index}] "${label}" match`));
  const configuredMatchers = [...MATCH_KEYS]
    .filter(key => Object.prototype.hasOwnProperty.call(match, key));
  if (configuredMatchers.length === 0) {
    errors.push(`rules[${index}] "${label}" match must include at least one matcher: exact, prefix, suffix, includes, or regex`);
  }

  for (const field of MATCH_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(match, field)) continue;
    const value = match[field];
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`rules[${index}] "${label}" match.${field} must be a non-empty string`);
      continue;
    }
    if (field === "regex") {
      try {
        new RegExp(value);
      } catch (error) {
        errors.push(`rules[${index}] "${label}" match.regex is not a valid JavaScript regex: ${error.message}`);
      }
    }
  }

  return errors;
}

export function validateFileRoleRules(profile = {}) {
  const errors = [];
  if (!isPlainObject(profile)) return errors;
  if (!Object.prototype.hasOwnProperty.call(profile, "rules")) {
    return ["rules is required"];
  }

  const rules = profile.rules;
  if (!Array.isArray(rules)) {
    return ["rules must be an array"];
  }

  const seenRuleIds = new Set();
  for (const [index, rule] of rules.entries()) {
    const label = ruleLabel(rule, index);
    if (!isPlainObject(rule)) {
      errors.push(`rules[${index}] must be an object`);
      continue;
    }

    errors.push(...unsupportedKeys(rule, FILE_RULE_KEYS, `rules[${index}] "${label}"`));

    if (typeof rule.id !== "string" || !IDENTIFIER_PATTERN.test(rule.id)) {
      errors.push(`rules[${index}].id must be a non-empty lowercase identifier using letters, digits, "-" or "_" separators`);
    } else if (seenRuleIds.has(rule.id)) {
      errors.push(`rules rule id "${rule.id}" is duplicated`);
    } else {
      seenRuleIds.add(rule.id);
    }

    errors.push(...validateFileRuleMatch(rule, index));

    if (!FILE_CATEGORIES.includes(rule.category)) {
      errors.push(`rules[${index}] "${label}" category must be one of: ${FILE_CATEGORIES.join(", ")}`);
    }
    if (!FILE_ROLES.includes(rule.role)) {
      errors.push(`rules[${index}] "${label}" role must be one of: ${FILE_ROLES.join(", ")}`);
    }
    if (
      rule.functionalSurface !== undefined
      && (typeof rule.functionalSurface !== "string" || !IDENTIFIER_PATTERN.test(rule.functionalSurface))
    ) {
      errors.push(`rules[${index}] "${label}" functionalSurface must be a lowercase identifier using letters, digits, "-" or "_" separators`);
    }
    if (rule.generated !== undefined && typeof rule.generated !== "boolean") {
      errors.push(`rules[${index}] "${label}" generated must be a boolean when provided`);
    }
    if (rule.notes !== undefined && typeof rule.notes !== "string") {
      errors.push(`rules[${index}] "${label}" notes must be a string when provided`);
    }
  }

  return errors;
}

export function validateRepositoryProfile(profile = {}) {
  const errors = [];
  if (!isPlainObject(profile)) {
    return ["profile must be an object"];
  }

  errors.push(...unsupportedKeys(profile, TOP_LEVEL_KEYS, "profile"));

  if (profile.schemaVersion !== REPOSITORY_PROFILE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${REPOSITORY_PROFILE_SCHEMA_VERSION}`);
  }
  errors.push(...validateRepositoryIdentity(profile));
  errors.push(...validateFileRoleRules(profile));
  errors.push(...validatePrClassRules(profile));
  errors.push(...validateWorkflowContext(profile));
  errors.push(...validateContributorSource(profile));

  return errors;
}

export function assertValidRepositoryProfile(profile = {}) {
  const errors = validateRepositoryProfile(profile);
  if (errors.length > 0) {
    throw new Error(`invalid repository profile: ${errors.join("; ")}`);
  }
}

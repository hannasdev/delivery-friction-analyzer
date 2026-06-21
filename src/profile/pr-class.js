export const PR_CLASS_FALLBACK = Object.freeze({
  class: "unknown",
  classificationSource: "fallback_rule",
  ruleId: null,
});

const PR_CLASS_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const PR_CLASS_RULE_KEYS = new Set(["id", "class", "match", "notes"]);
const PR_CLASS_MATCH_KEYS = new Set(["titleIncludes", "titleRegex"]);

function ruleLabel(rule, index) {
  return typeof rule?.id === "string" && rule.id.length ? rule.id : `index ${index}`;
}

export function validatePrClassRules(profile = {}) {
  const errors = [];
  const seenRuleIds = new Set();

  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return [];
  }

  if (!Object.prototype.hasOwnProperty.call(profile, "prClasses")) {
    return [];
  }

  const rules = profile.prClasses;

  if (!Array.isArray(rules)) {
    return ["prClasses must be an array when provided"];
  }

  for (const [index, rule] of rules.entries()) {
    const label = ruleLabel(rule, index);
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push(`prClasses[${index}] must be an object`);
      continue;
    }

    for (const key of Object.keys(rule)) {
      if (!PR_CLASS_RULE_KEYS.has(key)) {
        errors.push(`prClasses rule "${label}" ${key} is not supported`);
      }
    }

    if (typeof rule.id !== "string" || rule.id.length === 0) {
      errors.push(`prClasses[${index}].id must be a non-empty string`);
    } else if (seenRuleIds.has(rule.id)) {
      errors.push(`prClasses rule id "${rule.id}" is duplicated`);
    } else {
      seenRuleIds.add(rule.id);
    }

    if (typeof rule.class !== "string" || !PR_CLASS_IDENTIFIER_PATTERN.test(rule.class)) {
      errors.push(`prClasses rule "${label}" class must be lower-kebab-case or lower_snake_case`);
    }
    if (rule.notes !== undefined && typeof rule.notes !== "string") {
      errors.push(`prClasses rule "${label}" notes must be a string when provided`);
    }

    const match = rule.match;
    if (!match || typeof match !== "object" || Array.isArray(match)) {
      errors.push(`prClasses rule "${label}" match must be an object`);
      continue;
    }

    for (const key of Object.keys(match)) {
      if (!PR_CLASS_MATCH_KEYS.has(key)) {
        errors.push(`prClasses rule "${label}" match.${key} is not supported`);
      }
    }

    for (const field of PR_CLASS_MATCH_KEYS) {
      if (
        Object.prototype.hasOwnProperty.call(match, field)
        && (typeof match[field] !== "string" || match[field].length === 0)
      ) {
        errors.push(`prClasses rule "${label}" match.${field} must be a non-empty string`);
      }
    }

    const hasTitleIncludes = typeof match.titleIncludes === "string" && match.titleIncludes.length > 0;
    const hasTitleRegex = typeof match.titleRegex === "string" && match.titleRegex.length > 0;
    if (!hasTitleIncludes && !hasTitleRegex) {
      errors.push(`prClasses rule "${label}" match must include titleIncludes or titleRegex`);
    }

    if (hasTitleRegex) {
      try {
        new RegExp(match.titleRegex);
      } catch (error) {
        errors.push(`prClasses rule "${label}" titleRegex is invalid: ${error.message}`);
      }
    }
  }

  return errors;
}

export function assertValidPrClassRules(profile = {}) {
  const errors = validatePrClassRules(profile);
  if (errors.length > 0) {
    throw new Error(`invalid PR class profile rules: ${errors.join("; ")}`);
  }
}

function ruleMatches(title, match = {}) {
  if (match.titleIncludes && !title.includes(match.titleIncludes)) return false;
  if (match.titleRegex) {
    try {
      if (!new RegExp(match.titleRegex).test(title)) return false;
    } catch {
      return false;
    }
  }
  return Boolean(match.titleIncludes || match.titleRegex);
}

export function classifyPullRequest(pr, profile = {}) {
  const title = String(pr?.title ?? "");
  const rules = Array.isArray(profile?.prClasses) ? profile.prClasses : [];
  for (const rule of rules) {
    if (ruleMatches(title, rule.match)) {
      return {
        class: rule.class,
        classificationSource: "repository_profile",
        ruleId: rule.id,
      };
    }
  }

  return { ...PR_CLASS_FALLBACK };
}

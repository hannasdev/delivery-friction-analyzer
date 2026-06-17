export const WORKFLOW_PRIMARY_MERGE_METHODS = Object.freeze([
  "merge_commit",
  "squash_merge",
  "rebase_merge",
  "mixed",
  "unknown",
]);

export const WORKFLOW_RELEASE_STRATEGIES = Object.freeze([
  "release_prs",
  "direct_tags",
  "release_branches",
  "mixed",
  "unknown",
]);

export const WORKFLOW_BRANCH_STRATEGIES = Object.freeze([
  "trunk_based",
  "main_plus_release_branches",
  "long_lived_development_branches",
  "mixed",
  "unknown",
]);

const WORKFLOW_FIELDS = Object.freeze({
  primaryMergeMethod: WORKFLOW_PRIMARY_MERGE_METHODS,
  releaseStrategy: WORKFLOW_RELEASE_STRATEGIES,
  branchStrategy: WORKFLOW_BRANCH_STRATEGIES,
});

function allowedValues(values) {
  return values.join(", ");
}

export function validateWorkflowContext(profile = {}) {
  const errors = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return errors;
  }

  if (!Object.prototype.hasOwnProperty.call(profile, "workflow")) {
    return errors;
  }

  const workflow = profile.workflow;
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return ["workflow must be an object when provided"];
  }
  if (Object.keys(workflow).length === 0) {
    return ["workflow must include at least one field when provided"];
  }

  for (const key of Object.keys(workflow)) {
    if (!Object.prototype.hasOwnProperty.call(WORKFLOW_FIELDS, key)) {
      errors.push(`workflow.${key} is not supported`);
    }
  }

  for (const [field, values] of Object.entries(WORKFLOW_FIELDS)) {
    const value = workflow[field];
    if (value === undefined) continue;
    if (!values.includes(value)) {
      errors.push(`workflow.${field} must be one of: ${allowedValues(values)}`);
    }
  }

  return errors;
}

export function assertValidWorkflowContext(profile = {}) {
  const errors = validateWorkflowContext(profile);
  if (errors.length > 0) {
    throw new Error(`invalid workflow profile context: ${errors.join("; ")}`);
  }
}

const OWNER_OR_NAME = /^[A-Za-z0-9_.-]+$/;
const REF_NAME = /^[A-Za-z0-9._/-]+$/;

function validateRepoPart(value, label) {
  if (typeof value !== "string" || !OWNER_OR_NAME.test(value)) {
    return `${label} must be a GitHub owner/name segment using letters, numbers, dots, underscores, or dashes.`;
  }
  return null;
}

export function validateTargetRepository(input, { productRepository } = {}) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return ["target repository input must be an object."];
  }

  for (const [key, label] of [["owner", "owner"], ["name", "name"]]) {
    const error = validateRepoPart(input[key], label);
    if (error) errors.push(error);
  }

  if (typeof input.defaultBranch !== "string" || !REF_NAME.test(input.defaultBranch)) {
    errors.push("defaultBranch must be a non-empty Git ref name.");
  }

  if (!Number.isInteger(input.analysisWindowDays) || input.analysisWindowDays < 1 || input.analysisWindowDays > 365) {
    errors.push("analysisWindowDays must be an integer between 1 and 365.");
  }

  if (!["public", "private", "unknown"].includes(input.visibility)) {
    errors.push("visibility must be public, private, or unknown.");
  }

  if (productRepository && input.owner === productRepository.owner && input.name === productRepository.name) {
    errors.push("target repository must be distinct from the product repository.");
  }

  return errors;
}

export function normalizeTargetRepository(input, options = {}) {
  const errors = validateTargetRepository(input, options);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    targetRepository: {
      owner: input.owner,
      name: input.name,
      fullName: `${input.owner}/${input.name}`,
      defaultBranch: input.defaultBranch,
      visibility: input.visibility,
      analysisWindowDays: input.analysisWindowDays,
      isValidationTarget: Boolean(input.isValidationTarget),
    },
  };
}

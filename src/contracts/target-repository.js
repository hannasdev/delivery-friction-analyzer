const OWNER_OR_NAME = /^[A-Za-z0-9_.-]+$/;
const REF_NAME = /^[A-Za-z0-9._/-]+$/;

export const DEFAULT_PRODUCT_REPOSITORY = Object.freeze({
  owner: "hannasdev",
  name: "delivery-friction-analyzer",
});

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

  if (!Number.isInteger(input.analysisPullRequestLimit) || input.analysisPullRequestLimit < 1 || input.analysisPullRequestLimit > 100) {
    errors.push("analysisPullRequestLimit must be an integer between 1 and 100.");
  }

  if (!["public", "private", "unknown"].includes(input.visibility)) {
    errors.push("visibility must be public, private, or unknown.");
  }

  if (input.isValidationTarget !== undefined && typeof input.isValidationTarget !== "boolean") {
    errors.push("isValidationTarget must be a boolean when provided.");
  }

  const normalizedInputOwner = typeof input.owner === "string" ? input.owner.toLowerCase() : null;
  const normalizedInputName = typeof input.name === "string" ? input.name.toLowerCase() : null;
  const normalizedProductOwner = typeof productRepository?.owner === "string" ? productRepository.owner.toLowerCase() : null;
  const normalizedProductName = typeof productRepository?.name === "string" ? productRepository.name.toLowerCase() : null;

  if (
    normalizedInputOwner
    && normalizedInputName
    && normalizedProductOwner
    && normalizedProductName
    && normalizedInputOwner === normalizedProductOwner
    && normalizedInputName === normalizedProductName
  ) {
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
      analysisPullRequestLimit: input.analysisPullRequestLimit,
      isValidationTarget: input.isValidationTarget ?? false,
    },
  };
}

export function isProductRepositoryTarget(input, productRepository = DEFAULT_PRODUCT_REPOSITORY) {
  const normalizedInputOwner = typeof input?.owner === "string" ? input.owner.toLowerCase() : null;
  const normalizedInputName = typeof input?.name === "string" ? input.name.toLowerCase() : null;
  const normalizedProductOwner = typeof productRepository?.owner === "string" ? productRepository.owner.toLowerCase() : null;
  const normalizedProductName = typeof productRepository?.name === "string" ? productRepository.name.toLowerCase() : null;

  return Boolean(
    normalizedInputOwner
    && normalizedInputName
    && normalizedProductOwner
    && normalizedProductName
    && normalizedInputOwner === normalizedProductOwner
    && normalizedInputName === normalizedProductName
  );
}

export function productRepositoryTargetError(input) {
  const repository = typeof input?.owner === "string" && typeof input?.name === "string"
    ? `${input.owner}/${input.name}`
    : "the requested repository";
  return `Cannot analyze ${repository} because it is this tool's product repository. The guard prevents accidental self-analysis during normal live runs; it is not a data-security boundary. Choose a different repository with --repo owner/name. No GitHub data was collected.`;
}

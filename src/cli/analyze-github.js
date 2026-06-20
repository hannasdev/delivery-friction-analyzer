#!/usr/bin/env node
import { constants, realpathSync } from "node:fs";
import { access, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectGitHubSourceBundle } from "../collect/github-source-bundle.js";
import { createGhCliProvider } from "../collect/gh-provider.js";
import { computeRepositoryMetrics } from "../metrics/friction.js";
import { normalizeFixtureBundle } from "../normalize/github-fixture.js";
import {
  generateEvidenceCsvArtifacts,
  renderRepositoryFrictionMethodology,
} from "../report/evidence-artifacts.js";
import {
  generateRepositoryFrictionReport,
  renderRepositoryFrictionMarkdown,
} from "../report/friction-report.js";
import { assertValidPrClassRules } from "../profile/pr-class.js";
import { conventionalCommitPrClassRules } from "../profile/pr-class-presets.js";
import {
  WORKFLOW_BRANCH_STRATEGIES,
  WORKFLOW_PRIMARY_MERGE_METHODS,
  WORKFLOW_RELEASE_STRATEGIES,
  assertValidWorkflowContext,
} from "../profile/workflow.js";
import { assertValidContributorSource } from "../profile/contributor-source.js";

const ALLOWED_OPTIONS = new Set([
  "repo",
  "limit",
  "profile",
  "out",
  "dry-run",
  "metadata-only",
  "validation-target",
  "no-csv",
  "exclude-pr-class",
  "json",
  "interactive",
]);

const REPOSITORY_SLUG = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

export const ANALYZE_GITHUB_ARTIFACTS = Object.freeze({
  sourceBundle: "source-bundle.json",
  normalized: "normalized.json",
  metricsSummary: "metrics-summary.json",
  reportJson: "friction-report.json",
  reportMarkdown: "friction-report.md",
  methodology: "methodology.md",
  prMetricsCsv: "pr-metrics.csv",
  bottleneckExamplesCsv: "bottleneck-examples.csv",
  commentSourcesCsv: "comment-sources.csv",
  collectionCoverageCsv: "collection-coverage.csv",
});

const CSV_ARTIFACT_KEYS = new Set([
  "prMetricsCsv",
  "bottleneckExamplesCsv",
  "commentSourcesCsv",
  "collectionCoverageCsv",
]);

export const USAGE = `Usage:
  delivery-friction-analyzer --repo <owner/name> --limit <1-100> --profile <path> --out <directory>
  delivery-friction-analyzer --repo <owner/name> --limit <1-100> --profile <path> --out <directory> --dry-run

Options:
  --repo <owner/name>       Target GitHub repository to analyze.
  --limit <1-100>           Latest merged pull request count.
  --profile <path>          Repository profile JSON used for file role classification.
  --out <directory>         Output directory for generated artifacts.
  --dry-run                 Validate inputs and sample GitHub coverage without writing artifacts.
  --metadata-only           Alias for --dry-run.
  --validation-target       Mark the target repository as a validation target in output metadata.
  --exclude-pr-class <cls>  Exclude a PR class from normalized, metrics, report, methodology, and CSV artifacts. Repeat or comma-separate values.
  --no-csv                  Suppress curated CSV evidence exports.
  --json                    Print the machine-readable completion receipt to stdout.
  --interactive             Prompt for missing run options in a terminal.
`;

export function parseAnalyzeGithubArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (!ALLOWED_OPTIONS.has(key)) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (
      key === "dry-run"
      || key === "metadata-only"
      || key === "validation-target"
      || key === "no-csv"
      || key === "json"
      || key === "interactive"
    ) {
      options[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (key === "exclude-pr-class") {
      options[key] = [...(options[key] ?? []), value];
    } else {
      options[key] = value;
    }
    index += 1;
  }

  return {
    repository: options.repo,
    limit: options.limit === undefined ? undefined : Number(options.limit),
    profilePath: options.profile,
    outDir: options.out,
    dryRun: Boolean(options["dry-run"] || options["metadata-only"]),
    isValidationTarget: Boolean(options["validation-target"]),
    excludedPrClasses: normalizeExcludedPrClasses(options["exclude-pr-class"] ?? []),
    csv: !options["no-csv"],
    json: Boolean(options.json),
    interactive: Boolean(options.interactive),
  };
}

function normalizeExcludedPrClasses(values) {
  return [...new Set(values
    .flatMap(value => String(value).split(","))
    .map(value => value.trim())
    .filter(Boolean))];
}

function requireOptions(options) {
  const missing = [];
  if (!options.repository) missing.push("--repo");
  if (options.limit === undefined) missing.push("--limit");
  if (!options.profilePath) missing.push("--profile");
  if (!options.outDir) missing.push("--out");
  if (missing.length > 0) {
    throw new Error(`Missing required option(s): ${missing.join(", ")}`);
  }
}

function validateRepositorySlug(repository) {
  if (typeof repository !== "string" || !REPOSITORY_SLUG.test(repository)) {
    throw new Error("repo must use owner/name with GitHub-safe owner and name segments.");
  }
}

function validateLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer between 1 and 100.");
  }
}

function validateExcludedPrClasses(excludedPrClasses = []) {
  for (const prClass of excludedPrClasses) {
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(prClass)) {
      throw new Error(`exclude-pr-class must be a lowercase PR class identifier using letters, digits, "-" or "_" separators: ${prClass}`);
    }
  }
}

function configuredPrClasses(repositoryProfile) {
  const rules = Array.isArray(repositoryProfile?.prClasses) ? repositoryProfile.prClasses : [];
  return new Set(rules.map(rule => rule.class));
}

function validateExcludedPrClassesAreConfigured(excludedPrClasses = [], repositoryProfile) {
  if (!excludedPrClasses.length) return;

  const configured = configuredPrClasses(repositoryProfile);
  const unconfigured = excludedPrClasses.filter(prClass => !configured.has(prClass));
  if (!unconfigured.length) return;

  const available = configured.size
    ? ` Configured PR class(es): ${[...configured].sort().join(", ")}.`
    : " The repository profile does not configure any PR classes.";
  throw new Error(`exclude-pr-class must name configured PR class(es): ${unconfigured.join(", ")}.${available}`);
}

function configuredPrClassList(repositoryProfile) {
  return [...configuredPrClasses(repositoryProfile)].sort();
}

function defaultOutDirForRepository(repository) {
  const [, name] = String(repository ?? "").split("/");
  return join("reports", name || "analysis");
}

function choiceValue(choice) {
  return typeof choice === "object" && choice !== null ? choice.value : choice;
}

function choiceLabel(choice) {
  return typeof choice === "object" && choice !== null ? choice.label : choice;
}

function formatChoiceList(choices) {
  return choices
    .map((choice, index) => `${index + 1}. ${choiceLabel(choice)} (${choiceValue(choice)})`)
    .join("\n");
}

function formatInteractivePrompt(prompt) {
  const suffix = prompt.defaultValue === undefined
    ? ""
    : Array.isArray(prompt.defaultValue)
      ? (prompt.defaultValue.length ? ` [${prompt.defaultValue.join(",")}]` : "")
      : ` [${prompt.defaultValue}]`;
  if (prompt.type === "confirm") {
    return `${prompt.message}${prompt.defaultValue ? " [Y/n]" : " [y/N]"} `;
  }
  if (prompt.type === "multi-select" && prompt.choices?.length) {
    return `${prompt.message} (${prompt.choices.map(choiceValue).join(",")})${suffix}: `;
  }
  if (prompt.type === "select" && prompt.choices?.length) {
    return `${prompt.message}\n${formatChoiceList(prompt.choices)}\nChoose a number or identifier${suffix}: `;
  }
  return `${prompt.message}${suffix}: `;
}

function createTerminalPromptAdapter({ input, output }) {
  const readline = createInterface({ input, output, terminal: true });
  return {
    async ask(prompt) {
      return readline.question(formatInteractivePrompt(prompt));
    },
    writeError(message) {
      output.write(`${message}\n`);
    },
    close() {
      readline.close();
    },
  };
}

async function callPromptAdapter(promptAdapter, prompt) {
  if (typeof promptAdapter === "function") {
    return promptAdapter(prompt);
  }
  return promptAdapter.ask(prompt);
}

async function askUntilValid(promptAdapter, prompt, { normalize, validate, output }) {
  for (;;) {
    const raw = await callPromptAdapter(promptAdapter, prompt);
    try {
      const value = normalize(raw, prompt);
      await validate(value);
      return value;
    } catch (error) {
      const message = error?.message ?? String(error);
      if (typeof promptAdapter.writeError === "function") {
        promptAdapter.writeError(message);
      } else if (output?.write) {
        output.write(`${message}\n`);
      }
    }
  }
}

function normalizeTextAnswer(raw, prompt) {
  const value = String(raw ?? "").trim();
  if (value) return value;
  if (prompt.defaultValue !== undefined) return prompt.defaultValue;
  return value;
}

function normalizeIntegerAnswer(raw, prompt) {
  const value = normalizeTextAnswer(raw, prompt);
  return Number(value);
}

function normalizeConfirmAnswer(raw, prompt) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value && prompt.defaultValue !== undefined) return Boolean(prompt.defaultValue);
  if (["y", "yes", "true", "1"].includes(value)) return true;
  if (["n", "no", "false", "0"].includes(value)) return false;
  throw new Error("Answer yes or no.");
}

function normalizeChoiceAnswer(raw, prompt) {
  const value = normalizeTextAnswer(raw, prompt);
  const choices = prompt.choices ?? [];
  const numericIndex = Number(value);
  if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= choices.length) {
    return choiceValue(choices[numericIndex - 1]);
  }
  const match = choices.find(choice => choiceValue(choice) === value || choiceLabel(choice) === value);
  if (match) return choiceValue(match);
  throw new Error(`${prompt.id} must be one of: ${choices.map(choiceValue).join(", ")}`);
}

function normalizeMultiSelectAnswer(raw, prompt) {
  const value = String(raw ?? "").trim();
  if (!value) return prompt.defaultValue ?? [];
  return normalizeExcludedPrClasses([value]);
}

function validateProfile(profile) {
  assertValidPrClassRules(profile);
  assertValidWorkflowContext(profile);
  assertValidContributorSource(profile);
}

function parseProfileJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`profile must be valid JSON: ${error.message}`);
    }
    throw error;
  }
}

function hasTrailingPathSeparator(profilePath) {
  return /[/\\]$/.test(profilePath);
}

async function inspectProfilePath(profilePath) {
  if (hasTrailingPathSeparator(profilePath)) {
    throw new Error("profile path must be a JSON file path, not a directory or special file.");
  }
  let profileLinkStat;
  try {
    profileLinkStat = await lstat(profilePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, profile: null, text: null, isSymbolicLink: false };
    }
    throw error;
  }
  const isSymbolicLink = profileLinkStat.isSymbolicLink();
  const profileStat = isSymbolicLink ? await stat(profilePath) : profileLinkStat;
  if (!profileStat.isFile()) {
    throw new Error("profile path must be a JSON file path, not a directory or special file.");
  }
  const text = await readFile(profilePath, "utf8");
  const profile = parseProfileJson(text);
  validateProfile(profile);
  return { exists: true, profile, text, isSymbolicLink };
}

async function readProfile(profilePath) {
  let inspected;
  try {
    inspected = await inspectProfilePath(profilePath);
  } catch (error) {
    if (error.message?.startsWith("profile must be valid JSON")) {
      throw error;
    }
    if (error.message?.startsWith("invalid ")) {
      throw new Error(`profile is invalid: ${error.message}`);
    }
    throw new Error(`profile could not be read: ${error.message}`);
  }
  if (!inspected.exists) {
    throw new Error("profile could not be read: no such file or directory");
  }
  return inspected.profile;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function repositoryProfileFromSlug(repository) {
  const match = REPOSITORY_SLUG.exec(repository);
  if (!match) {
    throw new Error("repo must use owner/name with GitHub-safe owner and name segments.");
  }
  return {
    schemaVersion: "repository-profile.v1",
    repository: {
      owner: match[1],
      name: match[2],
    },
    rules: [],
  };
}

function formatProfile(profile) {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

function generatedProfilePath(profilePath, index = 1) {
  const suffix = index === 1 ? ".generated.json" : `.generated-${index}.json`;
  return /\.json$/i.test(profilePath)
    ? profilePath.replace(/\.json$/i, suffix)
    : `${profilePath}${suffix}`;
}

async function writeProfileFile(profilePath, profile) {
  await mkdir(dirname(profilePath), { recursive: true });
  await writeFile(profilePath, formatProfile(profile), { encoding: "utf8", flag: "wx" });
}

function shouldWriteGeneratedProfileAfterCreateFailure(error) {
  return ["EEXIST", "EISDIR", "ELOOP"].includes(error.code);
}

function shouldRetryProfileReplaceAfterRenameFailure(error) {
  return ["EEXIST", "EPERM"].includes(error.code);
}

async function replaceProfileFile(profilePath, profile, originalText) {
  const tempPath = `${profilePath}.${process.pid}.${Date.now()}.tmp`;
  let shouldCleanupTemp = true;
  try {
    await writeFile(tempPath, formatProfile(profile), { encoding: "utf8", flag: "wx" });
    try {
      await rename(tempPath, profilePath);
      shouldCleanupTemp = false;
      return true;
    } catch (error) {
      if (!shouldRetryProfileReplaceAfterRenameFailure(error)) {
        throw error;
      }
      if (!await profileStillMatchesOriginal(profilePath, originalText)) {
        return false;
      }
      await rm(profilePath, { force: true });
      await rename(tempPath, profilePath);
      shouldCleanupTemp = false;
      return true;
    }
  } finally {
    if (shouldCleanupTemp) {
      await rm(tempPath, { force: true });
    }
  }
}

async function profileStillMatchesOriginal(profilePath, originalText) {
  try {
    const profileLinkStat = await lstat(profilePath);
    if (profileLinkStat.isSymbolicLink() || !profileLinkStat.isFile()) return false;
    return await readFile(profilePath, "utf8") === originalText;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeGeneratedProfileFile(profilePath, profile) {
  for (let index = 1; ; index += 1) {
    const writePath = generatedProfilePath(profilePath, index);
    try {
      await mkdir(dirname(writePath), { recursive: true });
      await writeFile(writePath, formatProfile(profile), { encoding: "utf8", flag: "wx" });
      return writePath;
    } catch (error) {
      if (error.code === "EEXIST") continue;
      throw error;
    }
  }
}

async function writeInteractiveProfile(profilePath, profile, {
  exists,
  originalProfile,
  originalText,
  originalIsSymbolicLink,
}) {
  const canRewriteExisting = exists
    && !originalIsSymbolicLink
    && originalText === formatProfile(originalProfile);
  if (exists && !canRewriteExisting) {
    return writeGeneratedProfileFile(profilePath, profile);
  }
  if (!exists) {
    try {
      await writeProfileFile(profilePath, profile);
      return profilePath;
    } catch (error) {
      if (shouldWriteGeneratedProfileAfterCreateFailure(error)) {
        return writeGeneratedProfileFile(profilePath, profile);
      }
      throw error;
    }
  }
  if (!await profileStillMatchesOriginal(profilePath, originalText)) {
    return writeGeneratedProfileFile(profilePath, profile);
  }
  if (!await replaceProfileFile(profilePath, profile, originalText)) {
    return writeGeneratedProfileFile(profilePath, profile);
  }
  return profilePath;
}

function releaseClassRuleIndexes(profile) {
  if (!Array.isArray(profile.prClasses)) return [];
  return profile.prClasses
    .map((rule, index) => rule.class === "release" ? index : -1)
    .filter(index => index >= 0);
}

function updateableReleaseClassRuleIndex(profile) {
  const releaseIndexes = releaseClassRuleIndexes(profile);
  if (releaseIndexes.length !== 1) return -1;
  const rule = profile.prClasses[releaseIndexes[0]];
  const match = rule.match ?? {};
  const hasTitleIncludes = typeof match.titleIncludes === "string" && match.titleIncludes.length > 0;
  const hasTitleRegex = typeof match.titleRegex === "string" && match.titleRegex.length > 0;
  return hasTitleIncludes && !hasTitleRegex ? releaseIndexes[0] : -1;
}

function defaultReleaseTitleIncludes(profile) {
  const index = updateableReleaseClassRuleIndex(profile);
  const existingIncludes = index >= 0 ? profile.prClasses[index]?.match?.titleIncludes : null;
  return typeof existingIncludes === "string" && existingIncludes.length ? existingIncludes : "Release";
}

function nextPrClassRuleId(profile, baseId) {
  const existingIds = new Set((profile.prClasses ?? []).map(rule => rule.id));
  if (!existingIds.has(baseId)) return baseId;
  for (let index = 2; ; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

function releasePrClassRule(profile, titleIncludes, existingRule = null) {
  return {
    id: existingRule?.id ?? nextPrClassRuleId(profile, "release-title"),
    class: "release",
    match: { ...(existingRule?.match ?? {}), titleIncludes },
    notes: existingRule?.notes ?? "Generated by interactive setup from the configured release PR title convention.",
  };
}

function withAvailablePrClassRuleIds(profile, rules) {
  const profileWithIds = {
    ...profile,
    prClasses: Array.isArray(profile.prClasses) ? [...profile.prClasses] : [],
  };
  return rules.map(rule => {
    const id = nextPrClassRuleId(profileWithIds, rule.id);
    const nextRule = {
      ...rule,
      id,
      match: { ...rule.match },
    };
    profileWithIds.prClasses.push(nextRule);
    return nextRule;
  });
}

async function promptConventionalCommitPrClassPreset(promptAdapter, output, profile) {
  const hasExistingPrClasses = Array.isArray(profile.prClasses) && profile.prClasses.length > 0;
  const message = hasExistingPrClasses
    ? "Add Conventional Commit PR class preset to existing PR class rules"
    : "Add Conventional Commit PR class preset";
  const shouldAddPreset = await askUntilValid(promptAdapter, {
    id: "addConventionalCommitPrClasses",
    type: "confirm",
    message,
    defaultValue: false,
  }, {
    output,
    normalize: normalizeConfirmAnswer,
    validate() {},
  });
  if (!shouldAddPreset) return { profile, prClassRulesWritten: false };

  const updated = cloneJson(profile);
  updated.prClasses = Array.isArray(updated.prClasses) ? [...updated.prClasses] : [];
  const presetRules = withAvailablePrClassRuleIds(updated, conventionalCommitPrClassRules());
  updated.prClasses.push(...presetRules);
  return { profile: updated, prClassRulesWritten: true };
}

const WORKFLOW_CHOICE_LABELS = Object.freeze({
  merge_commit: "Merge commits",
  squash_merge: "Squash merges",
  rebase_merge: "Rebase merges",
  release_prs: "Release PRs",
  direct_tags: "Direct tags",
  release_branches: "Release branches",
  trunk_based: "Trunk-based",
  main_plus_release_branches: "Main plus release branches",
  long_lived_development_branches: "Long-lived development branches",
  mixed: "Mixed",
  unknown: "Unknown",
});

function workflowChoices(values) {
  return values.map(value => ({
    value,
    label: WORKFLOW_CHOICE_LABELS[value] ?? value,
  }));
}

async function promptWorkflowField(promptAdapter, output, { id, message, choices, defaultValue }) {
  return askUntilValid(promptAdapter, {
    id,
    type: "select",
    message,
    choices: workflowChoices(choices),
    defaultValue,
  }, {
    output,
    normalize: normalizeChoiceAnswer,
    validate() {},
  });
}

async function promptWorkflowProfileUpdate(promptAdapter, output, profile, { isNewProfile }) {
  const updated = cloneJson(profile);
  let prClassRulesWritten = false;
  updated.workflow = {
    primaryMergeMethod: await promptWorkflowField(promptAdapter, output, {
      id: "primaryMergeMethod",
      message: "Primary merge method",
      choices: WORKFLOW_PRIMARY_MERGE_METHODS,
      defaultValue: updated.workflow?.primaryMergeMethod ?? "unknown",
    }),
    releaseStrategy: await promptWorkflowField(promptAdapter, output, {
      id: "releaseStrategy",
      message: "Release strategy",
      choices: WORKFLOW_RELEASE_STRATEGIES,
      defaultValue: updated.workflow?.releaseStrategy ?? "unknown",
    }),
    branchStrategy: await promptWorkflowField(promptAdapter, output, {
      id: "branchStrategy",
      message: "Branch strategy",
      choices: WORKFLOW_BRANCH_STRATEGIES,
      defaultValue: updated.workflow?.branchStrategy ?? "unknown",
    }),
  };

  if (updated.workflow.releaseStrategy === "release_prs") {
    const suggestedReleaseTitle = defaultReleaseTitleIncludes(updated);
    const titleIncludes = await askUntilValid(promptAdapter, {
      id: "releasePrTitleIncludes",
      type: "text",
      message: `Release PR title includes (blank to skip PR class rule; suggested: ${suggestedReleaseTitle})`,
    }, {
      output,
      normalize: normalizeTextAnswer,
      validate() {},
    });

    if (titleIncludes) {
      updated.prClasses = Array.isArray(updated.prClasses) ? [...updated.prClasses] : [];
      const updateableReleaseIndex = updateableReleaseClassRuleIndex(updated);
      if (updateableReleaseIndex >= 0) {
        const shouldUpdateReleaseRule = await askUntilValid(promptAdapter, {
          id: "updateReleasePrClass",
          type: "confirm",
          message: "Update existing title-based release PR class rule",
          defaultValue: false,
        }, {
          output,
          normalize: normalizeConfirmAnswer,
          validate() {},
        });
        if (shouldUpdateReleaseRule) {
          updated.prClasses[updateableReleaseIndex] = releasePrClassRule(
            updated,
            titleIncludes,
            updated.prClasses[updateableReleaseIndex],
          );
          prClassRulesWritten = true;
        }
      } else {
        const shouldAddReleaseRule = isNewProfile
          ? true
          : await askUntilValid(promptAdapter, {
            id: "addReleasePrClass",
            type: "confirm",
            message: "Add release PR class rule from title convention",
            defaultValue: true,
          }, {
            output,
            normalize: normalizeConfirmAnswer,
            validate() {},
          });
        if (shouldAddReleaseRule) {
          updated.prClasses.push(releasePrClassRule(updated, titleIncludes));
          prClassRulesWritten = true;
        }
      }
    }
  }

  const presetUpdate = await promptConventionalCommitPrClassPreset(promptAdapter, output, updated);
  validateProfile(presetUpdate.profile);
  return {
    profile: presetUpdate.profile,
    prClassRulesWritten: prClassRulesWritten || presetUpdate.prClassRulesWritten,
  };
}

async function maybeConfigureInteractiveProfile(promptAdapter, output, profileState, repository) {
  const isNewProfile = !profileState.exists;
  const originalProfile = profileState.profile;
  let profile = isNewProfile ? repositoryProfileFromSlug(repository) : cloneJson(originalProfile);

  if (isNewProfile) {
    const shouldCreateProfile = await askUntilValid(promptAdapter, {
      id: "createProfile",
      type: "confirm",
      message: "Create repository profile at this path",
      defaultValue: true,
    }, {
      output,
      normalize: normalizeConfirmAnswer,
      validate() {},
    });
    if (!shouldCreateProfile) {
      throw new Error("Repository profile is required.");
    }
  } else {
    const shouldConfigureWorkflow = await askUntilValid(promptAdapter, {
      id: "configureWorkflow",
      type: "confirm",
      message: "Configure repository workflow profile fields",
      defaultValue: false,
    }, {
      output,
      normalize: normalizeConfirmAnswer,
      validate() {},
    });
    if (!shouldConfigureWorkflow) {
      const presetUpdate = await promptConventionalCommitPrClassPreset(promptAdapter, output, profile);
      validateProfile(presetUpdate.profile);
      if (presetUpdate.prClassRulesWritten) {
        const savedProfilePath = await writeInteractiveProfile(profileState.profilePath, presetUpdate.profile, {
          exists: profileState.exists,
          originalProfile,
          originalText: profileState.text,
          originalIsSymbolicLink: profileState.isSymbolicLink,
        });
        return {
          profile: presetUpdate.profile,
          profilePath: savedProfilePath,
          savedProfilePath,
          prClassRulesWritten: true,
        };
      }
      return {
        profile,
        profilePath: profileState.profilePath,
        savedProfilePath: null,
        prClassRulesWritten: false,
      };
    }
  }

  const profileUpdate = await promptWorkflowProfileUpdate(promptAdapter, output, profile, { isNewProfile });
  profile = profileUpdate.profile;
  const savedProfilePath = await writeInteractiveProfile(profileState.profilePath, profile, {
    exists: profileState.exists,
    originalProfile,
    originalText: profileState.text,
    originalIsSymbolicLink: profileState.isSymbolicLink,
  });
  return {
    profile,
    profilePath: savedProfilePath,
    savedProfilePath,
    prClassRulesWritten: profileUpdate.prClassRulesWritten,
  };
}

async function promptProfilePath(promptAdapter, output, prompt) {
  let profileState = null;
  const profilePath = await askUntilValid(promptAdapter, prompt, {
    output,
    normalize: normalizeTextAnswer,
    async validate(value) {
      if (!value) throw new Error("Repository profile path is required.");
      try {
        profileState = await inspectProfilePath(value);
      } catch (error) {
        if (error.message?.startsWith("profile must be valid JSON")) {
          throw error;
        }
        if (error.message?.startsWith("invalid ")) {
          throw new Error(`profile is invalid: ${error.message}`);
        }
        throw new Error(`profile could not be read: ${error.message}`);
      }
    },
  });
  return { profilePath, ...profileState };
}

function hasOwnOption(options, key) {
  return Object.prototype.hasOwnProperty.call(options, key);
}

function shouldPromptInteractiveOption(options, key) {
  const promptDefaults = options.interactivePromptDefaults ?? {};
  if (hasOwnOption(promptDefaults, key)) {
    return Boolean(promptDefaults[key]);
  }
  return !hasOwnOption(options, key);
}

export async function collectInteractiveAnalyzeGithubOptions(options, {
  promptAdapter = null,
  input = process.stdin,
  output = process.stderr,
  isInteractiveTerminal = Boolean(input?.isTTY),
  onSavedProfilePath = null,
} = {}) {
  if (!isInteractiveTerminal) {
    throw new Error("interactive mode requires a terminal. Re-run with --repo <owner/name> --limit <1-100> --profile <path> --out <directory>, or provide a TTY for prompts.");
  }

  const adapter = promptAdapter ?? createTerminalPromptAdapter({ input, output });
  const ownsAdapter = !promptAdapter;
  const resolved = { ...options };
  delete resolved.interactivePromptDefaults;
  let repositoryProfile = null;
  let profileState = null;

  try {
    if (!resolved.repository) {
      resolved.repository = await askUntilValid(adapter, {
        id: "repository",
        type: "text",
        message: "Target GitHub repository",
      }, {
        output,
        normalize: normalizeTextAnswer,
        validate: validateRepositorySlug,
      });
    }

    if (resolved.limit === undefined) {
      resolved.limit = await askUntilValid(adapter, {
        id: "limit",
        type: "integer",
        message: "Latest merged pull request count",
        defaultValue: 30,
      }, {
        output,
        normalize: normalizeIntegerAnswer,
        validate: validateLimit,
      });
    }

    if (!resolved.profilePath) {
      const prompted = await promptProfilePath(adapter, output, {
        id: "profilePath",
        type: "path",
        message: "Repository profile path",
      });
      profileState = prompted;
    } else {
      try {
        profileState = {
          profilePath: resolved.profilePath,
          ...await inspectProfilePath(resolved.profilePath),
        };
      } catch (error) {
        if (error.message?.startsWith("profile must be valid JSON")) {
          throw error;
        }
        if (error.message?.startsWith("invalid ")) {
          throw new Error(`profile is invalid: ${error.message}`);
        }
        throw new Error(`profile could not be read: ${error.message}`);
      }
    }
    resolved.profilePath = profileState.profilePath;

    const profileUpdate = await maybeConfigureInteractiveProfile(adapter, output, profileState, resolved.repository);
    resolved.profilePath = profileUpdate.profilePath;
    if (profileUpdate.savedProfilePath) {
      resolved.savedProfilePath = profileUpdate.savedProfilePath;
      resolved.prClassRulesWritten = profileUpdate.prClassRulesWritten;
      if (typeof onSavedProfilePath === "function") {
        onSavedProfilePath(profileUpdate.savedProfilePath);
      }
    }
    repositoryProfile = profileUpdate.profile;

    if (!resolved.outDir) {
      resolved.outDir = await askUntilValid(adapter, {
        id: "outDir",
        type: "path",
        message: "Output directory",
        defaultValue: defaultOutDirForRepository(resolved.repository),
      }, {
        output,
        normalize: normalizeTextAnswer,
        async validate(value) {
          if (!value) throw new Error("Output directory is required.");
          await validateOutputDirectory(value);
        },
      });
    }

    if (shouldPromptInteractiveOption(options, "dryRun")) {
      resolved.dryRun = await askUntilValid(adapter, {
        id: "dryRun",
        type: "confirm",
        message: "Run metadata-only dry run",
        defaultValue: false,
      }, {
        output,
        normalize: normalizeConfirmAnswer,
        validate() {},
      });
    }
    if (resolved.dryRun === undefined) resolved.dryRun = false;

    if (!resolved.dryRun && shouldPromptInteractiveOption(options, "csv")) {
      resolved.csv = await askUntilValid(adapter, {
        id: "csv",
        type: "confirm",
        message: "Write CSV evidence files",
        defaultValue: true,
      }, {
        output,
        normalize: normalizeConfirmAnswer,
        validate() {},
      });
    }
    if (resolved.csv === undefined) resolved.csv = true;

    if (shouldPromptInteractiveOption(options, "json")) {
      resolved.json = await askUntilValid(adapter, {
        id: "json",
        type: "confirm",
        message: "Print completion as JSON",
        defaultValue: false,
      }, {
        output,
        normalize: normalizeConfirmAnswer,
        validate() {},
      });
    }
    if (resolved.json === undefined) resolved.json = false;

    if (!resolved.excludedPrClasses?.length) {
      const availablePrClasses = configuredPrClassList(repositoryProfile);
      if (availablePrClasses.length) {
        resolved.excludedPrClasses = await askUntilValid(adapter, {
          id: "excludedPrClasses",
          type: "multi-select",
          message: "Exclude PR classes (comma-separated, blank for none)",
          choices: availablePrClasses,
          defaultValue: [],
        }, {
          output,
          normalize: normalizeMultiSelectAnswer,
          validate(value) {
            validateExcludedPrClasses(value);
            validateExcludedPrClassesAreConfigured(value, repositoryProfile);
          },
        });
      }
    }

    return resolved;
  } finally {
    if (ownsAdapter && typeof adapter.close === "function") {
      adapter.close();
    }
  }
}

async function validateOutputDirectory(outDir) {
  const resolvedOutDir = resolve(outDir);
  try {
    const outStat = await stat(resolvedOutDir);
    if (!outStat.isDirectory()) {
      throw new Error("out must be a directory path, not a file.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await mkdir(resolvedOutDir, { recursive: true });
  }

  const probePath = join(resolvedOutDir, `.analyze-github-write-test-${process.pid}-${Date.now()}`);
  try {
    await writeFile(probePath, "ok\n", "utf8");
  } catch (error) {
    throw new Error(`out must be a writable directory path: ${resolvedOutDir}`);
  } finally {
    await rm(probePath, { force: true });
  }
  return resolvedOutDir;
}

function artifactPaths(outDir, { includeCsv = true } = {}) {
  return Object.fromEntries(
    Object.entries(ANALYZE_GITHUB_ARTIFACTS)
      .filter(([key]) => includeCsv || !CSV_ARTIFACT_KEYS.has(key))
      .map(([key, fileName]) => [key, join(outDir, fileName)]),
  );
}

function artifactTransactionDirectory(outDir, label) {
  return join(outDir, `.analyze-github-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function assertWritableArtifactTargets(paths) {
  for (const path of Object.values(paths)) {
    try {
      const pathStat = await stat(path);
      if (!pathStat.isFile()) {
        throw new Error(`artifact path must be a writable file path, not a directory or special file: ${path}`);
      }
      await access(path, constants.W_OK);
    } catch (error) {
      if (error.code !== "ENOENT") {
        if (error.code === "EACCES") {
          throw new Error(`artifact path must be writable: ${path}`);
        }
        throw error;
      }
    }
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

export async function writeAnalysisArtifacts(outDir, paths, artifacts, { disabledPaths = {} } = {}) {
  const finalPaths = { ...paths, ...disabledPaths };
  await assertWritableArtifactTargets(finalPaths);

  const stagingDir = artifactTransactionDirectory(outDir, "staging");
  const backupDir = artifactTransactionDirectory(outDir, "backup");
  const stagingPaths = Object.fromEntries(
    Object.keys(paths).map(key => [key, join(stagingDir, ANALYZE_GITHUB_ARTIFACTS[key])]),
  );
  const backupPaths = Object.fromEntries(
    Object.keys(finalPaths).map(key => [key, join(backupDir, ANALYZE_GITHUB_ARTIFACTS[key])]),
  );
  const backedUp = [];
  const promoted = [];

  await mkdir(stagingDir, { recursive: false });

  try {
    const stagingResults = await Promise.allSettled([
      writeJson(stagingPaths.sourceBundle, artifacts.sourceBundle),
      writeJson(stagingPaths.normalized, artifacts.normalized),
      writeJson(stagingPaths.metricsSummary, artifacts.metricsSummary),
      writeJson(stagingPaths.reportJson, artifacts.reportJson),
      writeText(stagingPaths.reportMarkdown, artifacts.reportMarkdown),
      writeText(stagingPaths.methodology, artifacts.methodology),
      ...Object.entries(artifacts.csv ?? {}).map(([key, value]) => writeText(stagingPaths[key], value)),
    ]);
    const rejectedStagingWrite = stagingResults.find(result => result.status === "rejected");
    if (rejectedStagingWrite) {
      throw rejectedStagingWrite.reason;
    }

    await assertWritableArtifactTargets(finalPaths);
    await mkdir(backupDir, { recursive: false });

    for (const [key, finalPath] of Object.entries(finalPaths)) {
      try {
        await rename(finalPath, backupPaths[key]);
        backedUp.push(key);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    for (const [key, stagingPath] of Object.entries(stagingPaths)) {
      await rename(stagingPath, paths[key]);
      promoted.push(key);
    }
  } catch (error) {
    await Promise.allSettled(promoted.map(key => rm(paths[key], { force: true })));
    await Promise.allSettled(backedUp.map(key => rename(backupPaths[key], finalPaths[key])));
    throw error;
  } finally {
    await Promise.allSettled([
      rm(stagingDir, { recursive: true, force: true }),
      rm(backupDir, { recursive: true, force: true }),
    ]);
  }
}

function collectionCoverageMarkdown(sourceBundle) {
  const lines = [
    "",
    "## Collection Coverage",
    "",
    `Overall collection coverage: ${sourceBundle.coverage.status}`,
    "",
    "API families:",
  ];

  for (const family of sourceBundle.coverage.apiFamilies ?? []) {
    const diagnostics = (family.diagnostics ?? []).length ? `; diagnostics: ${family.diagnostics.join(" | ")}` : "";
    const impact = family.downstreamImpact ? `; impact: ${family.downstreamImpact}` : "";
    lines.push(`- ${family.family}: ${family.status} (${family.attempts ?? 1} attempt(s))${diagnostics}${impact}`);
  }

  lines.push("");
  return lines.join("\n");
}

function attachCollectionCoverage(report, sourceBundle) {
  return {
    ...report,
    collectionCoverage: sourceBundle.coverage,
    artifactSensitivity: "Generated artifacts may include repository names, PR URLs, titles, file paths, comment metadata, contributor-source metadata, curated CSV evidence, and coverage diagnostics. Raw contributor file contents and individual contributor rankings are not emitted. Treat artifacts as local/private unless intentionally shared.",
  };
}

function summarizeResult({ dryRun, outDir, paths, sourceBundle, metrics, report, requestedLimit, sampledLimit, csv, analysisFilter, savedProfilePath, prClassRulesWritten }) {
  const summary = {
    ok: true,
    dryRun,
    csvArtifactsEnabled: Boolean(csv),
    analysisFilter: analysisFilter ?? null,
    requestedLimit,
    sampledLimit,
    outputDirectory: outDir,
    artifactPaths: dryRun ? null : paths,
    targetRepository: sourceBundle.targetRepository,
    selection: sourceBundle.selection,
    collectionCoverage: sourceBundle.coverage,
    totals: metrics?.totals ?? null,
    topBottleneckIds: report?.summary?.topBottleneckIds ?? null,
  };
  if (savedProfilePath) {
    summary.savedProfilePath = savedProfilePath;
  }
  if (prClassRulesWritten) {
    summary.prClassRulesWritten = true;
  }
  return summary;
}

function applyPrClassFilter(normalized, excludedPrClasses = []) {
  if (!excludedPrClasses.length) return normalized;
  const excluded = new Set(excludedPrClasses);
  const originalPullRequests = normalized.pullRequests ?? [];
  if (!originalPullRequests.length) {
    throw new Error("exclude-pr-class cannot filter because no merged pull requests were collected.");
  }
  const filteredPullRequests = originalPullRequests.filter(pr => !excluded.has(pr.prClass?.class ?? "unknown"));
  if (!filteredPullRequests.length) {
    throw new Error(`exclude-pr-class removed all ${originalPullRequests.length} collected pull request(s); choose a less restrictive filter.`);
  }
  return {
    ...normalized,
    analysisFilter: {
      excludedPrClasses,
      originalPullRequests: originalPullRequests.length,
      filteredPullRequests: filteredPullRequests.length,
    },
    pullRequests: filteredPullRequests,
  };
}

export async function runAnalyzeGithub(options, {
  provider = createGhCliProvider(),
  now = () => new Date().toISOString(),
  onProgress = null,
} = {}) {
  requireOptions(options);
  validateRepositorySlug(options.repository);
  validateLimit(options.limit);
  validateExcludedPrClasses(options.excludedPrClasses);
  const csvEnabled = options.csv !== false;

  onProgress?.("Validating profile and output directory.");
  const [repositoryProfile, outDir] = await Promise.all([
    readProfile(options.profilePath),
    validateOutputDirectory(options.outDir),
  ]);
  validateExcludedPrClassesAreConfigured(options.excludedPrClasses ?? [], repositoryProfile);
  const generatedPaths = artifactPaths(outDir, { includeCsv: csvEnabled });
  const disabledPaths = csvEnabled ? {} : Object.fromEntries(
    Object.entries(artifactPaths(outDir, { includeCsv: true })).filter(([key]) => CSV_ARTIFACT_KEYS.has(key)),
  );
  if (!options.dryRun) {
    await assertWritableArtifactTargets({ ...generatedPaths, ...disabledPaths });
  }

  const collectionLimit = options.dryRun ? Math.min(options.limit, 1) : options.limit;
  onProgress?.(options.dryRun
    ? "Sampling GitHub coverage without writing report artifacts."
    : `Collecting latest ${options.limit} merged pull request(s) from ${options.repository}.`);
  const sourceBundle = await collectGitHubSourceBundle({
    repository: options.repository,
    limit: collectionLimit,
    provider,
    collectedAt: now(),
    isValidationTarget: options.isValidationTarget,
    contributors: repositoryProfile.contributors,
  });

  if (options.dryRun) {
    return summarizeResult({
      dryRun: true,
      outDir,
      paths: generatedPaths,
      sourceBundle,
      requestedLimit: options.limit,
      sampledLimit: collectionLimit,
      csv: false,
      analysisFilter: null,
      savedProfilePath: options.savedProfilePath,
      prClassRulesWritten: options.prClassRulesWritten,
    });
  }

  onProgress?.("Normalizing source bundle and computing metrics.");
  const normalized = applyPrClassFilter(
    normalizeFixtureBundle(sourceBundle, { repositoryProfile }),
    options.excludedPrClasses ?? [],
  );
  const metrics = computeRepositoryMetrics(normalized);
  const report = attachCollectionCoverage(
    generateRepositoryFrictionReport(metrics, {
      workflowContext: repositoryProfile.workflow,
      contributorSource: normalized.contributorSource,
    }),
    sourceBundle,
  );
  const markdown = `${renderRepositoryFrictionMarkdown(report)}${collectionCoverageMarkdown(sourceBundle)}`;
  const methodology = renderRepositoryFrictionMethodology({
    report,
    sourceBundle,
    profilePath: options.profilePath,
    artifactFileNames: ANALYZE_GITHUB_ARTIFACTS,
    csvEnabled,
  });
  const csv = csvEnabled
    ? generateEvidenceCsvArtifacts({
      metricsSummary: metrics,
      report,
      collectionCoverage: sourceBundle.coverage,
    })
    : {};

  onProgress?.("Writing local artifacts.");
  await writeAnalysisArtifacts(outDir, generatedPaths, {
    sourceBundle,
    normalized,
    metricsSummary: metrics,
    reportJson: report,
    reportMarkdown: markdown,
    methodology,
    csv,
  }, { disabledPaths });

  return summarizeResult({
    dryRun: false,
    outDir,
    paths: generatedPaths,
    sourceBundle,
    metrics,
    report,
    requestedLimit: options.limit,
    sampledLimit: collectionLimit,
    csv: csvEnabled,
    analysisFilter: normalized.analysisFilter ?? null,
    savedProfilePath: options.savedProfilePath,
    prClassRulesWritten: options.prClassRulesWritten,
  });
}

function writeProgress(message, stderr = process.stderr) {
  stderr.write(`${message}\n`);
}

function coverageLine(family) {
  const diagnostics = (family.diagnostics ?? []).filter(Boolean);
  const details = [
    `status=${family.status}`,
    `attempts=${family.attempts ?? 1}`,
    family.source ? `source=${family.source}` : null,
    family.downstreamImpact ? `impact=${family.downstreamImpact}` : null,
    diagnostics.length ? `diagnostics=${diagnostics.join(" | ")}` : null,
  ].filter(Boolean);
  return `- ${family.family}: ${details.join("; ")}`;
}

function coverageCaveats(coverage) {
  return (coverage?.apiFamilies ?? []).filter(family => {
    const diagnostics = (family.diagnostics ?? []).filter(Boolean);
    return family.status !== "available" || diagnostics.length > 0;
  });
}

export function formatAnalyzeGithubCompletion(result) {
  const target = result.targetRepository?.owner && result.targetRepository?.name
    ? `${result.targetRepository.owner}/${result.targetRepository.name}`
    : "unknown repository";
  const lines = [];

  if (result.dryRun) {
    lines.push(
      `Dry run complete for ${target}.`,
      `Sampled pull requests: ${result.sampledLimit} of ${result.requestedLimit} requested.`,
      "Artifacts: not written.",
    );
  } else {
    const paths = result.artifactPaths ?? {};
    lines.push(
      `Markdown report: ${paths.reportMarkdown}`,
      `Analysis complete for ${target}.`,
      `Methodology: ${paths.methodology}`,
      `JSON report: ${paths.reportJson}`,
      `Metrics summary: ${paths.metricsSummary}`,
      `Source bundle: ${paths.sourceBundle}`,
    );

    if (result.csvArtifactsEnabled) {
      lines.push(
        "CSV evidence:",
        `- PR metrics: ${paths.prMetricsCsv}`,
        `- Bottleneck examples: ${paths.bottleneckExamplesCsv}`,
        `- Comment sources: ${paths.commentSourcesCsv}`,
        `- Collection coverage: ${paths.collectionCoverageCsv}`,
      );
    } else {
      lines.push("CSV evidence: disabled by --no-csv.");
    }
  }

  if (result.analysisFilter?.excludedPrClasses?.length) {
    lines.push(
      `Analysis filter: excluded PR class(es): ${result.analysisFilter.excludedPrClasses.join(", ")}.`,
      `Filtered sample: ${result.analysisFilter.filteredPullRequests} of ${result.analysisFilter.originalPullRequests} collected pull request(s).`,
    );
  }

  if (result.savedProfilePath) {
    lines.push(`Repository profile saved: ${result.savedProfilePath}.`);
  }
  if (result.prClassRulesWritten) {
    lines.push("PR class rules written: Conventional Commit preset or release title rule.");
  }

  lines.push(`Collection coverage: ${result.collectionCoverage?.status ?? "unknown"}.`);

  const caveats = coverageCaveats(result.collectionCoverage);
  if (caveats.length > 0) {
    lines.push("Coverage caveats:", ...caveats.map(coverageLine));
  }

  if (!result.dryRun && Array.isArray(result.topBottleneckIds) && result.topBottleneckIds.length > 0) {
    lines.push(`Top bottlenecks: ${result.topBottleneckIds.join(", ")}.`);
  }

  return `${lines.join("\n")}\n`;
}

export function writeAnalyzeGithubCompletion(result, { json = false, stdout = process.stdout } = {}) {
  if (json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  stdout.write(formatAnalyzeGithubCompletion(result));
}

export async function runAnalyzeGithubCli(argv, {
  provider,
  now,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  promptAdapter = null,
  isInteractiveTerminal = Boolean(stdin?.isTTY),
} = {}) {
  let savedProfilePath = null;
  try {
    const options = parseAnalyzeGithubArgs(argv);
    if (options.help) {
      stdout.write(USAGE);
      return null;
    }

    const resolvedOptions = options.interactive
      ? await collectInteractiveAnalyzeGithubOptions({
        ...options,
        interactivePromptDefaults: {
          dryRun: !options.dryRun,
          csv: options.csv !== false,
          json: !options.json,
        },
      }, {
        promptAdapter,
        input: stdin,
        output: stderr,
        isInteractiveTerminal,
        onSavedProfilePath(path) {
          savedProfilePath = path;
        },
      })
      : options;
    if (resolvedOptions.savedProfilePath) {
      savedProfilePath = resolvedOptions.savedProfilePath;
    }
    const runOptions = {
      onProgress: message => writeProgress(message, stderr),
    };
    if (provider !== undefined) runOptions.provider = provider;
    if (now !== undefined) runOptions.now = now;

    const result = await runAnalyzeGithub(resolvedOptions, runOptions);
    writeAnalyzeGithubCompletion(result, { json: resolvedOptions.json, stdout });
    return result;
  } catch (error) {
    if (savedProfilePath) {
      stderr.write(`Repository profile saved before failure: ${savedProfilePath}.\n`);
    }
    throw error;
  }
}

async function main(argv) {
  await runAnalyzeGithubCli(argv);
}

function isCliEntrypoint(entryPath) {
  if (!entryPath) return false;

  try {
    return realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(entryPath).href;
  }
}

if (isCliEntrypoint(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  });
}

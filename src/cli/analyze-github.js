#!/usr/bin/env node
import { constants, realpathSync } from "node:fs";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
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

async function readProfile(profilePath) {
  let profile;
  try {
    profile = JSON.parse(await readFile(profilePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`profile must be valid JSON: ${error.message}`);
    }
    throw new Error(`profile could not be read: ${error.message}`);
  }
  try {
    assertValidPrClassRules(profile);
  } catch (error) {
    throw new Error(`profile is invalid: ${error.message}`);
  }
  return profile;
}

function configuredPrClassList(repositoryProfile) {
  return [...configuredPrClasses(repositoryProfile)].sort();
}

function defaultOutDirForRepository(repository) {
  const [, name] = String(repository ?? "").split("/");
  return join("reports", name || "analysis");
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
    return `${prompt.message} (${prompt.choices.join(",")})${suffix}: `;
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

function normalizeMultiSelectAnswer(raw, prompt) {
  const value = String(raw ?? "").trim();
  if (!value) return prompt.defaultValue ?? [];
  return normalizeExcludedPrClasses([value]);
}

async function promptProfilePath(promptAdapter, output, prompt) {
  let profile = null;
  const profilePath = await askUntilValid(promptAdapter, prompt, {
    output,
    normalize: normalizeTextAnswer,
    async validate(value) {
      profile = await readProfile(value);
    },
  });
  return { profilePath, profile };
}

export async function collectInteractiveAnalyzeGithubOptions(options, {
  promptAdapter = null,
  input = process.stdin,
  output = process.stderr,
  isInteractiveTerminal = Boolean(input?.isTTY),
} = {}) {
  if (!isInteractiveTerminal) {
    throw new Error("interactive mode requires a terminal. Re-run with --repo <owner/name> --limit <1-100> --profile <path> --out <directory>, or provide a TTY for prompts.");
  }

  const adapter = promptAdapter ?? createTerminalPromptAdapter({ input, output });
  const ownsAdapter = !promptAdapter;
  const resolved = { ...options };
  let repositoryProfile = null;

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
      resolved.profilePath = prompted.profilePath;
      repositoryProfile = prompted.profile;
    } else {
      repositoryProfile = await readProfile(resolved.profilePath);
    }

    if (!resolved.outDir) {
      resolved.outDir = await askUntilValid(adapter, {
        id: "outDir",
        type: "path",
        message: "Output directory",
        defaultValue: defaultOutDirForRepository(resolved.repository),
      }, {
        output,
        normalize: normalizeTextAnswer,
        validate(value) {
          if (!value) throw new Error("Output directory is required.");
        },
      });
    }

    if (!resolved.dryRun) {
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

    if (resolved.csv !== false) {
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

    if (!resolved.json) {
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
    artifactSensitivity: "Generated artifacts may include repository names, PR URLs, titles, file paths, comment metadata, curated CSV evidence, and coverage diagnostics. Treat them as local/private unless intentionally shared.",
  };
}

function summarizeResult({ dryRun, outDir, paths, sourceBundle, metrics, report, requestedLimit, sampledLimit, csv, analysisFilter }) {
  return {
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
    });
  }

  onProgress?.("Normalizing source bundle and computing metrics.");
  const normalized = applyPrClassFilter(
    normalizeFixtureBundle(sourceBundle, { repositoryProfile }),
    options.excludedPrClasses ?? [],
  );
  const metrics = computeRepositoryMetrics(normalized);
  const report = attachCollectionCoverage(generateRepositoryFrictionReport(metrics), sourceBundle);
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
  const options = parseAnalyzeGithubArgs(argv);
  if (options.help) {
    stdout.write(USAGE);
    return null;
  }

  const resolvedOptions = options.interactive
    ? await collectInteractiveAnalyzeGithubOptions(options, {
      promptAdapter,
      input: stdin,
      output: stderr,
      isInteractiveTerminal,
    })
    : options;
  const runOptions = {
    onProgress: message => writeProgress(message, stderr),
  };
  if (provider !== undefined) runOptions.provider = provider;
  if (now !== undefined) runOptions.now = now;

  const result = await runAnalyzeGithub(resolvedOptions, runOptions);
  writeAnalyzeGithubCompletion(result, { json: resolvedOptions.json, stdout });
  return result;
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

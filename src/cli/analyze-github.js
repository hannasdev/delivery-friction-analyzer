import { constants } from "node:fs";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

const ALLOWED_OPTIONS = new Set([
  "repo",
  "limit",
  "profile",
  "out",
  "dry-run",
  "metadata-only",
  "validation-target",
  "no-csv",
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
  node src/cli/analyze-github.js --repo <owner/name> --limit <1-100> --profile <path> --out <directory>
  node src/cli/analyze-github.js --repo <owner/name> --limit <1-100> --profile <path> --out <directory> --dry-run

Options:
  --repo <owner/name>       Target GitHub repository to analyze.
  --limit <1-100>           Latest merged pull request count.
  --profile <path>          Repository profile JSON used for file role classification.
  --out <directory>         Output directory for generated artifacts.
  --dry-run                 Validate inputs and sample GitHub coverage without writing artifacts.
  --metadata-only           Alias for --dry-run.
  --validation-target       Mark the target repository as a validation target in output metadata.
  --no-csv                  Suppress curated CSV evidence exports.
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

    if (key === "dry-run" || key === "metadata-only" || key === "validation-target" || key === "no-csv") {
      options[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[key] = value;
    index += 1;
  }

  return {
    repository: options.repo,
    limit: options.limit === undefined ? undefined : Number(options.limit),
    profilePath: options.profile,
    outDir: options.out,
    dryRun: Boolean(options["dry-run"] || options["metadata-only"]),
    isValidationTarget: Boolean(options["validation-target"]),
    csv: !options["no-csv"],
  };
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

async function readProfile(profilePath) {
  try {
    return JSON.parse(await readFile(profilePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`profile must be valid JSON: ${error.message}`);
    }
    throw new Error(`profile could not be read: ${error.message}`);
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

function summarizeResult({ dryRun, outDir, paths, sourceBundle, metrics, report, requestedLimit, sampledLimit, csv }) {
  return {
    ok: true,
    dryRun,
    csvArtifactsEnabled: Boolean(csv),
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

export async function runAnalyzeGithub(options, {
  provider = createGhCliProvider(),
  now = () => new Date().toISOString(),
  onProgress = null,
} = {}) {
  requireOptions(options);
  validateRepositorySlug(options.repository);
  validateLimit(options.limit);
  const csvEnabled = options.csv !== false;

  onProgress?.("Validating profile and output directory.");
  const [repositoryProfile, outDir] = await Promise.all([
    readProfile(options.profilePath),
    validateOutputDirectory(options.outDir),
  ]);
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
    });
  }

  onProgress?.("Normalizing source bundle and computing metrics.");
  const normalized = normalizeFixtureBundle(sourceBundle, { repositoryProfile });
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
  });
}

function writeProgress(message) {
  process.stderr.write(`${message}\n`);
}

async function main(argv) {
  const options = parseAnalyzeGithubArgs(argv);
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }

  const result = await runAnalyzeGithub(options, { onProgress: writeProgress });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  });
}

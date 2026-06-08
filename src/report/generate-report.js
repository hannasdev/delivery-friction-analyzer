import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { generateRepositoryFrictionReport, renderRepositoryFrictionMarkdown } from "./friction-report.js";

const USAGE = `Usage:
  node src/report/generate-report.js --metrics-summary <path> --json-out <path> --markdown-out <path>
`;

function parseArgs(argv) {
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
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[key] = value;
    index += 1;
  }

  return {
    metricsSummaryPath: options["metrics-summary"],
    jsonOutPath: options["json-out"],
    markdownOutPath: options["markdown-out"],
  };
}

function requireOptions(options) {
  const missing = [];
  if (!options.metricsSummaryPath) missing.push("--metrics-summary");
  if (!options.jsonOutPath) missing.push("--json-out");
  if (!options.markdownOutPath) missing.push("--markdown-out");
  if (missing.length) {
    throw new Error(`Missing required option(s): ${missing.join(", ")}`);
  }
}

async function writeTextFile(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

export async function writeRepositoryFrictionReport(options) {
  requireOptions(options);
  const metricsSummary = JSON.parse(await readFile(options.metricsSummaryPath, "utf8"));
  const report = generateRepositoryFrictionReport(metricsSummary);
  const markdown = renderRepositoryFrictionMarkdown(report);

  await Promise.all([
    writeTextFile(options.jsonOutPath, `${JSON.stringify(report, null, 2)}\n`),
    writeTextFile(options.markdownOutPath, markdown),
  ]);

  return report;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }

  await writeRepositoryFrictionReport(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export function parseSemver(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareSemver(left, right) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);

  for (const key of ["major", "minor", "patch"]) {
    if (leftVersion[key] > rightVersion[key]) return 1;
    if (leftVersion[key] < rightVersion[key]) return -1;
  }

  return 0;
}

export function assertNotBehind(packageVersion, tagVersion) {
  if (compareSemver(packageVersion, tagVersion) < 0) {
    throw new Error(`Package version ${packageVersion} is behind latest tag ${tagVersion}.`);
  }
}

export function determineIncrement(commitLog) {
  if (/^(?:[a-z]+(?:\([^)]+\))?!:|BREAKING[ -]CHANGE:)/gm.test(commitLog)) {
    return "major";
  }
  if (/^feat(?:\([^)]+\))?:/gm.test(commitLog)) {
    return "minor";
  }
  return "patch";
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(argv) {
  const command = argv[0];

  if (command === "increment") {
    process.stdout.write(`${determineIncrement(await readStdin())}\n`);
    return;
  }

  if (command === "assert-not-behind") {
    const [, packageVersion, tagVersion] = argv;
    if (!packageVersion || !tagVersion) {
      throw new Error("Usage: release-versioning.mjs assert-not-behind <package-version> <tag-version>");
    }
    assertNotBehind(packageVersion, tagVersion);
    return;
  }

  throw new Error("Usage: release-versioning.mjs <increment|assert-not-behind>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

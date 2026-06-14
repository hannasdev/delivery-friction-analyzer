#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export function parseSemver(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const prerelease = match[4] ? match[4].split(".") : [];
  for (const identifier of prerelease) {
    if (/^\d+$/.test(identifier) && !/^(0|[1-9]\d*)$/.test(identifier)) {
      throw new Error(`Invalid semantic version: ${version}`);
    }
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    build: match[5] ?? null,
  };
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index];
    const rightIdentifier = right[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumeric = /^(0|[1-9]\d*)$/.test(leftIdentifier);
    const rightNumeric = /^(0|[1-9]\d*)$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1;
    }
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftIdentifier > rightIdentifier ? 1 : -1;
  }

  return 0;
}

export function compareSemver(left, right) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);

  for (const key of ["major", "minor", "patch"]) {
    if (leftVersion[key] > rightVersion[key]) return 1;
    if (leftVersion[key] < rightVersion[key]) return -1;
  }

  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
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

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  assertNotBehind,
  assertPackageNotBehindLatestTag,
  compareSemver,
  determineIncrement,
  latestVersionTagFromList,
  packageVersionFromJson,
  parseSemver,
} from "../scripts/release-versioning.mjs";

describe("release versioning", () => {
  it("parses semantic versions with or without a leading v", () => {
    assert.deepEqual(parseSemver("1.2.3"), {
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
      build: null,
    });
    assert.deepEqual(parseSemver("v4.5.6-beta.1+build.7"), {
      major: 4,
      minor: 5,
      patch: 6,
      prerelease: ["beta", "1"],
      build: "build.7",
    });
  });

  it("rejects invalid semantic versions", () => {
    assert.throws(() => parseSemver("1.2"), /Invalid semantic version/);
    assert.throws(() => parseSemver("latest"), /Invalid semantic version/);
    assert.throws(() => parseSemver("01.2.3"), /Invalid semantic version/);
    assert.throws(() => parseSemver("1.02.3"), /Invalid semantic version/);
    assert.throws(() => parseSemver("1.2.03"), /Invalid semantic version/);
    assert.throws(() => parseSemver("1.2.3-alpha..1"), /Invalid semantic version/);
    assert.throws(() => parseSemver("1.2.3-alpha.01"), /Invalid semantic version/);
  });

  it("compares semantic versions by major, minor, and patch", () => {
    assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
    assert.equal(compareSemver("1.3.0", "1.2.9"), 1);
    assert.equal(compareSemver("1.2.4", "1.2.3"), 1);
    assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
    assert.equal(compareSemver("1.2.3", "1.2.4"), -1);
  });

  it("compares prerelease versions using semantic version precedence", () => {
    assert.equal(compareSemver("1.2.3", "1.2.3-beta.1"), 1);
    assert.equal(compareSemver("1.2.3-beta.1", "1.2.3"), -1);
    assert.equal(compareSemver("1.2.3-beta.2", "1.2.3-beta.1"), 1);
    assert.equal(compareSemver("1.2.3-beta.11", "1.2.3-beta.2"), 1);
    assert.equal(compareSemver("1.2.3-rc.1", "1.2.3-beta.11"), 1);
    assert.equal(compareSemver("1.2.3-beta", "1.2.3-beta.1"), -1);
    assert.equal(compareSemver("1.2.3+build.2", "1.2.3+build.1"), 0);
  });

  it("selects patch for non-feature conventional commits", () => {
    assert.equal(determineIncrement("fix: harden publish workflow\n"), "patch");
    assert.equal(determineIncrement("docs: update README\nchore: refresh lockfile\n"), "patch");
  });

  it("selects minor when the commit log contains a feature", () => {
    assert.equal(determineIncrement("fix: typo\nfeat: add npm release automation\n"), "minor");
    assert.equal(determineIncrement("feat(release): add npm publish flow\n"), "minor");
  });

  it("selects major for breaking conventional commits or footers", () => {
    assert.equal(determineIncrement("feat!: remove old CLI contract\n"), "major");
    assert.equal(determineIncrement("feat: change CLI\n\nBREAKING CHANGE: removes legacy behavior\n"), "major");
    assert.equal(determineIncrement("fix: change API\n\nBREAKING-CHANGE: removes field\n"), "major");
  });

  it("rejects package versions that are behind the latest release tag", () => {
    assert.doesNotThrow(() => assertNotBehind("1.2.3", "1.2.3"));
    assert.doesNotThrow(() => assertNotBehind("1.2.4", "1.2.3"));
    assert.throws(
      () => assertNotBehind("1.2.2", "1.2.3"),
      /Package version 1\.2\.2 is behind latest tag 1\.2\.3/,
    );
    assert.throws(
      () => assertNotBehind("1.2.3-beta.1", "1.2.3"),
      /Package version 1\.2\.3-beta\.1 is behind latest tag 1\.2\.3/,
    );
  });

  it("selects the newest version tag from sorted git tag output", () => {
    assert.equal(latestVersionTagFromList("v1.2.3\nv1.2.2\n"), "v1.2.3");
    assert.equal(latestVersionTagFromList("\n"), null);
  });

  it("reads package versions from package metadata", () => {
    assert.equal(packageVersionFromJson('{"version":"1.2.3"}'), "1.2.3");
    assert.throws(() => packageVersionFromJson("{}"), /non-empty string version/);
  });

  it("validates package metadata against the latest release tag", () => {
    assert.doesNotThrow(() => {
      assertPackageNotBehindLatestTag('{"version":"1.2.4"}', "v1.2.3\nv1.2.2\n");
    });
    assert.throws(
      () => assertPackageNotBehindLatestTag('{"version":"1.2.2"}', "v1.2.3\n"),
      /Package version 1\.2\.2 is behind latest tag v1\.2\.3/,
    );
    assert.throws(
      () => assertPackageNotBehindLatestTag('{"version":"1.2.3"}', ""),
      /No v\* release tags found/,
    );
  });

  it("runs the CLI entrypoint when invoked through a relative path", () => {
    const result = spawnSync(process.execPath, [
      "scripts/release-versioning.mjs",
      "increment",
    ], {
      encoding: "utf8",
      input: "fix: typo\nfeat: add release automation\n",
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "minor\n");
  });
});

import { describe, expect, it } from "vitest";
import { entryFor, parseChangelog, releasedEntries } from "./changelog";
import { compareVersions, isNewer, parseVersion } from "./version";

const changelog = `# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- Something in progress.

## [0.2.0] - 2026-10-15

### Added
- Update checking.

### Fixed
- Tab close button.

## [0.1.0] - 2026-09-30

- First release.

[Unreleased]: https://github.com/example/repo/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/example/repo/releases/tag/v0.2.0
`;

describe("changelog", () => {
  it("parses every version section with its date", () => {
    const entries = parseChangelog(changelog);
    expect(entries.map((entry) => [entry.version, entry.date])).toEqual([
      ["Unreleased", null],
      ["0.2.0", "2026-10-15"],
      ["0.1.0", "2026-09-30"],
    ]);
  });

  it("returns the body of one version, without link definitions", () => {
    expect(entryFor(changelog, "v0.2.0")?.body).toBe("### Added\n- Update checking.\n\n### Fixed\n- Tab close button.");
    expect(entryFor(changelog, "0.1.0")?.body).toBe("- First release.");
    expect(entryFor(changelog, "9.9.9")).toBeNull();
  });

  it("lists released versions only", () => {
    expect(releasedEntries(changelog).map((entry) => entry.version)).toEqual(["0.2.0", "0.1.0"]);
  });
});

describe("versions", () => {
  it("parses tags with or without v", () => {
    expect(parseVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
    expect(parseVersion("1.2.3-beta.2")?.pre).toEqual(["beta", "2"]);
    expect(parseVersion("latest")).toBeNull();
  });

  it("orders by semver precedence", () => {
    expect(isNewer("0.2.0", "0.1.9")).toBe(true);
    expect(isNewer("v1.0.0", "0.9.9")).toBe(true);
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "1.0.0-beta.1")).toBe(true);
    expect(isNewer("1.0.0-beta.2", "1.0.0-beta.10")).toBe(false);
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
    expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBeLessThan(0);
    expect(compareVersions("junk", "1.0.0")).toBe(0);
  });
});

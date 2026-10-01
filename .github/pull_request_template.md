## What and why

## Test plan

- 

## Docs

- User page and developer chapter updated in docs/wiki (or: no user visible change)
- New feature added to docs/wiki/features.json with its pages and screenshots
- Screenshots retaken with `bun scripts/screenshots.ts <name>` if the UI changed
- Bug fix recorded under "Bugs we fixed" in the feature's developer chapter (issue, why, why this fix)
- CHANGELOG.md has a line under Unreleased for anything user visible
- `bun scripts/build-wiki.ts --check` passes

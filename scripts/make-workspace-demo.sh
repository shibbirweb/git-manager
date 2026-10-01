#!/usr/bin/env bash
# Builds a throwaway workspace folder (not itself a git repository) holding
# several repositories, for trying multi-repository support:
#
#   <target>/
#     apps/web/              repository with everyday changes (M, A, U, D)
#     apps/web/packages/ui/  repository nested inside apps/web
#     apps/api/              repository stopped in a merge with conflicts
#     libs/shared/           clean repository
#     docs/                  plain folder, no git (try "Initialize Repository Here")
#
# Usage: scripts/make-workspace-demo.sh <target-dir>

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <target-dir>" >&2
  exit 2
fi

target="$1"
if [ -e "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
  echo "Refusing to use non-empty directory: $target" >&2
  exit 1
fi
mkdir -p "$target"
target="$(cd "$target" && pwd -P)"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"

# Identity and signing are set per repository so global config never interferes.
new_repo() {
  local dir="$1"
  mkdir -p "$dir"
  git -C "$dir" init -q -b main
  git -C "$dir" config user.name "Demo User"
  git -C "$dir" config user.email "demo@example.com"
  git -C "$dir" config commit.gpgsign false
  git -C "$dir" config core.hooksPath /dev/null
}

commit_all() {
  git -C "$1" add -A
  git -C "$1" commit -q -m "$2"
}

# apps/web: a repository with one change of each kind.
web="$target/apps/web"
new_repo "$web"
mkdir -p "$web/src"
printf 'export function render(): string {\n  return "<main>Hello</main>";\n}\n' >"$web/src/render.ts"
printf 'export const ROUTES = ["/", "/about"];\n' >"$web/src/routes.ts"
printf '# Web app\n' >"$web/README.md"
printf 'node_modules/\ndist/\n' >"$web/.gitignore"
commit_all "$web" "Web: initial commit"
printf 'export function render(): string {\n  return "<main>Hello, workspace</main>";\n}\n' >"$web/src/render.ts"
rm "$web/src/routes.ts"
printf 'export function track(event: string): void {\n  console.log(event);\n}\n' >"$web/src/analytics.ts"
git -C "$web" add src/analytics.ts
printf 'export const THEME = "dark";\n' >"$web/src/theme.ts"
mkdir -p "$web/dist"
printf 'built output, ignored\n' >"$web/dist/bundle.js"

# apps/web/packages/ui: a repository nested inside another repository.
ui="$web/packages/ui"
new_repo "$ui"
printf 'export function Button(label: string): string {\n  return `<button>${label}</button>`;\n}\n' >"$ui/button.ts"
commit_all "$ui" "UI: button"
printf 'export function Button(label: string, kind = "primary"): string {\n  return `<button class="${kind}">${label}</button>`;\n}\n' >"$ui/button.ts"

# apps/api: reuse the conflict demo so one repository is mid-merge.
"$script_dir/make-conflict-repo.sh" "$target/apps/api" >/dev/null

# libs/shared: a clean repository with a second branch.
shared="$target/libs/shared"
new_repo "$shared"
printf 'export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));\n' >"$shared/math.ts"
commit_all "$shared" "Shared: math helpers"
git -C "$shared" branch feature/strings

# docs: a plain folder without git.
mkdir -p "$target/docs"
printf '# Workspace notes\n\nThis folder is not a git repository.\n' >"$target/docs/notes.md"

cat <<EOF

Created workspace $target (the folder itself is not a git repository):

  apps/web               $(git -C "$web" status --short | wc -l | tr -d ' ') changes (modified, added, untracked, deleted)
  apps/web/packages/ui   nested repository, 1 modified file
  apps/api               stopped in a merge with conflicts
  libs/shared            clean, with a second branch
  docs                   no git: right-click it in the Files panel and choose
                         "Initialize Repository Here"

Open the folder in Git Manager and switch repositories from the header, the
Changes view groups, or the Files panel.
EOF

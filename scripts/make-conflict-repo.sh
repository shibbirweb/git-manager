#!/usr/bin/env bash
# Builds a throwaway repository stopped in a merge (or, with --rebase, a
# rebase) with one example of every conflict type Git Manager handles.
#
# Usage: scripts/make-conflict-repo.sh <target-dir> [--rebase]

# The generated TypeScript contains literal ${...} template expressions.
# shellcheck disable=SC2016

set -euo pipefail

usage() {
  echo "Usage: $0 <target-dir> [--rebase]" >&2
  exit 2
}

mode="merge"
target=""
for arg in "$@"; do
  case "$arg" in
    --rebase)
      mode="rebase"
      ;;
    -h | --help)
      usage
      ;;
    -*)
      echo "Unknown option: $arg" >&2
      usage
      ;;
    *)
      if [ -n "$target" ]; then
        usage
      fi
      target="$arg"
      ;;
  esac
done

if [ -z "$target" ]; then
  usage
fi
if [ -e "$target" ] && [ ! -d "$target" ]; then
  echo "Refusing: $target exists and is not a directory." >&2
  exit 1
fi
if [ -d "$target" ] && [ -n "$(ls -A "$target")" ]; then
  echo "Refusing: $target is not empty." >&2
  exit 1
fi

mkdir -p "$target"
target="$(cd "$target" && pwd -P)"

# Accept prepared commit messages without opening an editor.
export GIT_EDITOR=true
export GIT_MERGE_AUTOEDIT=no

g() {
  git -C "$target" "$@"
}

# write_file <path> <printf format>: the format carries \r\n and octal escapes.
write_file() {
  mkdir -p "$(dirname "$target/$1")"
  # shellcheck disable=SC2059
  printf "$2" >"$target/$1"
}

commit_all() {
  g add -A
  g commit -q -m "$1"
}

if ! git init -q -b main "$target" 2>/dev/null; then
  git init -q "$target"
  g symbolic-ref HEAD refs/heads/main
fi

g config user.name "Conflict Demo"
g config user.email "conflict-demo@example.com"
g config commit.gpgsign false
g config tag.gpgsign false
g config core.autocrlf false
g config core.hooksPath "$target/.git/hooks"
g config merge.conflictstyle merge
g config rerere.enabled false
g config pull.rebase false

png_base='\211\120\116\107\015\012\032\012\000\000\000\015\111\110\104\122\000\000\000\001\000\000\000\001\010\002\000\000\000\220\167\123\336\000\000\000\014\111\104\101\124\170\332\143\150\150\150\000\000\003\004\001\201\165\056\001\274\000\000\000\000\111\105\116\104\256\102\140\202'
png_main='\211\120\116\107\015\012\032\012\000\000\000\015\111\110\104\122\000\000\000\001\000\000\000\001\010\002\000\000\000\220\167\123\336\000\000\000\014\111\104\101\124\170\332\143\270\243\241\001\000\003\020\001\055\020\163\366\166\000\000\000\000\111\105\116\104\256\102\140\202'
png_feature='\211\120\116\107\015\012\032\012\000\000\000\015\111\110\104\122\000\000\000\001\000\000\000\001\010\002\000\000\000\220\167\123\336\000\000\000\014\111\104\101\124\170\332\143\320\010\270\003\000\001\370\001\125\354\107\346\233\000\000\000\000\111\105\116\104\256\102\140\202'

# app.ts is written from one template; each side swaps in its own lines.
write_app() {
  local extra_import="$1" version="$2" retries="$3" greeting="$4" increment="$5"
  local total_body="$6" describe_body="$7" timeout="$8" main_extra="$9"
  {
    printf 'import { readConfig } from "./config";\n'
    printf 'import { formatName } from "./format";\n'
    if [ -n "$extra_import" ]; then
      printf '%s\n' "$extra_import"
    fi
    printf '\n'
    printf 'const VERSION = "%s";\n' "$version"
    printf '\n'
    printf 'const MAX_RETRIES = %s;\n' "$retries"
    printf '\n'
    printf 'export function greet(name: string): string {\n'
    printf '  return `%s, ${name}!`;\n' "$greeting"
    printf '}\n'
    printf '\n'
    printf 'export function retry<T>(task: () => T): T {\n'
    printf '  let attempts = 0;\n'
    printf '  while (true) {\n'
    printf '    try {\n'
    printf '      return task();\n'
    printf '    } catch (error) {\n'
    printf '      %s\n' "$increment"
    printf '      if (attempts >= MAX_RETRIES) {\n'
    printf '        throw error;\n'
    printf '      }\n'
    printf '    }\n'
    printf '  }\n'
    printf '}\n'
    printf '\n'
    printf 'export function total(values: number[]): number {\n'
    printf '  %s\n' "$total_body"
    printf '}\n'
    printf '\n'
    printf 'export function describe(user: { name: string; age: number }): string {\n'
    printf '  %s\n' "$describe_body"
    printf '}\n'
    printf '\n'
    printf 'export const DEFAULT_TIMEOUT_MS = %s;\n' "$timeout"
    printf '\n'
    printf 'export function main(): void {\n'
    printf '  const config = readConfig();\n'
    if [ -n "$main_extra" ]; then
      printf '  %s\n' "$main_extra"
    fi
    printf '  console.log(greet(formatName(config.user)));\n'
    printf '}\n'
  } >"$target/src/app.ts"
}

# A long module (about 2400 lines) with changes spread through it:
# clean edits on each side plus conflicts near the middle and the end.
write_report() {
  awk -v variant="$1" 'BEGIN {
    print "// Generated metrics module, used to try long files in the merge view."
    print ""
    for (i = 1; i <= 300; i++) {
      value = i * 10
      label = sprintf("Metric %d", i)
      if (variant == "main" && i == 20) { value += 1 }
      if (variant == "main" && i == 60) { label = label " (main)" }
      if (variant == "feature" && i == 220) { label = label " (feature)" }
      if (variant == "feature" && i == 280) { value += 2 }
      if (variant == "main" && i == 150) { value = 1500 + 7 }
      if (variant == "feature" && i == 150) { value = 1500 * 2 }
      if (variant == "main" && i == 299) { label = "Final metric (main)" }
      if (variant == "feature" && i == 299) { label = "Final metric (feature)" }
      printf "export function metric%03d(): Metric {\n", i
      printf "  return {\n    id: %d,\n    label: \"%s\",\n    value: %d,\n  };\n}\n\n", i, label, value
    }
  }' >"$target/src/report.ts"
}

# A long JSON data file (about 2000 lines).
write_cities() {
  awk -v variant="$1" 'BEGIN {
    print "["
    for (i = 1; i <= 400; i++) {
      population = i * 1000
      if (variant == "edited" && (i == 3 || i == 200 || i == 398)) { population += 555 }
      printf "  {\n    \"id\": %d,\n    \"name\": \"City %d\",\n    \"population\": %d\n  }%s\n", i, i, population, (i < 400 ? "," : "")
    }
    print "]"
  }' >"$target/data/cities.json"
}

# A long Python module (about 2450 lines) with 5 conflicts and 6 clean edits.
write_routes() {
  awk -v variant="$1" 'BEGIN {
    print "# Generated API routes, used to try a long file with many conflicts."
    for (i = 1; i <= 350; i++) {
      version = 1
      status = 404
      if (variant == "main" && (i == 30 || i == 120 || i == 200 || i == 260 || i == 330)) { version = 2 }
      if (variant == "feature" && (i == 30 || i == 120 || i == 200 || i == 260 || i == 330)) { version = 3 }
      if (variant == "main" && (i == 10 || i == 90 || i == 170)) { status = 410 }
      if (variant == "feature" && (i == 50 || i == 140 || i == 300)) { status = 400 }
      printf "@app.route(\"/api/items/%d\")\n", i
      printf "def get_item_%03d():\n", i
      printf "    item = load_item(%d)\n", i
      printf "    if item is None:\n"
      printf "        abort(%d)\n", status
      printf "    return jsonify(item, version=%d)\n\n", version
    }
  }' >"$target/server/routes.py"
}

# A long component (about 1600 lines). Each branch edits different places,
# so git merges it cleanly.
write_table() {
  awk -v variant="$1" 'BEGIN {
    print "import { type Column } from \"./types\";"
    print ""
    for (i = 1; i <= 200; i++) {
      width = 120
      align = "left"
      if (variant != "base" && variant != "feature" && (i == 25 || i == 110)) { width = 160 }
      if (variant != "base" && variant != "main" && (i == 60 || i == 175)) { align = "right" }
      if (variant == "edited" && i == 150) { align = "center" }
      printf "export const column%03d: Column = {\n", i
      printf "  key: \"field%d\",\n", i
      printf "  title: \"Field %d\",\n", i
      printf "  width: %d,\n", width
      printf "  align: \"%s\",\n", align
      printf "  sortable: true,\n"
      printf "};\n\n"
    }
    if (variant == "edited") {
      print "export const columnTotal: Column = { key: \"total\", title: \"Total\", width: 140, align: \"right\", sortable: false };"
    }
  }' >"$target/src/components/DataTable.tsx"
}

total_base='return values.reduce((sum, value) => sum + value, 0);'
describe_base='return `${user.name} (${user.age})`;'

# Base commit.
mkdir -p "$target/src"
write_app "" "1.0.0" "3" "Hello" "attempts += 1;" "$total_base" "$describe_base" "5000" ""
write_file "src/layout.ts" 'export function layout(width: number, height: number) {\n  const area = width * height;\n  const ratio = width / height;\n  return { area, ratio };\n}\n'
write_file "src/old-utils.ts" 'export function legacyPad(text: string): string {\n  return " " + text;\n}\n'
write_file "docs/legacy.md" '# Legacy notes\n\nThese notes describe the old deployment process.\n'
write_file "windows/setup.bat" '@echo off\r\nset APP_ENV=dev\r\nset PORT=8080\r\ncall start.cmd\r\n'
write_file "assets/logo.png" "$png_base"
write_file "README.md" '# Conflict demo\n\nA throwaway repository for testing merges.\n'
# Untouched by both branches; changed in the work tree afterwards as samples.
write_file "src/constants.ts" 'export const TIMEOUT_MS = 5000;\nexport const RETRIES = 3;\n'
write_file "CHANGELOG.md" '# Changelog\n\n## 1.0.0\n\n- First release.\n'
write_file "docs/guide.md" '# Guide\n\nRun the app with npm start.\n'
write_report base
mkdir -p "$target/data" "$target/server" "$target/src/components" "$target/src/legacy"
write_cities base
write_routes base
write_table base
awk 'BEGIN {
  for (i = 1; i <= 150; i++) {
    printf "export function legacyStep%03d(input) {\n  const value = input * %d;\n  if (value > 1000) {\n    return value - 1000;\n  }\n  return value;\n}\n\n", i, i
  }
}' >"$target/src/legacy/big-module.js"
commit_all "Base project"
g branch feature

# main: "ours" in the merge, the upstream in the rebase.
write_app 'import { log } from "./log";' "1.1.0" "5" "Hi" "attempts += 1;" \
  'return values.filter(Number.isFinite).reduce((sum, value) => sum + value, 0);' \
  "$describe_base" "10000" ""
write_file "src/layout.ts" 'export function layout(width: number, height: number) {\n    const area = width * height;\n    const ratio = width / height;\n    return { area, ratio };\n}\n'
write_file "src/old-utils.ts" 'export function legacyPad(text: string, width = 1): string {\n  return " ".repeat(width) + text;\n}\n'
g rm -q docs/legacy.md
write_file "windows/setup.bat" '@echo off\r\nset APP_ENV=staging\r\nset PORT=8080\r\ncall start.cmd\r\n'
write_file "assets/logo.png" "$png_main"
write_file "src/config.json" '{\n  "user": "main",\n  "theme": "dark"\n}\n'
write_file "README.md" '# Conflict demo\n\nA throwaway repository for testing merges and rebases.\n'
write_report main
write_routes main
write_table main
commit_all "Main: bump version, reindent layout, drop legacy docs"

# feature: "theirs" in the merge, the replayed commit in the rebase.
g checkout -q feature
write_app "" "2.0.0-beta" "3" "Hi" "attempts++;" \
  'return values.reduce((sum, value) => sum + Math.round(value), 0);' \
  'return `${user.name}, age ${user.age}`;' "5000" 'console.log(`v${VERSION}`);'
write_file "src/layout.ts" 'export function layout(width: number, height: number) {\n  const area = width * height;\n  const ratio = height === 0 ? 0 : width / height;\n  return { area, ratio };\n}\n'
g rm -q src/old-utils.ts
write_file "docs/legacy.md" '# Legacy notes\n\nThese notes describe the old deployment process.\nStill needed for the 1.x branch.\n'
write_file "windows/setup.bat" '@echo off\r\nset APP_ENV=production\r\nset PORT=8080\r\ncall start.cmd --verbose\r\n'
write_file "assets/logo.png" "$png_feature"
write_file "src/config.json" '{\n  "user": "feature",\n  "locale": "en"\n}\n'
write_file "README.md" '# Conflict demo\n\nA throwaway repository for testing merges and rebases.\n'
write_report feature
write_routes feature
write_table feature
commit_all "Feature: new version, safer layout, keep legacy docs"

if [ "$mode" = "rebase" ]; then
  if g rebase main >/dev/null 2>&1; then
    echo "Expected the rebase to stop on conflicts, but it finished." >&2
    exit 1
  fi
  abort_hint="git -C \"$target\" rebase --abort"
  sides="ours = main (the upstream), theirs = the feature commit being replayed"
else
  g checkout -q main
  if g merge --no-edit feature >/dev/null 2>&1; then
    echo "Expected the merge to stop on conflicts, but it finished." >&2
    exit 1
  fi
  abort_hint="git -C \"$target\" merge --abort"
  sides="ours = main, theirs = feature"
fi

if [ -z "$(g ls-files -u)" ]; then
  echo "Expected unmerged paths, found none." >&2
  exit 1
fi

# Everyday work tree changes next to the conflicts, one of each status.
write_file "src/constants.ts" 'export const TIMEOUT_MS = 8000;\nexport const RETRIES = 3;\nexport const DEBUG = false;\n'
rm "$target/CHANGELOG.md"
g mv docs/guide.md docs/getting-started.md
write_file "src/api/client.ts" 'export async function get(url: string): Promise<unknown> {\n  const response = await fetch(url);\n  return response.json();\n}\n'
g add src/api/client.ts
write_file "src/utils/format.ts" 'export function formatDate(date: Date): string {\n  return date.toISOString().slice(0, 10);\n}\n'
write_file "notes/todo.md" '# TODO\n\n- Write tests for the API client.\n'
write_cities edited
write_table edited
rm "$target/src/legacy/big-module.js"
mkdir -p "$target/styles"
awk 'BEGIN {
  print ":root {"
  print "  --brand: #3574f0;"
  print "}"
  print ""
  for (i = 1; i <= 400; i++) {
    printf ".spacing-%d {\n  margin: %dpx;\n  padding: %dpx;\n}\n", i, i, i * 2
  }
}' >"$target/styles/theme.css"
g add styles/theme.css
awk 'BEGIN {
  print "# API reference"
  print ""
  for (i = 1; i <= 250; i++) {
    printf "## endpoint%03d\n\n`GET /api/v1/items/%d`\n\nReturns item %d with its metadata.\n\n", i, i, i
  }
}' >"$target/docs/api-reference.md"

cat <<EOF

Created $target
Stopped in a $mode with conflicts ($sides):

$(g status --short)

Things to try in Git Manager:
  src/app.ts         3 clean changes per side, one identical change (greeting) and
                     2 real conflicts (VERSION, total()). Apply the clean chunks, then
                     resolve the two conflicts by hand or by picking a side.
  src/layout.ts      One side only reindents, the other edits a line. Toggle
                     "ignore whitespace" and the conflict turns into a one-sided change.
  src/config.json    Added on both sides: empty base, merge the two JSON objects.
  docs/legacy.md     Deleted on main, edited on feature: keep it or confirm the delete.
  src/old-utils.ts   Edited on main, deleted on feature: keep it or confirm the delete.
  assets/logo.png    Binary on both sides: pick one image for the whole file.
  windows/setup.bat  CRLF line endings: after saving, check with
                     file "$target/windows/setup.bat"
  src/report.ts      Long file (about 2400 lines): 4 clean changes spread through it and
                     2 conflicts, around line 1200 and near the end. Try F7 and scrolling.
  server/routes.py   Long file (about 2450 lines) with 5 conflicts and 6 clean changes.
  README.md          Changed identically on both sides; git merged it without a conflict.

Other changes, for the file explorer letters and the Changes view:
  src/constants.ts         M  modified, not staged
  CHANGELOG.md             D  deleted, not staged
  docs/getting-started.md  R  renamed from docs/guide.md (staged)
  src/api/client.ts        A  new file, staged
  src/utils/format.ts      U  untracked
  notes/todo.md            U  untracked
  data/cities.json         M  long file (about 2000 lines) with 3 edits far apart
  docs/api-reference.md    U  long untracked file (about 1500 lines)
  src/components/DataTable.tsx  M  long file (about 1600 lines): merged cleanly by git
                                   (staged) plus 2 edits that are not staged
  styles/theme.css         A  long new file (about 1600 lines), staged
  src/legacy/big-module.js D  long file (about 1200 lines), deleted

When every file is resolved, use Continue in the app. To start over:
  $abort_hint
EOF

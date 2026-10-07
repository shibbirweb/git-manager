#!/bin/sh
# Every file of the SwiftUI experiment stays at most 120 columns per line and 300 lines long, generated
# data included (split it into more files instead). Lists each file that breaks a rule; exit code 1 then.
# Usage: swiftui/scripts/check-lines.sh
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
max_columns=120
max_lines=300

files=$(git ls-files --cached --others --exclude-standard -- swiftui .github/workflows/native.yml \
  docs/plans/swiftui-experiment.md | grep -vE '\.(png|lock)$|/Cargo\.lock$' || true)

failed=0
for file in $files; do
  [ -f "$file" ] || continue
  report=$(awk -v cols="$max_columns" -v max="$max_lines" -v name="$file" '
    { if (length($0) > cols) { wide++; if (!first) first = NR } }
    END {
      if (NR > max) printf "%s: %d lines (at most %d)\n", name, NR, max
      if (wide) printf "%s: %d lines over %d columns, first at line %d\n", name, wide, cols, first
    }' "$file")
  if [ -n "$report" ]; then
    echo "$report"
    failed=1
  fi
done
if [ "$failed" -eq 0 ]; then
  echo "All files are within $max_columns columns and $max_lines lines."
fi
exit "$failed"

#!/bin/sh
# Runs the Swift tests (gm-measure's MeasureKit). With Xcode, `swift test` finds Swift Testing by itself;
# the Command Line Tools keep it in their own Frameworks folder, which SwiftPM does not search, so this
# passes that folder along. Usage: swiftui/scripts/test.sh [swift test options]
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
developer=$(xcode-select -p 2>/dev/null || true)
case "$developer" in
  *CommandLineTools*)
    frameworks="$developer/Library/Developer/Frameworks"
    libs="$developer/Library/Developer/usr/lib"
    exec swift test --package-path "$here" \
      -Xswiftc -F -Xswiftc "$frameworks" \
      -Xlinker -F -Xlinker "$frameworks" \
      -Xlinker -rpath -Xlinker "$frameworks" \
      -Xlinker -rpath -Xlinker "$libs" \
      "$@"
    ;;
  *)
    exec swift test --package-path "$here" "$@"
    ;;
esac

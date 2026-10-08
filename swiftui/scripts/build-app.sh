#!/bin/sh
# Builds Git Manager Native (docs/plans/swiftui-experiment.md): the Rust bridge, the Swift app,
# and the .app bundle in swiftui/build. Usage: swiftui/scripts/build-app.sh [debug|release]
set -eu

config="${1:-release}"
if [ "$config" != "debug" ] && [ "$config" != "release" ]; then
  echo "usage: $0 [debug|release]" >&2
  exit 2
fi

here=$(cd "$(dirname "$0")/.." && pwd)
# The Rust objects must target the same macOS as Package.swift, or ld warns on every one.
export MACOSX_DEPLOYMENT_TARGET=13.0

# The bridge is always a release build: Package.swift links bridge/target/release.
cargo build --release --locked --manifest-path "$here/bridge/Cargo.toml"

# SwiftPM does not track the Rust library, so drop the old binary to force a relink.
rm -f "$here/.build/$config/GitManagerNative"
swift build -c "$config" --package-path "$here"

app="$here/build/Git Manager Native.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp "$here/.build/$config/GitManagerNative" "$app/Contents/MacOS/GitManagerNative"
# Syntax highlighting runs the current app's own grammars (App/Highlight/entry.ts) in JavaScriptCore.
mkdir -p "$app/Contents/Resources"
(cd "$here/.." && bun build swiftui/App/Highlight/entry.ts --target=browser --format=iife --minify \
  --outfile "$app/Contents/Resources/highlight.js" > /dev/null)
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>shibbirweb.github.io.gitmanager.native</string>
  <key>CFBundleName</key>
  <string>Git Manager Native</string>
  <key>CFBundleDisplayName</key>
  <string>Git Manager Native</string>
  <key>CFBundleExecutable</key>
  <string>GitManagerNative</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST
# Ad-hoc signature, so macOS runs the local build.
codesign --force --sign - "$app"
echo "Built: $app"

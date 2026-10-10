#!/bin/bash
# CI only (.github/workflows/native-parity.yml): lets gm-measure capture other apps' windows on a GitHub macOS
# runner, where nobody can click Allow. macOS keeps Screen Recording consent (kTCCServiceScreenCapture) in its TCC
# databases; the runner images have SIP off, so root may write them (actions/runner-images does the same in
# configure-tccdb-macos.sh for its own agent). macOS asks about the "responsible" process of the one that captures,
# so this grants every executable from this shell up to launchd, the runner's known agents, and the binaries given.
# macOS 15 also asks again now and then unless replayd holds an approval date per binary, so it writes one.
# Refuses to run outside CI: it changes privacy settings.
# Usage: swiftui/scripts/ci-allow-screen-capture.sh <binary>...
set -u

if [ "${CI:-}" != "true" ]; then
  echo "Refusing to change privacy settings outside CI (CI=true is not set)." >&2
  exit 1
fi

clients=("$@" /bin/bash /bin/sh /bin/zsh /opt/hca/hosted-compute-agent /usr/local/opt/runner/provisioner/provisioner)
pid=$$
while [ "$pid" -gt 1 ]; do
  executable=$(ps -o comm= -p "$pid" | sed 's/^-//')
  case "$executable" in
    /*) ;;
    *) executable=$(command -v "$executable" || true) ;;
  esac
  if [ -n "$executable" ]; then
    clients+=("$executable")
  fi
  pid=$(ps -o ppid= -p "$pid" | tr -d ' ')
  if [ -z "$pid" ]; then
    break
  fi
done

system_db="/Library/Application Support/com.apple.TCC/TCC.db"
user_db="$HOME/Library/Application Support/com.apple.TCC/TCC.db"
approvals="$HOME/Library/Group Containers/group.com.apple.replayd/ScreenCaptureApprovals.plist"
now=$(date +%s)
printf '%s\n' "${clients[@]}" | sort -u | while IFS= read -r client; do
  # Columns named, so the insert works across macOS versions that added columns with defaults.
  sql="INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, flags,
    last_modified) VALUES ('kTCCServiceScreenCapture', '$client', 1, 2, 4, 1, 0, $now);"
  if ! sudo sqlite3 "$system_db" "$sql"; then
    echo "::warning::Could not grant Screen Recording to $client in the system TCC database"
  fi
  if [ -f "$user_db" ]; then
    sqlite3 "$user_db" "$sql" || echo "::warning::Could not grant Screen Recording to $client for the user"
  fi
  defaults write "$approvals" "$client" -date "3024-01-01 00:00:00 +0000" 2>/dev/null || true
  echo "Screen Recording allowed for $client"
done

echo "Screen Recording entries in the system TCC database:"
sudo sqlite3 "$system_db" "SELECT client, auth_value FROM access WHERE service = 'kTCCServiceScreenCapture';" || true

#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Re-signs a downloaded Fluxins macOS build (.app, .zip or .dmg) with a stable local code-signing identity
# and installs it. The release workflow only ad-hoc signs, which gives every build a new code identity, so
# macOS asks for camera, microphone and screen recording access again after each update. Signing every
# build with the same certificate keeps those grants.
#
# Usage: scripts/fluxins/resign-mac.sh <Fluxins.app | Fluxins-x.y.z-mac-arm64.zip | .dmg> [identity] [--no-install]
#
# The identity defaults to $CSC_NAME, then to the first "Apple Development" identity in the keychain.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
entitlements="$script_dir/../../fluxer_desktop/build_resources/entitlements.mac.adhoc.plist"

install=true
args=()
for arg in "$@"; do
	if [ "$arg" = "--no-install" ]; then install=false; else args+=("$arg"); fi
done

input="${args[0]:-}"
identity="${args[1]:-${CSC_NAME:-}}"
if [ -z "$input" ] || [ ! -e "$input" ]; then
	echo "usage: $0 <Fluxins.app | .zip | .dmg> [identity] [--no-install]" >&2
	exit 2
fi
if [ -z "$identity" ]; then
	identity="$(security find-identity -v -p codesigning | sed -n 's/.*"\(Apple Development:[^"]*\)".*/\1/p' | head -n 1)"
fi
if [ -z "$identity" ]; then
	echo "No code-signing identity found. Pass one as the second argument or set CSC_NAME." >&2
	exit 1
fi

work="$(mktemp -d)"
cleanup() {
	if [ -d "$work/mnt" ]; then hdiutil detach "$work/mnt" -quiet || true; fi
	rm -rf "$work"
}
trap cleanup EXIT

case "$input" in
*.zip)
	ditto -x -k "$input" "$work/src"
	;;
*.dmg)
	mkdir "$work/mnt" "$work/src"
	hdiutil attach "$input" -nobrowse -readonly -mountpoint "$work/mnt" -quiet
	ditto "$work/mnt"/*.app "$work/src/$(basename "$work/mnt"/*.app)"
	;;
*.app)
	mkdir "$work/src"
	ditto "$input" "$work/src/$(basename "$input")"
	;;
*)
	echo "Unsupported input: $input (expected .app, .zip or .dmg)" >&2
	exit 2
	;;
esac

app="$(find "$work/src" -maxdepth 2 -name '*.app' -type d | head -n 1)"
if [ -z "$app" ]; then
	echo "No .app found in $input" >&2
	exit 1
fi

echo "Signing $(basename "$app") with: $identity"
xattr -cr "$app"
codesign --force --deep --sign "$identity" --entitlements "$entitlements" "$app"
codesign --verify --deep --strict "$app"
codesign -dr - "$app" 2>&1 | sed -n 's/^designated => /Designated requirement: /p'

if [ "$install" = false ]; then
	mkdir -p "$PWD/signed"
	rm -rf "$PWD/signed/$(basename "$app")"
	ditto "$app" "$PWD/signed/$(basename "$app")"
	echo "Signed app written to $PWD/signed/$(basename "$app")"
	exit 0
fi

target="/Applications/$(basename "$app")"
osascript -e "tell application \"$(basename "$app" .app)\" to quit" >/dev/null 2>&1 || true
sleep 1
rm -rf "$target"
ditto "$app" "$target"
echo "Installed $target"

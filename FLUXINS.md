# Fluxins

Fluxins is a fork of [Fluxer](https://github.com/fluxerapp/fluxer) with a desktop client that
can connect to a self-hosted instance. It is licensed under AGPL-3.0-or-later like upstream
(see [LICENSE](./LICENSE)). Fluxer's branding is not covered by that license, see the README.

## What differs from upstream

- **Instance picker** in the desktop client: "Change instance..." in the tray menu, the help
  menu and the File menu (`Ctrl+Shift+Alt+I`), plus a link on the desktop login screen
  (`fluxer_app`, only visible on instances that serve a build containing it).
- **Identity**: name, IDs, `fluxins://` protocol, user data directory and icons.
- **Default instance**: `https://fluxer.opland.net`, set in `fluxer_desktop/src/common/Constants.ts`.
- **Updates**: the Windows installer updates itself from this repo's GitHub releases (Velopack, see
  below). macOS and the portable zip cannot self-update, but the app tells you when a newer release
  exists and links to the download (see "Update notices").

## Releasing a new build

Releases are built by GitHub Actions (`.github/workflows/release-fluxins.yaml`):

- Push a tag: `git tag fluxins-v1.0.1 && git push origin fluxins-v1.0.1`, or
- Actions -> "release fluxins" -> Run workflow, and enter the version.

The workflow builds the native modules and packages the client on GitHub-hosted runners, then
publishes one release with:

| Platform | File | Notes |
| --- | --- | --- |
| Windows x64 | `Fluxins-<version>-win-x64-Setup.exe` | Installer (Start menu, desktop shortcut, uninstall). Updates itself. Not code-signed, so SmartScreen will warn. |
| Windows x64 | `Fluxins-<version>-win-x64.zip` | Portable: unzip anywhere and run `Fluxins.exe`. Does not update itself. |
| macOS (Apple Silicon) | `Fluxins-<version>-mac-arm64.dmg` and `.zip` | Ad-hoc signed, not notarised. See below. |

Each installer/archive has a `.sha256` checksum next to it. The release also contains the
Velopack update feed (`releases.win.json`, `RELEASES` and the `*-full.nupkg` package); these are
read by the installed app and are not meant to be downloaded by hand.

### Windows updates (Velopack)

The installed app checks `https://github.com/Ferdinand99/fluxer/releases/latest/download`
(`VELOPACK_UPDATE_URL` in `fluxer_desktop/src/main/UpdaterDownloads.ts`), downloads the newest
`*-full.nupkg` and installs it on restart. Things to know:

- GitHub's `latest` ignores **pre-releases**: a release only becomes an update once it is published
  as a normal release. Do not tick "prerelease" for a version you want installed clients to pick up.
- Every release must contain the Velopack files, which the workflow always attaches. Do not delete
  assets from the latest release.
- Only clients installed with `Setup.exe` update themselves, not the zip.
- Updates are unsigned. Anyone who can publish a release on this repository can ship code to every
  installed client, so protect the repository and its Actions.
- Which platforms self-update is set by `IN_APP_UPDATE_PLATFORMS` in
  `fluxer_desktop/src/common/Constants.ts` (currently Windows only).

### macOS notes

Without an Apple Developer ID certificate the app is only ad-hoc signed, so Gatekeeper blocks
the first launch. Open it with right-click -> Open, or run
`xattr -dr com.apple.quarantine /Applications/Fluxins.app`. Passkeys are unavailable in
unsigned macOS builds, because they need a signed app with an associated-domains entitlement.

To produce signed and notarised builds, add the repository secrets `CSC_LINK`,
`CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`. Signing is
switched on automatically when `CSC_LINK`, `CSC_NAME` or `CSC_KEYCHAIN` is set
(`macSigningEnabled` in `fluxer_desktop/electron-builder.config.cjs`). You also need your own
provisioning profile (set `provisioningProfile` there) and entitlements for your Apple team.

### Update notices (macOS and portable zip)

Builds that cannot update themselves still check the newest release: the app reads
`https://api.github.com/repos/Ferdinand99/fluxer/releases/latest` (`GITHUB_LATEST_RELEASE_API_URL`),
compares the tag (`fluxins-v<version>`) with its own version and, if newer, shows the usual
"update available" prompt with a link to the matching `.dmg` (macOS) or `Setup.exe` (Windows).
Download and install it by hand. Like the Velopack feed this uses `latest`, so pre-releases are
ignored. Anonymous GitHub API calls are limited to 60 per hour per IP, which is plenty for this.
`MANUAL_UPDATE_FEED` in `Constants.ts` selects the source (`'github'` here, `'pkgs'` is upstream's feed).

### Building locally

Needs Node 24, pnpm (see `packageManager` in `package.json`), Rust (MSVC toolchain) and
Visual Studio Build Tools with the C++ workload.

```powershell
pnpm install --frozen-lockfile --ignore-scripts --filter "fluxer_desktop..."
cd fluxer_desktop
$env:NODE_ENV = 'production'; $env:FLUXER_DESKTOP_PRODUCTION = 'true'
pnpm build
$env:ELECTRON_ARCH = 'x64'
pnpm exec electron-builder --config electron-builder.config.cjs --win dir --x64
# Output: fluxer_desktop/dist-electron/win-unpacked/Fluxins.exe
```

Close any running Fluxins first; it locks `resources/app.asar`.

## Keeping up with upstream

```powershell
./scripts/fluxins/sync-upstream.ps1 -Verify
```

This fetches `upstream`, creates `sync/upstream-<date>` from `main`, merges
`upstream/main` and (with `-Verify`) runs the desktop typecheck and tests. It never pushes.
If it reports conflicts, they are almost always in the files listed in the script's `$hotFiles`
(identity, constants, updater, menus): keep the Fluxins identity and take upstream's other changes.
Then push the branch, open a pull request, test the client and tag a release.

Expected test result on Windows: the 4 AppImage tests fail (Linux-only), everything else passes.

Do the sync regularly, and keep the client in step with the version of the server it connects to.

## Known gaps

- `fluxer.com` domain-migration constants and the Linux packaging still use Fluxer names.
- The release workflow builds Windows x64 and macOS arm64 only (no ARM64 Windows, Intel Mac or Linux).
- The macOS build has not been run yet; the first workflow run may need adjustments.
- Icons are generated placeholders (`fluxer_desktop/build_resources/icons-*`).

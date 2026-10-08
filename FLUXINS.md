# Fluxins

Fluxins is a fork of [Fluxer](https://github.com/fluxerapp/fluxer) with its own desktop client for
Windows and macOS. It is licensed under AGPL-3.0-or-later like upstream (see [LICENSE](./LICENSE)).
Fluxer's branding is not covered by that license, see the README.

## How the client works

The desktop client follows upstream's architecture:

- A **shell** (Electron) with native modules.
- A **web renderer** that is bundled into the shell and also delivered as downloadable **modules**
  (renderer, fonts, emoji sprites, noise suppression, ...). The shell checks
  `<package origin>/desktop/stable/<platform>/<arch>/modules.json` and downloads newer modules.
- **Instance accounts**: the login screen has an instance picker and the account menu lets you add
  accounts on other instances.

## What differs from upstream

- **Identity**: name Fluxins, IDs (`net.opland.fluxins`), `fluxins://` protocol, user data directory,
  Velopack id `fluxins_desktop` and icons. These live in `fluxer_desktop/src/common/DesktopIdentity.ts`,
  `Constants.ts`, `UserDataPath.ts`, `electron-builder.config.cjs` and the tray GUIDs in `DesktopTray.ts`.
- **Verified instances**: the instance picker lists Fluxer (official) and `fluxer.opland.net` with the
  verified badge, and a fresh install shows the Opland instance as a fixed entry
  (`fluxer_app/src/features/auth/flow/instance_selector/FluxinsVerifiedInstances.ts`).
- **Package origin**: `https://ferdinand99.github.io/fluxer` (`CHANNEL_PACKAGE_ORIGINS` in
  `fluxer_desktop/src/main/ShellDownloadFormats.ts`), served from the `gh-pages` branch.
- **Shell updates**: Windows installs update through Velopack from this repository's GitHub releases
  (`VELOPACK_UPDATE_SOURCE`, keep it the plain repository URL). macOS builds are unsigned and fall back
  to the download page (`MAC_SELF_UPDATE_ENABLED` in `ShellUpdateCapability.ts`).
- **Release pipeline**: `.github/workflows/release-fluxins.yaml`, unsigned and limited to Windows x64 and
  macOS arm64.
- **CI**: `.github/workflows/tests.yaml` only runs the jobs that matter for the client.

## Releasing

Actions -> "release fluxins" -> Run workflow. Versions are CalVer (`YYYY.MDD.MICRO`) from the UTC clock
unless you pass `build_version`. The workflow:

1. builds the renderer once and packs it into modules (`tools/ci` steps `build_shared_assets`,
   `split_modules`, `pack_modules`),
2. builds the shell for Windows x64 and macOS arm64 around that renderer and packages it
   (electron-builder, plus Velopack on Windows),
3. writes `modules.json` for each platform and publishes the manifests and module packages to the
   `gh-pages` branch (the package origin),
4. publishes a GitHub release with the installers and the Velopack feed.

| Platform | File | Notes |
| --- | --- | --- |
| Windows x64 | `Fluxins-<version>-win-x64-Setup.exe` | Installer, updates itself. Not code-signed, SmartScreen will warn. |
| Windows x64 | `Fluxins-<version>-win-x64.zip` | Portable, does not update itself. |
| macOS arm64 | `Fluxins-<version>-mac-arm64.dmg` and `.zip` | Ad-hoc signed, not notarised. |

The release also contains the Velopack feed (`releases.win.json`, `RELEASES`, `*-full.nupkg`).

One-time setup for the package origin: Settings -> Pages -> Deploy from a branch -> `gh-pages` / root.
The workflow rewrites `gh-pages` as a single commit on every release and keeps the module packages of
earlier releases.

### Windows updates

Velopack reads the newest non-pre-release GitHub release. Do not tick "prerelease" for a version you want
installed clients to pick up, do not delete assets from the latest release, and keep
`VELOPACK_UPDATE_SOURCE` as the plain repository URL (a path such as `/releases/latest/download` makes
every check fail with a 404). Updates are unsigned: anyone who can publish a release here can ship code
to every installed client, so protect the repository and its Actions.

### macOS

Without an Apple Developer ID certificate the app is only ad-hoc signed, so Gatekeeper blocks the first
launch (right-click -> Open, or `xattr -dr com.apple.quarantine /Applications/Fluxins.app`) and passkeys
are unavailable. To sign and notarise, add the secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`,
`APPLE_API_KEY_ID` and `APPLE_API_ISSUER`; signing switches on when `CSC_LINK`, `CSC_NAME` or
`CSC_KEYCHAIN` is set (`macSigningEnabled` in `electron-builder.config.cjs`). You also need your own
provisioning profile and entitlements, and can then set `MAC_SELF_UPDATE_ENABLED` to true.

## Keeping up with upstream

```powershell
./scripts/fluxins/sync-upstream.ps1 -Verify
```

This fetches `upstream`, creates `sync/upstream-<date>`, merges `upstream/main` and (with `-Verify`) runs
the desktop typecheck and tests. It never pushes. Conflicts are almost always in the identity files
(`DesktopIdentity.ts`, `Constants.ts`, `UserDataPath.ts`, `DesktopTray.ts`, `ShellDownloadFormats.ts`,
`electron-builder.config.cjs`): keep upstream's structure and re-apply the Fluxins values.

On Windows the working tree has CRLF line endings, so tests that read source files as text fail locally
(Bootstrap entry point, window chrome, ...). CI on Linux is the reference. The Linux-only AppImage tests and
the symlink test also fail on Windows.

## Known gaps

- `fluxer.com` domain-migration constants and the Linux packaging still use Fluxer names.
- The release workflow builds Windows x64 and macOS arm64 only.
- Icons are generated placeholders (`fluxer_desktop/build_resources/icons-*`).
- The release workflow is new and has to be exercised on GitHub; expect to iterate on it.

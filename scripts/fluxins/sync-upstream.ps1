<#
.SYNOPSIS
  Merges the latest upstream Fluxer changes into a new sync branch.

.DESCRIPTION
  Fetches `upstream` (fluxerapp/fluxer), creates `sync/upstream-<date>` from the
  base branch and merges `upstream/<UpstreamBranch>` into it. Nothing is pushed
  and nothing is merged into the base branch: review the result, then open a pull
  request or merge it yourself.

  If the merge conflicts, the merge is left in progress so you can resolve it.
  Use `git merge --abort` to back out.

.PARAMETER BaseBranch
  Branch the sync branch is created from. Default: main.

.PARAMETER UpstreamBranch
  Upstream branch to merge. Default: main.

.PARAMETER Verify
  After a clean merge, run the desktop typecheck and unit tests.

.EXAMPLE
  ./scripts/fluxins/sync-upstream.ps1 -Verify
#>
[CmdletBinding()]
param(
  [string]$BaseBranch = 'main',
  [string]$UpstreamBranch = 'main',
  [switch]$Verify
)

$ErrorActionPreference = 'Stop'
Set-Location (git rev-parse --show-toplevel)

# Files this fork changes on purpose. Conflicts here usually mean upstream touched the
# same lines; keep the Fluxins identity and take upstream's other changes.
$hotFiles = @(
  'fluxer_desktop/electron-builder.config.cjs',
  'fluxer_desktop/package.json',
  'fluxer_desktop/src/common/Constants.ts',
  'fluxer_desktop/src/common/DesktopIdentity.ts',
  'fluxer_desktop/src/common/UserDataPath.ts',
  'fluxer_desktop/src/main/DesktopTray.ts',
  'fluxer_desktop/src/main/ShellDownloadFormats.ts',
  'fluxer_desktop/src/main/ShellSelfUpdate.ts',
  'fluxer_desktop/src/main/ShellUpdateCapability.ts',
  'fluxer_desktop/src/main/Bootstrap.ts',
  'fluxer_app/src/features/auth/flow/InstanceSelector.tsx',
  'fluxer_app/src/features/auth/flow/instance_selector/InstancePickerRows.tsx',
  '.github/workflows/tests.yaml'
)

function Fail([string]$message) {
  Write-Host $message -ForegroundColor Red
  exit 1
}

if (git status --porcelain) {
  Fail 'Working tree is not clean. Commit or stash your changes first.'
}

if (-not (git remote | Select-String -SimpleMatch -Quiet 'upstream')) {
  Write-Host 'Adding remote "upstream" -> https://github.com/fluxerapp/fluxer.git'
  git remote add upstream https://github.com/fluxerapp/fluxer.git
}

git fetch upstream
if ($LASTEXITCODE -ne 0) { Fail 'git fetch upstream failed.' }

$behind = [int](git rev-list --count "$BaseBranch..upstream/$UpstreamBranch")
if ($behind -eq 0) {
  Write-Host "Already up to date with upstream/$UpstreamBranch." -ForegroundColor Green
  exit 0
}
Write-Host "$BaseBranch is $behind commit(s) behind upstream/$UpstreamBranch."

$touchedByUpstream = git diff --name-only "$BaseBranch...upstream/$UpstreamBranch"
$overlap = $hotFiles | Where-Object { $touchedByUpstream -contains $_ }
if ($overlap) {
  Write-Host 'Upstream changed files this fork also modifies (possible conflicts):' -ForegroundColor Yellow
  $overlap | ForEach-Object { Write-Host "  $_" }
}

$branch = "sync/upstream-$(Get-Date -Format 'yyyyMMdd')"
if (git branch --list $branch) {
  Fail "Branch $branch already exists. Delete or rename it first."
}

git checkout -b $branch $BaseBranch
if ($LASTEXITCODE -ne 0) { Fail "Could not create $branch." }

git merge "upstream/$UpstreamBranch" --no-edit
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Merge stopped with conflicts:' -ForegroundColor Yellow
  git diff --name-only --diff-filter=U | ForEach-Object { Write-Host "  $_" }
  Write-Host ''
  Write-Host 'Resolve them, `git add` the files and run `git commit`.'
  Write-Host 'To give up: git merge --abort; git checkout main; git branch -D' $branch
  exit 2
}

Write-Host "Merged upstream/$UpstreamBranch into $branch." -ForegroundColor Green

if ($Verify) {
  Push-Location fluxer_desktop
  try {
    pnpm install --frozen-lockfile --ignore-scripts
    pnpm build
    pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) { Fail 'Typecheck failed.' }
    # AppImage tests are Linux-only and are expected to fail on Windows.
    node --test 'src/main/*.test.mjs'
  } finally {
    Pop-Location
  }
}

Write-Host ''
Write-Host 'Next steps:'
Write-Host "  1. Test the client (pnpm build in fluxer_desktop, then run it)."
Write-Host "  2. git push -u origin $branch and open a pull request into $BaseBranch."
Write-Host '  3. Tag a release (fluxins-v<version>) to publish a new build.'

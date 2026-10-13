<#
Read-only bootstrap check for Windows PowerShell 5.1 and PowerShell 7.
Installer commands are displayed only. No download, install, policy change,
package agreement acceptance, or npm dependency installation is performed.
Sources: https://nodejs.org/en/download
https://docs.blender.org/manual/en/latest/advanced/command_line/launch/windows.html
https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_operators
#>
[CmdletBinding()]
param([string]$Blender = '')

$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    Write-Host 'ERROR: Windows用です。macOSでは bash setup/check-macos.sh を実行してください。'
    exit 2
}

function Find-Executable([string]$Name) {
    $command = Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) { return $command.Source }
    return $null
}

function Read-NativeVersion([string]$Executable, [string[]]$CommandArguments) {
    try {
        $lines = & $Executable @CommandArguments 2>$null
        $nativeCode = $LASTEXITCODE
        if ($nativeCode -ne 0) { return $null }
        return (($lines | Out-String).Trim())
    }
    catch { return $null }
}

function Quote-PowerShellPath([string]$Value) {
    return "'" + $Value.Replace("'", "''") + "'"
}

$requiredMissing = 0
$nodeOk = $false
$npmOk = $false
$blenderOk = $false
$gitOk = $false
$runtimePath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$architecture = $env:PROCESSOR_ARCHITECTURE
if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
Write-Host 'Room Tour Production: 読み取り専用の生成環境チェック'
Write-Host ('OS: Windows {0} ({1}); PowerShell {2}' -f [Environment]::OSVersion.Version, $architecture, $PSVersionTable.PSVersion)

$nodePath = Find-Executable 'node.exe'
if ($nodePath) {
    $nodeVersion = Read-NativeVersion $nodePath @('--version')
    if ($nodeVersion -match '^v([0-9]+)\.[0-9]+\.[0-9]+$' -and [int]$Matches[1] -ge 22) {
        $nodeOk = $true
        Write-Host ('OK Node: {0} ({1})' -f $nodeVersion, $nodePath)
    }
    else { Write-Host ('不足 Node: 22以上の安定版が必要です。検出={0} ({1})' -f $nodeVersion, $nodePath) }
}
else { Write-Host '不足 Node: 未検出。22以上の安定版が必要です。' }
if (-not $nodeOk) { $requiredMissing++ }

# npm.cmd avoids npm.ps1 and therefore does not require an execution-policy change.
$npmPath = Find-Executable 'npm.cmd'
if ($npmPath -and $nodePath) {
    $npmVersion = Read-NativeVersion $npmPath @('--version')
    if ($npmVersion -match '^[0-9]+\.[0-9]+\.[0-9]+$') {
        $npmOk = $true
        Write-Host ('OK npm: {0} ({1})' -f $npmVersion, $npmPath)
    }
}
if (-not $npmOk) {
    Write-Host '不足 npm: 未検出または実行失敗。Node公式インストーラーのnpm同梱版を使用してください。'
    $requiredMissing++
}

$blenderCandidates = New-Object 'System.Collections.Generic.List[string]'
if ($Blender) {
    $blenderCandidates.Add($Blender)
}
elseif ($env:BLENDER_BIN) {
    $blenderCandidates.Add($env:BLENDER_BIN)
}
else {
    $installationRoots = @()
    if ($env:ProgramFiles) { $installationRoots += (Join-Path $env:ProgramFiles 'Blender Foundation') }
    $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    if ($programFilesX86) { $installationRoots += (Join-Path $programFilesX86 'Blender Foundation') }
    if ($env:LOCALAPPDATA) {
        $installationRoots += (Join-Path $env:LOCALAPPDATA 'Programs\Blender Foundation')
        $installationRoots += (Join-Path $env:LOCALAPPDATA 'Blender Foundation')
        $installationRoots += (Join-Path $env:LOCALAPPDATA 'Programs\Blender')
    }
    foreach ($installationRoot in $installationRoots) {
        $blenderCandidates.Add((Join-Path $installationRoot 'Blender 5.1\blender.exe'))
        $blenderCandidates.Add((Join-Path $installationRoot 'Blender\blender.exe'))
        $blenderCandidates.Add((Join-Path $installationRoot 'blender.exe'))
        if (Test-Path -LiteralPath $installationRoot -PathType Container) {
            $directories = Get-ChildItem -LiteralPath $installationRoot -Directory -Filter 'Blender*' -ErrorAction SilentlyContinue
            foreach ($directory in $directories) {
                $blenderCandidates.Add((Join-Path $directory.FullName 'blender.exe'))
            }
        }
    }
    $pathBlender = Find-Executable 'blender.exe'
    if ($pathBlender) { $blenderCandidates.Add($pathBlender) }
}

$blenderPath = $null
$seenCandidates = @{}
foreach ($candidate in $blenderCandidates) {
    if ($seenCandidates.ContainsKey($candidate)) { continue }
    $seenCandidates[$candidate] = $true
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    $candidateVersion = Read-NativeVersion $candidate @('--version')
    $firstLine = ''
    if ($candidateVersion) { $firstLine = ($candidateVersion -split '\r?\n')[0] }
    if ($firstLine -match '^Blender\s+5\.1\.[0-9]+(?:\s.*)?$') {
        $blenderOk = $true
        $blenderPath = (Resolve-Path -LiteralPath $candidate).Path
        Write-Host ('OK Blender: {0}' -f $firstLine)
        Write-Host ('Blender executable: {0}' -f $blenderPath)
        break
    }
    Write-Host ('参考 Blender: {0} ({1}) は5.1系として検証できませんでした。' -f $firstLine, $candidate)
}
if (-not $blenderOk) {
    Write-Host '不足 Blender: 5.1.xが必要です。-Blender、BLENDER_BIN、標準インストール先またはPATHを確認してください。'
    $requiredMissing++
}

$gitPath = Find-Executable 'git.exe'
if ($gitPath) {
    $gitVersion = Read-NativeVersion $gitPath @('--version')
    if ($gitVersion -match '^git version ') {
        $gitOk = $true
        Write-Host ('OK Git (任意): {0} ({1})' -f $gitVersion, $gitPath)
    }
}
if (-not $gitOk) { Write-Host '任意 Git: 未検出。GitHubからZIPを取得した場合は不要です。' }

if (-not $nodeOk -or -not $npmOk) {
    Write-Host ''
    Write-Host 'Node/npm導入: https://nodejs.org/en/download'
    Write-Host '  Node 22以上のLTS、Windows Installer (.msi)をCPUに合わせて選びます。'
    Write-Host "  Start-Process 'https://nodejs.org/en/download'"
    Write-Host '  ダウンロード後、人が次の2行を実行します:'
    Write-Host '  $installer = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE ''Downloads'') -Filter ''node-v*-*.msi'' | Sort-Object LastWriteTime -Descending | Select-Object -First 1'
    Write-Host '  if ($installer) { Start-Process -FilePath $installer.FullName -Wait }'
    Write-Host '  インストール完了後、PowerShellを開き直してください。'
}
if (-not $blenderOk) {
    Write-Host ''
    Write-Host 'Blender導入: https://www.blender.org/download/'
    Write-Host '  本プラグイン用の5.1系: https://download.blender.org/release/Blender5.1/'
    Write-Host "  Start-Process 'https://download.blender.org/release/Blender5.1/'"
    Write-Host '  5.1系Windows .msiをダウンロード後、人が次の2行を実行します:'
    Write-Host '  $installer = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE ''Downloads'') -Filter ''blender-5.1.*-windows-*.msi'' | Sort-Object LastWriteTime -Descending | Select-Object -First 1'
    Write-Host '  if ($installer) { Start-Process -FilePath $installer.FullName -Wait }'
    Write-Host '  ZIPのportable版は任意のフォルダへ展開し、-Blenderでblender.exeを指定してください。'
}
if (-not $gitOk) {
    Write-Host ''
    Write-Host 'Git導入 (任意): https://git-scm.com/downloads/'
    Write-Host "  Start-Process 'https://git-scm.com/downloads/'"
    Write-Host '  Windows installerをダウンロードして開くか、ZIP取得のまま進められます。'
}

Write-Host ''
Write-Host 'Codexプラグインの導入はREADMEの手順で確認してください。ここでは導入済みか判定しません。'
if ($nodeOk -and $npmOk) {
    Write-Host 'OSごとにnpm依存を導入し、その後に全依存チェックを実行します:'
    Write-Host ('  Set-Location -LiteralPath {0}' -f (Quote-PowerShellPath $runtimePath))
    Write-Host '  npm.cmd ci --ignore-scripts'
    $doctorCommand = '  node scripts/doctor.mjs'
    if ($blenderOk) { $doctorCommand += ' --blender ' + (Quote-PowerShellPath $blenderPath) }
    Write-Host $doctorCommand
}
if ($requiredMissing -gt 0) {
    Write-Host ('RESULT: MISSING ({0} required checks). 導入後にこのチェックを再実行してください。' -f $requiredMissing)
    exit 1
}
Write-Host 'RESULT: READY (生成用ソフト)。npm依存の確認はdoctor.mjsで行います。'
exit 0

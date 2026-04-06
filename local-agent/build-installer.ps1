[CmdletBinding()]
param(
    [string]$OutputDir,
    [string]$BuildRoot,
    [string]$AgentBinaryPath,
    [string]$InstallerName = 'nimvo-fiscal-agent-setup.exe',
    [switch]$KeepBuildFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $PSScriptRoot
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $scriptRoot 'dist'
}

if ([string]::IsNullOrWhiteSpace($BuildRoot)) {
    $BuildRoot = Join-Path $scriptRoot 'build'
}

if ([string]::IsNullOrWhiteSpace($AgentBinaryPath)) {
    $AgentBinaryPath = Join-Path $scriptRoot 'bin\nimvo-fiscal-agent.exe'
}

$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
$BuildRoot = [System.IO.Path]::GetFullPath($BuildRoot)
$AgentBinaryPath = [System.IO.Path]::GetFullPath($AgentBinaryPath)

function Write-Step {
    param([string]$Message)

    Write-Host "[nimvo-agent] $Message"
}

function New-CleanDirectory {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }

    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

$goProjectDir = Join-Path $scriptRoot 'go-agent'
$iexpressPath = Join-Path $env:SystemRoot 'System32\iexpress.exe'
$stagingDir = Join-Path $BuildRoot 'installer-files'
$sedPath = Join-Path $BuildRoot 'nimvo-fiscal-agent.sed'
$installerPath = Join-Path $OutputDir $InstallerName

if (-not (Test-Path -LiteralPath $goProjectDir)) {
    throw "Pasta do agente Go nao encontrada: $goProjectDir"
}

if (-not (Test-Path -LiteralPath $iexpressPath)) {
    throw "iexpress.exe nao encontrado em: $iexpressPath"
}

$goCommand = Get-Command go -ErrorAction Stop

New-Item -ItemType Directory -Path (Split-Path -Parent $AgentBinaryPath) -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
New-CleanDirectory -Path $BuildRoot
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$resolvedOutputDir = (Resolve-Path -LiteralPath $OutputDir).Path
$resolvedBuildRoot = (Resolve-Path -LiteralPath $BuildRoot).Path
$resolvedAgentBinaryPath = (Resolve-Path -LiteralPath (Split-Path -Parent $AgentBinaryPath)).Path
$resolvedAgentBinaryPath = Join-Path $resolvedAgentBinaryPath (Split-Path -Leaf $AgentBinaryPath)
$resolvedStagingDir = (Resolve-Path -LiteralPath $stagingDir).Path
$installerPath = Join-Path $resolvedOutputDir $InstallerName
$sedPath = Join-Path $resolvedBuildRoot 'nimvo-fiscal-agent.sed'

Write-Step "Compilando nimvo-fiscal-agent.exe"
Push-Location $goProjectDir
try {
    & $goCommand.Source build -o $resolvedAgentBinaryPath .
}
finally {
    Pop-Location
}

$stagedAgentExe = Join-Path $resolvedStagingDir 'nimvo-fiscal-agent.exe'
$stagedTrayIcon = Join-Path $resolvedStagingDir 'nimvo.ico'
$stagedLogoPng = Join-Path $resolvedStagingDir 'nimvo-logo.png'
$stagedWizardScript = Join-Path $resolvedStagingDir 'install-agent.ps1'

Copy-Item -LiteralPath $resolvedAgentBinaryPath -Destination $stagedAgentExe -Force
Copy-Item -LiteralPath (Join-Path $goProjectDir 'nimvo.ico') -Destination $stagedTrayIcon -Force
Copy-Item -LiteralPath (Join-Path $goProjectDir 'nimvo-logo.png') -Destination $stagedLogoPng -Force
Copy-Item -LiteralPath (Join-Path $scriptRoot 'install-agent.ps1') -Destination $stagedWizardScript -Force

$targetName = $installerPath
$sourceRoot = $resolvedStagingDir + '\'

$sedContent = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=Pacote extraido. Siga a janela de instalacao do agente.
TargetName=$targetName
FriendlyName=Nimvo Fiscal Agent Setup
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File install-agent.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="nimvo-fiscal-agent.exe"
FILE1="nimvo.ico"
FILE2="nimvo-logo.png"
FILE3="install-agent.ps1"
[SourceFiles]
SourceFiles0=$sourceRoot
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
"@

Set-Content -LiteralPath $sedPath -Value $sedContent -Encoding ASCII

Write-Step "Gerando instalador com IExpress"
& $iexpressPath /N $sedPath | Out-Null

if (-not (Test-Path -LiteralPath $installerPath)) {
    throw "O instalador nao foi gerado em: $installerPath"
}

if (-not $KeepBuildFiles) {
    Remove-Item -LiteralPath $BuildRoot -Recurse -Force
}

Write-Step "Instalador gerado em: $installerPath"
Write-Step "Binario do agente atualizado em: $resolvedAgentBinaryPath"

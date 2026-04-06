[CmdletBinding()]
param(
    [string]$SeedConfigPath,
    [string]$OutputDir = (Join-Path $PSScriptRoot 'dist'),
    [string]$BuildRoot = (Join-Path $PSScriptRoot 'build'),
    [string]$AgentBinaryPath = (Join-Path $PSScriptRoot 'bin\nimvo-fiscal-agent.exe'),
    [string]$InstallerName = 'nimvo-fiscal-agent-setup.exe',
    [switch]$KeepBuildFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

$goProjectDir = Join-Path $PSScriptRoot 'go-agent'
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

if ([string]::IsNullOrWhiteSpace($SeedConfigPath)) {
    $SeedConfigPath = Join-Path $PSScriptRoot 'config.example.json'
}

$resolvedSeedConfig = (Resolve-Path -LiteralPath $SeedConfigPath).Path

if (-not (Test-Path -LiteralPath $resolvedSeedConfig)) {
    throw "Arquivo de configuracao base nao encontrado: $SeedConfigPath"
}

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
$stagedSeedConfig = Join-Path $resolvedStagingDir 'agent.seed.json'
$stagedInstallScript = Join-Path $resolvedStagingDir 'install-agent.cmd'

Copy-Item -LiteralPath $resolvedAgentBinaryPath -Destination $stagedAgentExe -Force
Copy-Item -LiteralPath $resolvedSeedConfig -Destination $stagedSeedConfig -Force

$installScript = @'
@echo off
setlocal
if /I not "%~1"=="--interactive" (
  start "Nimvo Fiscal Agent Setup" cmd.exe /k ""%~f0" --interactive"
  exit /b 0
)
title Nimvo Fiscal Agent Setup
echo ========================================
echo Nimvo Fiscal Agent Setup
echo ========================================
echo.
echo O instalador vai validar o JSON do agente e pedir os dados locais da maquina.
echo Ele pode pedir a pasta raiz do Nimvo se nao conseguir localizar o arquivo artisan.
echo.
"%~dp0nimvo-fiscal-agent.exe" install -config "%~dp0agent.seed.json"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo A instalacao falhou com codigo %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)
echo Instalacao concluida com sucesso.
pause
'@

Set-Content -LiteralPath $stagedInstallScript -Value $installScript -Encoding ASCII

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
AppLaunched=cmd.exe /c install-agent.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="nimvo-fiscal-agent.exe"
FILE1="agent.seed.json"
FILE2="install-agent.cmd"
[SourceFiles]
SourceFiles0=$sourceRoot
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
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

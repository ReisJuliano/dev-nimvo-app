[CmdletBinding()]
param(
    [string]$OutputDir,
    [string]$BuildRoot,
    [string]$AgentBinaryPath,
    [string]$InstallerName = 'nimvo-fiscal-agent-setup.exe',
    [string]$InnoCompilerPath,
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

function Resolve-ExistingPath {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Arquivo nao encontrado: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Resolve-InnoCompiler {
    param([string]$RequestedPath)

    $candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        $candidates.Add([System.IO.Path]::GetFullPath($RequestedPath))
    }

    try {
        $command = Get-Command ISCC.exe -ErrorAction Stop
        if (-not [string]::IsNullOrWhiteSpace($command.Source)) {
            $candidates.Add($command.Source)
        }
    }
    catch {
    }

    foreach ($knownPath in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
        'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
        'C:\Program Files\Inno Setup 6\ISCC.exe'
    )) {
        $candidates.Add($knownPath)
    }

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'ISCC.exe nao foi encontrado. Instale o Inno Setup 6 para gerar o instalador profissional do Nimvo Fiscal Agent.'
}

function Get-InstallerVersion {
    $timestamp = Get-Date -Format 'yyyy.MM.dd.HHmm'
    try {
        $revision = (& git -C $scriptRoot rev-parse --short HEAD 2>$null | Select-Object -First 1).Trim()
        if (-not [string]::IsNullOrWhiteSpace($revision)) {
            return "$timestamp-$revision"
        }
    }
    catch {
    }

    return $timestamp
}

$goProjectDir = Join-Path $scriptRoot 'go-agent'
$installerScriptPath = Join-Path $scriptRoot 'installer.iss'
$agentIconPath = Join-Path $goProjectDir 'nimvo.ico'
$agentLogoPath = Join-Path $goProjectDir 'nimvo-logo.png'
$installMarkerPath = Join-Path $scriptRoot 'installer-marker.txt'

if (-not (Test-Path -LiteralPath $goProjectDir)) {
    throw "Pasta do agente Go nao encontrada: $goProjectDir"
}

$resolvedInstallerScriptPath = Resolve-ExistingPath -Path $installerScriptPath
$resolvedAgentIconPath = Resolve-ExistingPath -Path $agentIconPath
$resolvedAgentLogoPath = Resolve-ExistingPath -Path $agentLogoPath
$resolvedInstallMarkerPath = Resolve-ExistingPath -Path $installMarkerPath
$resolvedInnoCompilerPath = Resolve-InnoCompiler -RequestedPath $InnoCompilerPath
$goCommand = Get-Command go -ErrorAction Stop

New-Item -ItemType Directory -Path (Split-Path -Parent $AgentBinaryPath) -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
New-CleanDirectory -Path $BuildRoot

$resolvedOutputDir = (Resolve-Path -LiteralPath $OutputDir).Path
$resolvedBuildRoot = (Resolve-Path -LiteralPath $BuildRoot).Path
$resolvedAgentBinaryDir = (Resolve-Path -LiteralPath (Split-Path -Parent $AgentBinaryPath)).Path
$resolvedAgentBinaryPath = Join-Path $resolvedAgentBinaryDir (Split-Path -Leaf $AgentBinaryPath)
$compiledAgentBinaryPath = Join-Path $resolvedBuildRoot 'nimvo-fiscal-agent.exe'
$installerBaseName = [System.IO.Path]::GetFileNameWithoutExtension($InstallerName)
$installerPath = Join-Path $resolvedOutputDir $InstallerName
$compileLogPath = Join-Path $resolvedBuildRoot 'iscc-build.log'
$appVersion = Get-InstallerVersion

Write-Step 'Compilando nimvo-fiscal-agent.exe'
Push-Location $goProjectDir
try {
    & $goCommand.Source build -o $compiledAgentBinaryPath .
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao compilar nimvo-fiscal-agent.exe com Go (codigo $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}

$compiledAgentBinaryPath = Resolve-ExistingPath -Path $compiledAgentBinaryPath
$agentBinarySynced = $false
try {
    Copy-Item -LiteralPath $compiledAgentBinaryPath -Destination $resolvedAgentBinaryPath -Force
    $agentBinarySynced = $true
}
catch {
    Write-Warning "Nao foi possivel atualizar o binario em $resolvedAgentBinaryPath. O setup sera gerado com o binario novo compilado em $compiledAgentBinaryPath."
}

$isccArguments = @(
    "/DAppVersion=$appVersion",
    "/DOutputDir=$resolvedOutputDir",
    "/DInstallerBaseName=$installerBaseName",
    "/DAgentBinary=$compiledAgentBinaryPath",
    "/DAgentIcon=$resolvedAgentIconPath",
    "/DAgentLogo=$resolvedAgentLogoPath",
    "/DInstallMarker=$resolvedInstallMarkerPath",
    "/DSetupIconFile=$resolvedAgentIconPath",
    $resolvedInstallerScriptPath
)

Write-Step "Gerando instalador profissional com Inno Setup"
& $resolvedInnoCompilerPath @isccArguments *>&1 | Tee-Object -FilePath $compileLogPath

if (-not (Test-Path -LiteralPath $installerPath)) {
    throw "O instalador nao foi gerado em: $installerPath"
}

if (-not $KeepBuildFiles -and $agentBinarySynced) {
    Remove-Item -LiteralPath $BuildRoot -Recurse -Force
} elseif (-not $KeepBuildFiles -and -not $agentBinarySynced) {
    Write-Warning "Os arquivos temporarios de build foram preservados em $resolvedBuildRoot porque o binario final nao pode ser sincronizado no destino padrao."
}

Write-Step "Instalador gerado em: $installerPath"
if ($agentBinarySynced) {
    Write-Step "Binario do agente atualizado em: $resolvedAgentBinaryPath"
} else {
    Write-Step "Binario usado no setup: $compiledAgentBinaryPath"
}

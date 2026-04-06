$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExePath = Join-Path $AppRoot 'nimvo-fiscal-agent.exe'
$LogoPath = Join-Path $AppRoot 'nimvo-logo.png'

function Get-DefaultPreviewOutputPath {
    $documents = [Environment]::GetFolderPath('MyDocuments')
    if ([string]::IsNullOrWhiteSpace($documents)) {
        $documents = Join-Path $env:USERPROFILE 'Documents'
    }

    return Join-Path $documents 'NimvoFiscalAgent\prints'
}

function Get-UnsupportedPrinterReason([string] $name) {
    if ($null -eq $name) {
        $name = ''
    }
    $normalized = $name.Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($normalized)) { return '' }
    if ($normalized.Contains('print to pdf') -or $normalized.Contains('adobe pdf') -or $normalized.Contains('pdf24') -or $normalized.Contains('bullzip pdf')) { return 'gera arquivos PDF em vez de receber comandos ESC/POS brutos' }
    if ($normalized.Contains('xps')) { return 'gera documentos XPS em vez de receber comandos ESC/POS brutos' }
    if ($normalized.Contains('onenote')) { return 'redireciona a impressao para o OneNote' }
    if ($normalized -eq 'fax' -or $normalized.Contains(' fax')) { return 'envia fax e nao interpreta comandos ESC/POS' }
    if ($normalized.Contains('anydesk printer') -or $normalized.Contains('rustdesk printer')) { return 'e uma impressora virtual de acesso remoto' }
    return ''
}

function Get-InstalledPrinters {
    try {
        $printers = Get-Printer | Select-Object -ExpandProperty Name
    } catch {
        return @()
    }

    return @(
        $printers |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Where-Object { [string]::IsNullOrWhiteSpace((Get-UnsupportedPrinterReason $_)) } |
            Sort-Object -Unique
    )
}

function Quote-ProcessArgument([string] $value) {
    if ($null -eq $value) {
        $value = ''
    }

    return '"' + ($value -replace '"', '\"') + '"'
}

function Invoke-AgentInstall {
    param(
        [Parameter(Mandatory = $true)] [hashtable] $SeedConfig,
        [Parameter(Mandatory = $true)] [string] $ActivationCode
    )

    $tempConfigPath = Join-Path ([System.IO.Path]::GetTempPath()) ("nimvo-agent-install-" + [guid]::NewGuid().ToString('N') + '.json')

    try {
        $SeedConfig | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $tempConfigPath -Encoding ASCII

        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = $ExePath
        $processInfo.Arguments = @(
            'install'
            '--non-interactive'
            '--seed-config'
            (Quote-ProcessArgument $tempConfigPath)
            '--activation-code'
            (Quote-ProcessArgument $ActivationCode)
        ) -join ' '
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        $processInfo.CreateNoWindow = $true
        $processInfo.WorkingDirectory = $AppRoot

        $process = [System.Diagnostics.Process]::Start($processInfo)
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StdOut = $stdout.Trim()
            StdErr = $stderr.Trim()
        }
    }
    finally {
        Remove-Item -LiteralPath $tempConfigPath -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path -LiteralPath $ExePath)) {
    [System.Windows.Forms.MessageBox]::Show(
        "O binario nimvo-fiscal-agent.exe nao foi encontrado no pacote extraido.",
        'Nimvo Fiscal Agent Setup',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Nimvo Fiscal Agent Setup'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(920, 620)
$form.MinimumSize = New-Object System.Drawing.Size(920, 620)
$form.MaximumSize = New-Object System.Drawing.Size(920, 620)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$sidebar = New-Object System.Windows.Forms.Panel
$sidebar.Size = New-Object System.Drawing.Size(250, 620)
$sidebar.Dock = 'Left'
$sidebar.BackColor = [System.Drawing.Color]::FromArgb(246, 247, 249)
$form.Controls.Add($sidebar)

$headerLogo = New-Object System.Windows.Forms.PictureBox
$headerLogo.Location = New-Object System.Drawing.Point(26, 24)
$headerLogo.Size = New-Object System.Drawing.Size(198, 110)
$headerLogo.SizeMode = 'Zoom'
if (Test-Path -LiteralPath $LogoPath) {
    $headerLogo.Image = [System.Drawing.Image]::FromFile($LogoPath)
}
$sidebar.Controls.Add($headerLogo)

$sidebarTitle = New-Object System.Windows.Forms.Label
$sidebarTitle.Text = 'Nimvo Fiscal Agent'
$sidebarTitle.Location = New-Object System.Drawing.Point(26, 142)
$sidebarTitle.Size = New-Object System.Drawing.Size(198, 28)
$sidebarTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 15)
$sidebarTitle.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$sidebar.Controls.Add($sidebarTitle)

$sidebarSubtitle = New-Object System.Windows.Forms.Label
$sidebarSubtitle.Text = 'Instalador guiado com configuracao central, impressao local e preview em PDF.'
$sidebarSubtitle.Location = New-Object System.Drawing.Point(26, 176)
$sidebarSubtitle.Size = New-Object System.Drawing.Size(198, 60)
$sidebarSubtitle.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$sidebarSubtitle.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$sidebar.Controls.Add($sidebarSubtitle)

$stepLabels = @()
$stepTexts = @('Conexao', 'Impressao', 'Resumo')
for ($index = 0; $index -lt $stepTexts.Count; $index++) {
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point(20, 270 + ($index * 64))
    $panel.Size = New-Object System.Drawing.Size(210, 48)
    $panel.BackColor = [System.Drawing.Color]::Transparent
    $sidebar.Controls.Add($panel)

    $badge = New-Object System.Windows.Forms.Label
    $badge.Text = [string]($index + 1)
    $badge.TextAlign = 'MiddleCenter'
    $badge.Location = New-Object System.Drawing.Point(0, 4)
    $badge.Size = New-Object System.Drawing.Size(36, 36)
    $badge.BackColor = [System.Drawing.Color]::White
    $badge.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
    $badge.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
    $panel.Controls.Add($badge)

    $label = New-Object System.Windows.Forms.Label
    $label.Text = $stepTexts[$index]
    $label.Location = New-Object System.Drawing.Point(48, 9)
    $label.Size = New-Object System.Drawing.Size(150, 28)
    $label.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
    $label.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
    $panel.Controls.Add($label)

    $stepLabels += [pscustomobject]@{
        Panel = $panel
        Badge = $badge
        Label = $label
    }
}

$content = New-Object System.Windows.Forms.Panel
$content.Dock = 'Fill'
$content.BackColor = [System.Drawing.Color]::White
$form.Controls.Add($content)

$title = New-Object System.Windows.Forms.Label
$title.Location = New-Object System.Drawing.Point(36, 28)
$title.Size = New-Object System.Drawing.Size(560, 34)
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 20)
$title.ForeColor = [System.Drawing.Color]::FromArgb(17, 24, 39)
$content.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Location = New-Object System.Drawing.Point(38, 68)
$subtitle.Size = New-Object System.Drawing.Size(590, 42)
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$content.Controls.Add($subtitle)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Location = New-Object System.Drawing.Point(38, 506)
$statusLabel.Size = New-Object System.Drawing.Size(520, 38)
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
$content.Controls.Add($statusLabel)

$buttonBack = New-Object System.Windows.Forms.Button
$buttonBack.Text = 'Voltar'
$buttonBack.Size = New-Object System.Drawing.Size(110, 38)
$buttonBack.Location = New-Object System.Drawing.Point(486, 548)
$buttonBack.FlatStyle = 'Flat'
$buttonBack.BackColor = [System.Drawing.Color]::White
$buttonBack.ForeColor = [System.Drawing.Color]::FromArgb(55, 65, 81)
$buttonBack.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(209, 213, 219)
$content.Controls.Add($buttonBack)

$buttonNext = New-Object System.Windows.Forms.Button
$buttonNext.Text = 'Avancar'
$buttonNext.Size = New-Object System.Drawing.Size(110, 38)
$buttonNext.Location = New-Object System.Drawing.Point(608, 548)
$buttonNext.FlatStyle = 'Flat'
$buttonNext.BackColor = [System.Drawing.Color]::FromArgb(17, 24, 39)
$buttonNext.ForeColor = [System.Drawing.Color]::White
$buttonNext.FlatAppearance.BorderSize = 0
$content.Controls.Add($buttonNext)

$buttonCancel = New-Object System.Windows.Forms.Button
$buttonCancel.Text = 'Cancelar'
$buttonCancel.Size = New-Object System.Drawing.Size(110, 38)
$buttonCancel.Location = New-Object System.Drawing.Point(730, 548)
$buttonCancel.FlatStyle = 'Flat'
$buttonCancel.BackColor = [System.Drawing.Color]::White
$buttonCancel.ForeColor = [System.Drawing.Color]::FromArgb(55, 65, 81)
$buttonCancel.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(209, 213, 219)
$content.Controls.Add($buttonCancel)

$panels = @()
for ($index = 0; $index -lt 3; $index++) {
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point(36, 126)
    $panel.Size = New-Object System.Drawing.Size(804, 360)
    $panel.BackColor = [System.Drawing.Color]::White
    $panel.Visible = $false
    $content.Controls.Add($panel)
    $panels += $panel
}

$stepOne = $panels[0]
$stepTwo = $panels[1]
$stepThree = $panels[2]

function New-FieldLabel([string] $text, [int] $x, [int] $y, [int] $width = 300) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $text
    $label.Location = New-Object System.Drawing.Point($x, $y)
    $label.Size = New-Object System.Drawing.Size($width, 24)
    $label.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
    $label.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
    return $label
}

function New-TextInput([int] $x, [int] $y, [int] $width = 420) {
    $input = New-Object System.Windows.Forms.TextBox
    $input.Location = New-Object System.Drawing.Point($x, $y)
    $input.Size = New-Object System.Drawing.Size($width, 32)
    $input.BorderStyle = 'FixedSingle'
    return $input
}

$labelBackend = New-FieldLabel 'URL do backend do Nimvo' 0 6 420
$stepOne.Controls.Add($labelBackend)
$inputBackend = New-TextInput 0 34 520
$inputBackend.Text = 'https://admin.nimvo.com.br'
$stepOne.Controls.Add($inputBackend)

$labelActivation = New-FieldLabel 'Codigo de ativacao do tenant' 0 88 420
$stepOne.Controls.Add($labelActivation)
$inputActivation = New-TextInput 0 116 320
$stepOne.Controls.Add($inputActivation)

$labelPolling = New-FieldLabel 'Polling em segundos' 0 170 220
$stepOne.Controls.Add($labelPolling)
$inputPolling = New-Object System.Windows.Forms.NumericUpDown
$inputPolling.Location = New-Object System.Drawing.Point(0, 198)
$inputPolling.Size = New-Object System.Drawing.Size(120, 32)
$inputPolling.Minimum = 1
$inputPolling.Maximum = 30
$inputPolling.Value = 3
$stepOne.Controls.Add($inputPolling)

$stepOneNote = New-Object System.Windows.Forms.Label
$stepOneNote.Text = 'Use 3 segundos para equilibrar resposta rapida e baixo trafego. A ativacao continua sendo feita no dominio central.'
$stepOneNote.Location = New-Object System.Drawing.Point(0, 248)
$stepOneNote.Size = New-Object System.Drawing.Size(620, 54)
$stepOneNote.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$stepOneNote.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$stepOne.Controls.Add($stepOneNote)

$checkEnablePrinter = New-Object System.Windows.Forms.CheckBox
$checkEnablePrinter.Text = 'Ativar impressao automatica do cupom'
$checkEnablePrinter.Location = New-Object System.Drawing.Point(0, 6)
$checkEnablePrinter.Size = New-Object System.Drawing.Size(320, 28)
$checkEnablePrinter.Checked = $true
$stepTwo.Controls.Add($checkEnablePrinter)

$labelConnector = New-FieldLabel 'Conector da impressora' 0 48 260
$stepTwo.Controls.Add($labelConnector)
$comboConnector = New-Object System.Windows.Forms.ComboBox
$comboConnector.Location = New-Object System.Drawing.Point(0, 76)
$comboConnector.Size = New-Object System.Drawing.Size(240, 32)
$comboConnector.DropDownStyle = 'DropDownList'
[void]$comboConnector.Items.Add('pdf')
[void]$comboConnector.Items.Add('windows')
[void]$comboConnector.Items.Add('tcp')
$stepTwo.Controls.Add($comboConnector)

$connectorHint = New-Object System.Windows.Forms.Label
$connectorHint.Location = New-Object System.Drawing.Point(260, 74)
$connectorHint.Size = New-Object System.Drawing.Size(500, 40)
$connectorHint.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$connectorHint.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$stepTwo.Controls.Add($connectorHint)

$labelPrinters = New-FieldLabel 'Impressora do Windows' 0 132 260
$stepTwo.Controls.Add($labelPrinters)
$comboPrinters = New-Object System.Windows.Forms.ComboBox
$comboPrinters.Location = New-Object System.Drawing.Point(0, 160)
$comboPrinters.Size = New-Object System.Drawing.Size(520, 32)
$comboPrinters.DropDownStyle = 'DropDownList'
$stepTwo.Controls.Add($comboPrinters)

$buttonRefreshPrinters = New-Object System.Windows.Forms.Button
$buttonRefreshPrinters.Text = 'Atualizar'
$buttonRefreshPrinters.Location = New-Object System.Drawing.Point(534, 158)
$buttonRefreshPrinters.Size = New-Object System.Drawing.Size(110, 34)
$buttonRefreshPrinters.FlatStyle = 'Flat'
$buttonRefreshPrinters.BackColor = [System.Drawing.Color]::White
$buttonRefreshPrinters.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(209, 213, 219)
$stepTwo.Controls.Add($buttonRefreshPrinters)

$printerHint = New-Object System.Windows.Forms.Label
$printerHint.Location = New-Object System.Drawing.Point(0, 202)
$printerHint.Size = New-Object System.Drawing.Size(660, 38)
$printerHint.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$printerHint.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$stepTwo.Controls.Add($printerHint)

$labelTcpHost = New-FieldLabel 'IP ou hostname da impressora' 0 132 260
$stepTwo.Controls.Add($labelTcpHost)
$inputTcpHost = New-TextInput 0 160 280
$inputTcpHost.Text = '127.0.0.1'
$stepTwo.Controls.Add($inputTcpHost)

$labelTcpPort = New-FieldLabel 'Porta TCP' 300 132 180
$stepTwo.Controls.Add($labelTcpPort)
$inputTcpPort = New-Object System.Windows.Forms.NumericUpDown
$inputTcpPort.Location = New-Object System.Drawing.Point(300, 160)
$inputTcpPort.Size = New-Object System.Drawing.Size(120, 32)
$inputTcpPort.Minimum = 1
$inputTcpPort.Maximum = 65535
$inputTcpPort.Value = 9100
$stepTwo.Controls.Add($inputTcpPort)

$pdfHint = New-Object System.Windows.Forms.Label
$pdfHint.Location = New-Object System.Drawing.Point(0, 132)
$pdfHint.Size = New-Object System.Drawing.Size(680, 72)
$pdfHint.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$pdfHint.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$stepTwo.Controls.Add($pdfHint)

$summaryBox = New-Object System.Windows.Forms.TextBox
$summaryBox.Location = New-Object System.Drawing.Point(0, 0)
$summaryBox.Size = New-Object System.Drawing.Size(760, 320)
$summaryBox.Multiline = $true
$summaryBox.ReadOnly = $true
$summaryBox.ScrollBars = 'Vertical'
$summaryBox.BackColor = [System.Drawing.Color]::FromArgb(249, 250, 251)
$summaryBox.BorderStyle = 'FixedSingle'
$summaryBox.Font = New-Object System.Drawing.Font('Consolas', 10)
$stepThree.Controls.Add($summaryBox)

$summaryNote = New-Object System.Windows.Forms.Label
$summaryNote.Text = 'Ao clicar em Instalar, o agente sera copiado para AppData\\Local\\NimvoFiscalAgent, configurado no registro do Windows e iniciado em segundo plano.'
$summaryNote.Location = New-Object System.Drawing.Point(0, 330)
$summaryNote.Size = New-Object System.Drawing.Size(760, 36)
$summaryNote.ForeColor = [System.Drawing.Color]::FromArgb(75, 85, 99)
$summaryNote.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$stepThree.Controls.Add($summaryNote)

$supportedPrinters = New-Object System.Collections.Generic.List[string]

function Refresh-Printers {
    $comboPrinters.Items.Clear()
    $supportedPrinters.Clear()

    foreach ($printer in Get-InstalledPrinters) {
        $supportedPrinters.Add($printer)
        [void]$comboPrinters.Items.Add($printer)
    }

    if ($comboPrinters.Items.Count -gt 0) {
        $comboPrinters.SelectedIndex = 0
        $printerHint.Text = 'Foram listadas apenas impressoras compativeis com o conector Windows do Nimvo.'
    } else {
        $printerHint.Text = 'Nenhuma impressora Windows compativel foi encontrada. Use PDF para testes ou TCP para impressora de rede.'
    }
}

function Update-ConnectorUI {
    $printingEnabled = $checkEnablePrinter.Checked
    $connector = [string]$comboConnector.SelectedItem
    if ([string]::IsNullOrWhiteSpace($connector)) {
        $connector = 'pdf'
    }

    $labelConnector.Visible = $printingEnabled
    $comboConnector.Visible = $printingEnabled
    $connectorHint.Visible = $printingEnabled

    $showWindows = $printingEnabled -and $connector -eq 'windows'
    $showTcp = $printingEnabled -and $connector -eq 'tcp'
    $showPdf = $printingEnabled -and $connector -eq 'pdf'

    $labelPrinters.Visible = $showWindows
    $comboPrinters.Visible = $showWindows
    $buttonRefreshPrinters.Visible = $showWindows
    $printerHint.Visible = $showWindows

    $labelTcpHost.Visible = $showTcp
    $inputTcpHost.Visible = $showTcp
    $labelTcpPort.Visible = $showTcp
    $inputTcpPort.Visible = $showTcp

    $pdfHint.Visible = $showPdf

    switch ($connector) {
        'windows' {
            $connectorHint.Text = 'Use este modo quando voce tiver uma impressora termica local compativel com impressao RAW/ESC POS.'
        }
        'tcp' {
            $connectorHint.Text = 'Use este modo para impressoras termicas de rede, informando IP/hostname e porta.'
        }
        default {
            $connectorHint.Text = 'Use PDF para testar o layout do cupom sem uma impressora termica fisica.'
            $pdfHint.Text = "Os cupons de exemplo serao gerados em: $(Get-DefaultPreviewOutputPath)`r`nEsse modo e ideal para validar o visual do cupom antes de conectar a impressora termica."
        }
    }
}

function Build-Summary {
    $connector = [string]$comboConnector.SelectedItem
    if ([string]::IsNullOrWhiteSpace($connector)) { $connector = 'pdf' }
    $printerEnabled = $checkEnablePrinter.Checked
    $target = 'Desativada'

    if ($printerEnabled) {
        switch ($connector) {
            'windows' { $target = [string]$comboPrinters.SelectedItem }
            'tcp' { $target = "$($inputTcpHost.Text.Trim()):$($inputTcpPort.Value)" }
            'pdf' { $target = Get-DefaultPreviewOutputPath }
        }
    }

    $summaryBox.Text = @(
        "Backend:      $($inputBackend.Text.Trim())"
        "Ativacao:     $($inputActivation.Text.Trim().ToUpperInvariant())"
        "Polling:      $($inputPolling.Value)s"
        "Impressao:    " + ($(if ($printerEnabled) { 'Ativada' } else { 'Desativada' }))
        "Conector:     " + ($(if ($printerEnabled) { $connector } else { '-' }))
        "Destino:      $target"
        "Logo padrao:  $LogoPath"
        "Instalacao:   $([System.IO.Path]::Combine($env:LOCALAPPDATA, 'NimvoFiscalAgent'))"
    ) -join [Environment]::NewLine
}

$currentStep = 0
function Set-Step([int] $step) {
    $script:currentStep = $step
    for ($index = 0; $index -lt $panels.Count; $index++) {
        $panels[$index].Visible = ($index -eq $step)
        $active = ($index -eq $step)
        $stepLabels[$index].Badge.BackColor = if ($active) { [System.Drawing.Color]::FromArgb(17, 24, 39) } else { [System.Drawing.Color]::White }
        $stepLabels[$index].Badge.ForeColor = if ($active) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::FromArgb(107, 114, 128) }
        $stepLabels[$index].Label.ForeColor = if ($active) { [System.Drawing.Color]::FromArgb(17, 24, 39) } else { [System.Drawing.Color]::FromArgb(107, 114, 128) }
    }

    switch ($step) {
        0 {
            $title.Text = 'Conectar o agente'
            $subtitle.Text = 'Informe o backend central do Nimvo e o codigo de ativacao do tenant para liberar as credenciais internas do agente.'
        }
        1 {
            $title.Text = 'Configurar a impressao'
            $subtitle.Text = 'Escolha entre impressora local, TCP ou PDF. O modo PDF serve para validar o layout do cupom sem impressora termica.'
        }
        2 {
            $title.Text = 'Revisar e instalar'
            $subtitle.Text = 'Confira o resumo abaixo. Quando tudo estiver certo, clique em Instalar para concluir.'
            Build-Summary
        }
    }

    $buttonBack.Enabled = $step -gt 0
    $buttonNext.Text = if ($step -eq 2) { 'Instalar' } else { 'Avancar' }
    Update-ConnectorUI
    $statusLabel.Text = ''
}

function Validate-Step([int] $step) {
    switch ($step) {
        0 {
            if ([string]::IsNullOrWhiteSpace($inputBackend.Text)) {
                $statusLabel.Text = 'Informe a URL do backend do Nimvo.'
                return $false
            }
            if ([string]::IsNullOrWhiteSpace($inputActivation.Text)) {
                $statusLabel.Text = 'Informe o codigo de ativacao do tenant.'
                return $false
            }
            return $true
        }
        1 {
            if (-not $checkEnablePrinter.Checked) {
                return $true
            }

            $connector = [string]$comboConnector.SelectedItem
            switch ($connector) {
                'windows' {
                    if ($comboPrinters.SelectedIndex -lt 0) {
                        $statusLabel.Text = 'Selecione uma impressora do Windows ou troque para PDF/TCP.'
                        return $false
                    }
                }
                'tcp' {
                    if ([string]::IsNullOrWhiteSpace($inputTcpHost.Text)) {
                        $statusLabel.Text = 'Informe o IP ou hostname da impressora TCP.'
                        return $false
                    }
                    if ([int]$inputTcpPort.Value -le 0) {
                        $statusLabel.Text = 'Informe uma porta TCP valida.'
                        return $false
                    }
                }
            }
            return $true
        }
        default {
            return $true
        }
    }
}

$buttonBack.Add_Click({
    if ($script:currentStep -gt 0) {
        Set-Step ($script:currentStep - 1)
    }
})

$buttonCancel.Add_Click({
    $form.Close()
})

$checkEnablePrinter.Add_CheckedChanged({ Update-ConnectorUI })
$comboConnector.Add_SelectedIndexChanged({ Update-ConnectorUI })
$buttonRefreshPrinters.Add_Click({
    Refresh-Printers
    Update-ConnectorUI
})

$buttonNext.Add_Click({
    if (-not (Validate-Step $script:currentStep)) {
        return
    }

    if ($script:currentStep -lt 2) {
        Set-Step ($script:currentStep + 1)
        return
    }

    $buttonBack.Enabled = $false
    $buttonNext.Enabled = $false
    $buttonCancel.Enabled = $false
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(17, 24, 39)
    $statusLabel.Text = 'Instalando o agente, aguarde...'
    $form.Refresh()

    $connector = if ($checkEnablePrinter.Checked) { [string]$comboConnector.SelectedItem } else { 'windows' }
    if ([string]::IsNullOrWhiteSpace($connector)) {
        $connector = 'pdf'
    }

    $seedConfig = @{
        backend = @{
            base_url = $inputBackend.Text.Trim()
            timeout_seconds = 30
            retry_times = 3
            retry_sleep_ms = 500
        }
        agent = @{
            key = ''
            secret = ''
            poll_interval_seconds = [int]$inputPolling.Value
        }
        certificate = @{
            path = ''
            password = ''
        }
        printer = @{
            enabled = [bool]$checkEnablePrinter.Checked
            connector = $connector
            name = ''
            host = ''
            port = 9100
            logo_path = $LogoPath
            output_path = Get-DefaultPreviewOutputPath
        }
        local_api = @{
            enabled = $true
            host = '127.0.0.1'
            port = 18123
        }
    }

    if ($checkEnablePrinter.Checked) {
        switch ($connector) {
            'windows' {
                $seedConfig.printer.name = [string]$comboPrinters.SelectedItem
            }
            'tcp' {
                $seedConfig.printer.host = $inputTcpHost.Text.Trim()
                $seedConfig.printer.port = [int]$inputTcpPort.Value
            }
        }
    }

    try {
        $result = Invoke-AgentInstall -SeedConfig $seedConfig -ActivationCode $inputActivation.Text.Trim().ToUpperInvariant()
        if ($result.ExitCode -ne 0) {
            $message = if (-not [string]::IsNullOrWhiteSpace($result.StdErr)) { $result.StdErr } elseif (-not [string]::IsNullOrWhiteSpace($result.StdOut)) { $result.StdOut } else { "A instalacao falhou com codigo $($result.ExitCode)." }
            throw $message
        }

        $successMessage = if (-not [string]::IsNullOrWhiteSpace($result.StdOut)) { $result.StdOut } else { 'Agente instalado com sucesso.' }
        [System.Windows.Forms.MessageBox]::Show(
            $successMessage,
            'Nimvo Fiscal Agent Setup',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    }
    catch {
        $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
        $statusLabel.Text = [string]$_.Exception.Message
        $buttonBack.Enabled = $true
        $buttonNext.Enabled = $true
        $buttonCancel.Enabled = $true
    }
})

Refresh-Printers
if ($supportedPrinters.Count -gt 0) {
    $comboConnector.SelectedItem = 'windows'
} else {
    $comboConnector.SelectedItem = 'pdf'
}
Set-Step 0
[void]$form.ShowDialog()

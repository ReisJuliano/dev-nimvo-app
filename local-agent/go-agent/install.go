package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const runEntryName = "NimvoFiscalAgent"

func runInstall(args []string) error {
	fs := flag.NewFlagSet("install", flag.ContinueOnError)
	installDir := fs.String("install-dir", defaultInstallDir(), "Pasta de instalacao do agente")
	enableStartup := fs.Bool("startup", true, "Registrar o agente para iniciar com o Windows")
	startNow := fs.Bool("start", true, "Iniciar o agente apos instalar")
	seedConfigPath := fs.String("seed-config", "", "Arquivo JSON com a configuracao inicial do instalador")
	activationCode := fs.String("activation-code", "", "Codigo de ativacao do tenant")
	projectRoot := fs.String("project-root", "", "Raiz local do projeto Laravel para emissao fiscal via ponte PHP")
	phpPath := fs.String("php-path", "", "Executavel do PHP usado pela ponte fiscal local")
	nonInteractive := fs.Bool("non-interactive", false, "Executa a instalacao sem perguntas na tela")

	if err := fs.Parse(args); err != nil {
		return err
	}

	installRoot, err := filepath.Abs(*installDir)
	if err != nil {
		return err
	}

	currentExe, err := os.Executable()
	if err != nil {
		return err
	}

	sourceDir := filepath.Dir(currentExe)
	targetExe := filepath.Join(installRoot, "bin", "nimvo-fiscal-agent.exe")
	targetBridgeRoot := filepath.Join(installRoot, "bridge")
	targetLog := filepath.Join(installRoot, "logs", "agent.log")
	targetIcon := filepath.Join(installRoot, "assets", "nimvo.ico")
	targetLogo := filepath.Join(installRoot, "assets", "nimvo-logo.png")
	targetRunCmd := filepath.Join(installRoot, "run-agent.cmd")
	targetRunVbs := filepath.Join(installRoot, "run-agent.vbs")
	targetOpenAppCmd := filepath.Join(installRoot, "open-nimvo-app.cmd")
	targetOpenAppVbs := filepath.Join(installRoot, "open-nimvo-app.vbs")
	targetUninstall := filepath.Join(installRoot, "uninstall-agent.cmd")
	targetReadme := filepath.Join(installRoot, "README.txt")

	for _, directory := range []string{
		filepath.Join(installRoot, "bin"),
		filepath.Join(installRoot, "bridge"),
		filepath.Join(installRoot, "logs"),
		filepath.Join(installRoot, "assets"),
	} {
		if err := ensureDir(directory); err != nil {
			return err
		}
	}

	if err := replaceInstalledExecutable(currentExe, targetExe); err != nil {
		return err
	}

	if sourceIcon := filepath.Join(sourceDir, "nimvo.ico"); fileExists(sourceIcon) {
		if err := copyFile(sourceIcon, targetIcon); err != nil {
			return err
		}
	}

	if sourceLogo := filepath.Join(sourceDir, "nimvo-logo.png"); fileExists(sourceLogo) {
		if err := copyFile(sourceLogo, targetLogo); err != nil {
			return err
		}
	}

	config := defaultAgentConfig()
	if strings.TrimSpace(*seedConfigPath) != "" {
		config, err = loadAgentConfig(strings.TrimSpace(*seedConfigPath))
		if err != nil {
			return fmt.Errorf("nao foi possivel carregar a configuracao inicial do instalador: %w", err)
		}
	}

	if strings.TrimSpace(*projectRoot) != "" {
		config.Software.ProjectRoot = strings.TrimSpace(*projectRoot)
	}

	if strings.TrimSpace(*phpPath) != "" {
		config.Software.PHPPath = strings.TrimSpace(*phpPath)
	}

	if bridgeRoot, err := installBundledFiscalBridge(sourceDir, targetBridgeRoot); err != nil {
		return err
	} else if strings.TrimSpace(bridgeRoot) != "" {
		config.Software.BridgeRoot = bridgeRoot
	}

	config, err = completeInstallationConfig(
		config,
		targetLogo,
		strings.TrimSpace(*activationCode),
		!*nonInteractive,
	)
	if err != nil {
		return err
	}

	if err := saveInstalledAgentConfig(config); err != nil {
		return err
	}

	if err := os.WriteFile(targetRunCmd, []byte(buildRunScript(targetExe, targetLog)), 0o644); err != nil {
		return err
	}

	if err := os.WriteFile(targetRunVbs, []byte(buildVBSScript()), 0o644); err != nil {
		return err
	}

	if strings.TrimSpace(config.TenantApp.BaseURL) != "" {
		if err := os.WriteFile(targetOpenAppCmd, []byte(buildOpenAppScript(config.TenantApp.BaseURL)), 0o644); err != nil {
			return err
		}

		if err := os.WriteFile(targetOpenAppVbs, []byte(buildLauncherVBSScript(targetOpenAppCmd)), 0o644); err != nil {
			return err
		}

		if err := installAppLaunchers(targetOpenAppVbs); err != nil {
			return err
		}
	}

	if err := os.WriteFile(targetUninstall, []byte(buildUninstallScript(targetExe, installRoot)), 0o644); err != nil {
		return err
	}

	if err := os.WriteFile(targetReadme, []byte(buildReadme(installRoot)), 0o644); err != nil {
		return err
	}

	if *enableStartup {
		if err := setStartupEntry(targetRunVbs); err != nil {
			return err
		}
	} else if err := removeStartupEntry(); err != nil {
		return err
	}

	if *startNow {
		if err := launchAgent(targetRunVbs); err != nil {
			return err
		}
	}

	summary := map[string]string{
		"install_dir":                     installRoot,
		"config_storage":                  "registry://HKCU/Software/NimvoFiscalAgent",
		"log":                             targetLog,
		"startup":                         fmt.Sprintf("%t", *enableStartup),
		"local_api_url":                   localAPIBaseURL(config),
		"printer_target":                  printerTarget(config.Printer),
		"logo_path":                       strings.TrimSpace(config.Printer.LogoPath),
		"backend_baseurl":                 strings.TrimSpace(config.Backend.BaseURL),
		"tenant_app_baseurl":              strings.TrimSpace(config.TenantApp.BaseURL),
		"certificate_path":                strings.TrimSpace(config.Certificate.Path),
		"certificate_password_configured": fmt.Sprintf("%t", strings.TrimSpace(config.Certificate.Password) != ""),
		"software_bridge_root":            strings.TrimSpace(resolveBundledFiscalBridgeRoot(config)),
		"software_project_root":           strings.TrimSpace(config.Software.ProjectRoot),
		"software_php_path":               strings.TrimSpace(config.Software.PHPPath),
		"fiscal_bridge_enabled":           fmt.Sprintf("%t", fiscalBridgeAvailable(config)),
	}

	payload, _ := json.MarshalIndent(summary, "", "  ")
	fmt.Println("Agente instalado com sucesso.")
	fmt.Println(string(payload))
	fmt.Println("O agente foi configurado na propria maquina e fica pronto para rodar em segundo plano, sem depender de pasta local do projeto.")

	return nil
}

func runStatus(args []string) error {
	fs := flag.NewFlagSet("status", flag.ContinueOnError)
	installDir := fs.String("install-dir", defaultInstallDir(), "Pasta de instalacao do agente")

	if err := fs.Parse(args); err != nil {
		return err
	}

	installRoot, err := filepath.Abs(*installDir)
	if err != nil {
		return err
	}

	runValue, startupEnabled := readStartupEntry()
	status := map[string]any{
		"install_dir":         installRoot,
		"installed":           fileExists(filepath.Join(installRoot, "bin", "nimvo-fiscal-agent.exe")),
		"log_exists":          fileExists(filepath.Join(installRoot, "logs", "agent.log")),
		"startup_enabled":     startupEnabled,
		"startup_command":     runValue,
		"run_script_exists":   fileExists(filepath.Join(installRoot, "run-agent.cmd")),
		"registry_configured": false,
	}

	if config, err := loadInstalledAgentConfig(); err == nil {
		status["registry_configured"] = true
		status["backend_baseurl"] = strings.TrimSpace(config.Backend.BaseURL)
		status["certificate_path"] = strings.TrimSpace(config.Certificate.Path)
		status["certificate_configured"] = strings.TrimSpace(config.Certificate.Path) != ""
		status["printer_target"] = printerTarget(config.Printer)
		status["local_api_url"] = localAPIBaseURL(config)
		status["local_api_enabled"] = config.LocalAPI.Enabled
		status["tenant_app_baseurl"] = strings.TrimSpace(config.TenantApp.BaseURL)
		status["software_bridge_root"] = strings.TrimSpace(resolveBundledFiscalBridgeRoot(config))
		status["software_project_root"] = strings.TrimSpace(config.Software.ProjectRoot)
		status["software_php_path"] = strings.TrimSpace(config.Software.PHPPath)
		status["fiscal_bridge_enabled"] = fiscalBridgeAvailable(config)
		status["supported_types"] = supportedCommandTypesForConfig(config)
		status["app_launcher_installed"] = installedAppLaunchersExist()
	}

	payload, _ := json.MarshalIndent(status, "", "  ")
	fmt.Println(string(payload))

	return nil
}

func runUninstall(args []string) error {
	fs := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	installDir := fs.String("install-dir", defaultInstallDir(), "Pasta de instalacao do agente")
	purge := fs.Bool("purge", false, "Remove tambem os arquivos instalados do agente")
	cleanupSelf := fs.Bool("cleanup-self", false, "Uso interno para limpar o helper temporario de desinstalacao")

	if err := fs.Parse(args); err != nil {
		return err
	}

	installRoot, err := filepath.Abs(*installDir)
	if err != nil {
		return err
	}

	if err := removeInstalledAgentArtifacts(); err != nil {
		return err
	}

	if !*purge {
		fmt.Println("Inicializacao automatica e configuracao local removidas com sucesso.")
		fmt.Printf("Se quiser apagar os arquivos do agente, remova a pasta: %s\n", installRoot)

		return nil
	}

	if uninstallNeedsHelper(installRoot) {
		if err := launchUninstallHelper(installRoot); err != nil {
			return err
		}

		fmt.Println("Desinstalacao completa agendada em segundo plano.")

		return nil
	}

	if err := purgeInstallRoot(installRoot); err != nil {
		return err
	}

	if *cleanupSelf {
		if err := scheduleHelperSelfCleanup(); err != nil {
			return err
		}
	}

	fmt.Printf("Agente removido com sucesso de: %s\n", installRoot)

	return nil
}

func removeInstalledAgentArtifacts() error {
	if err := removeStartupEntry(); err != nil {
		return err
	}

	if err := deleteInstalledAgentConfig(); err != nil {
		return err
	}

	if err := removeInstalledAppLaunchers(); err != nil {
		return err
	}

	return nil
}

func uninstallNeedsHelper(installRoot string) bool {
	currentExe, err := os.Executable()
	if err != nil {
		return false
	}

	return pathWithinRoot(currentExe, installRoot)
}

func launchUninstallHelper(installRoot string) error {
	currentExe, err := os.Executable()
	if err != nil {
		return err
	}

	helperDir, err := os.MkdirTemp("", "nimvo-agent-uninstall-*")
	if err != nil {
		return err
	}

	helperExe := filepath.Join(helperDir, filepath.Base(currentExe))
	if err := copyFile(currentExe, helperExe); err != nil {
		return err
	}

	command := exec.Command(helperExe, "uninstall", "--install-dir", installRoot, "--purge", "--cleanup-self")
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	return command.Start()
}

func purgeInstallRoot(installRoot string) error {
	if !dirExists(installRoot) {
		return nil
	}

	var lastErr error
	for attempt := 0; attempt < 20; attempt++ {
		lastErr = os.RemoveAll(installRoot)
		if lastErr == nil && !dirExists(installRoot) {
			return nil
		}

		if !dirExists(installRoot) {
			return nil
		}

		time.Sleep(500 * time.Millisecond)
	}

	if lastErr != nil {
		return fmt.Errorf("nao foi possivel remover a pasta de instalacao do agente: %w", lastErr)
	}

	return fmt.Errorf("nao foi possivel remover a pasta de instalacao do agente: %s", installRoot)
}

func scheduleHelperSelfCleanup() error {
	currentExe, err := os.Executable()
	if err != nil {
		return err
	}

	helperDir := filepath.Dir(currentExe)
	cleanupCommand := fmt.Sprintf(
		`ping 127.0.0.1 -n 3 >nul & del /f /q "%s" >nul 2>&1 & rmdir /s /q "%s" >nul 2>&1`,
		currentExe,
		helperDir,
	)

	command := exec.Command("cmd.exe", "/C", cleanupCommand)
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	return command.Start()
}

func pathWithinRoot(path, root string) bool {
	normalizedPath, err := filepath.Abs(path)
	if err != nil {
		return false
	}

	normalizedRoot, err := filepath.Abs(root)
	if err != nil {
		return false
	}

	normalizedPath = strings.TrimRight(strings.ToLower(filepath.Clean(normalizedPath)), `\/`)
	normalizedRoot = strings.TrimRight(strings.ToLower(filepath.Clean(normalizedRoot)), `\/`)
	if normalizedPath == normalizedRoot {
		return true
	}

	return strings.HasPrefix(normalizedPath, normalizedRoot+`\`)
}

func defaultInstallDir() string {
	if localAppData := os.Getenv("LOCALAPPDATA"); strings.TrimSpace(localAppData) != "" {
		return filepath.Join(localAppData, "NimvoFiscalAgent")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".", "nimvo-fiscal-agent")
	}

	return filepath.Join(home, "AppData", "Local", "NimvoFiscalAgent")
}

func replaceInstalledExecutable(sourceExe, targetExe string) error {
	if sameResolvedPath(sourceExe, targetExe) {
		return nil
	}

	if fileExists(targetExe) {
		if err := stopProcessesForExecutable(targetExe); err != nil {
			return err
		}
	}

	return copyFileWithRetry(sourceExe, targetExe, 12, 500*time.Millisecond)
}

func copyFileWithRetry(src, dst string, attempts int, delay time.Duration) error {
	if attempts <= 0 {
		attempts = 1
	}

	var lastErr error
	for attempt := 0; attempt < attempts; attempt++ {
		if err := copyFile(src, dst); err == nil {
			return nil
		} else {
			lastErr = err
		}

		if attempt+1 < attempts {
			time.Sleep(delay)
		}
	}

	return lastErr
}

func stopProcessesForExecutable(executablePath string) error {
	executablePath = strings.TrimSpace(executablePath)
	if executablePath == "" || !fileExists(executablePath) {
		return nil
	}

	command := buildStopExecutableCommand(executablePath)
	process := exec.Command("powershell", "-NoProfile", "-Command", command)
	output, err := process.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}

		return fmt.Errorf("nao foi possivel encerrar a instancia anterior do agente: %s", message)
	}

	return nil
}

func buildStopExecutableCommand(executablePath string) string {
	return strings.Join([]string{
		fmt.Sprintf(`$target = '%s'`, escapePowerShellSingleQuoted(executablePath)),
		`$killed = $false`,
		`Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath, $target, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; $killed = $true }`,
		`if ($killed) { Start-Sleep -Milliseconds 800 }`,
	}, "; ")
}

func sameResolvedPath(left, right string) bool {
	leftAbs, leftErr := filepath.Abs(strings.TrimSpace(left))
	rightAbs, rightErr := filepath.Abs(strings.TrimSpace(right))
	if leftErr != nil || rightErr != nil {
		return false
	}

	return strings.EqualFold(filepath.Clean(leftAbs), filepath.Clean(rightAbs))
}

func buildRunScript(exePath, logPath string) string {
	return strings.Join([]string{
		"@echo off",
		"setlocal",
		fmt.Sprintf(`"%s" tray >> "%s" 2>&1`, exePath, logPath),
		"",
	}, "\r\n")
}

func buildVBSScript() string {
	return strings.Join([]string{
		`Set shell = CreateObject("WScript.Shell")`,
		`shell.Run Chr(34) & Replace(WScript.ScriptFullName, "run-agent.vbs", "run-agent.cmd") & Chr(34), 0, False`,
		"",
	}, "\r\n")
}

func buildLauncherVBSScript(targetCmd string) string {
	return strings.Join([]string{
		`Set shell = CreateObject("WScript.Shell")`,
		fmt.Sprintf(`shell.Run Chr(34) & "%s" & Chr(34), 0, False`, escapeVBString(targetCmd)),
		"",
	}, "\r\n")
}

func buildOpenAppScript(baseURL string) string {
	return strings.Join([]string{
		"@echo off",
		"setlocal",
		fmt.Sprintf(`set "NIMVO_URL=%s"`, strings.TrimSpace(baseURL)),
		`set "EDGE_STABLE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"`,
		`set "EDGE_X64=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"`,
		`set "CHROME_X64=%ProgramFiles%\Google\Chrome\Application\chrome.exe"`,
		`set "CHROME_X86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"`,
		`if exist "%EDGE_STABLE%" start "" "%EDGE_STABLE%" --app="%NIMVO_URL%" & exit /b 0`,
		`if exist "%EDGE_X64%" start "" "%EDGE_X64%" --app="%NIMVO_URL%" & exit /b 0`,
		`if exist "%CHROME_X64%" start "" "%CHROME_X64%" --app="%NIMVO_URL%" & exit /b 0`,
		`if exist "%CHROME_X86%" start "" "%CHROME_X86%" --app="%NIMVO_URL%" & exit /b 0`,
		`start "" "%NIMVO_URL%"`,
		"",
	}, "\r\n")
}

func buildUninstallScript(exePath, installDir string) string {
	return strings.Join([]string{
		"@echo off",
		"setlocal",
		fmt.Sprintf(`"%s" uninstall -install-dir "%s" --purge`, exePath, installDir),
		"pause",
		"",
	}, "\r\n")
}

func buildReadme(installDir string) string {
	lines := []string{
		"Nimvo Fiscal Agent",
		"",
		"Arquivos principais:",
		fmt.Sprintf("Instalacao: %s", installDir),
		"Configuracao local: registry://HKCU/Software/NimvoFiscalAgent",
		"",
		"Fluxo sugerido:",
		"1. O instalador coleta a URL do Nimvo, o codigo de ativacao do tenant, o certificado digital e a configuracao de impressao local.",
		"2. O agente troca o codigo por credenciais internas e passa a operar em segundo plano na bandeja do Windows.",
		"3. O agente envia heartbeat para o Nimvo e consome a fila central de impressoes do tenant.",
		"4. O setup instala um bridge fiscal PHP empacotado junto com o agente para emissao, cancelamento e inutilizacao local.",
		"5. Se o conector PDF estiver ativo, os cupons de exemplo sao salvos na pasta de previews configurada.",
		"6. Use open-nimvo-app.vbs para abrir a loja em modo app neste PC.",
		"7. Use run-agent.vbs para iniciar o agente manualmente sem abrir console.",
		"8. O agente grava a execucao em logs\\agent.log.",
		"",
		"Para remover o agente local, execute uninstall-agent.cmd ou use a opcao Desinstalar no icone da bandeja.",
		"",
	}

	return strings.Join(lines, "\r\n")
}

func installAppLaunchers(sourceVBS string) error {
	if strings.TrimSpace(sourceVBS) == "" || !fileExists(sourceVBS) {
		return nil
	}

	for _, target := range installedAppLauncherTargets() {
		if strings.TrimSpace(target) == "" {
			continue
		}

		if err := ensureDir(filepath.Dir(target)); err != nil {
			return err
		}

		if err := copyFile(sourceVBS, target); err != nil {
			return err
		}
	}

	return nil
}

func removeInstalledAppLaunchers() error {
	for _, target := range installedAppLauncherTargets() {
		if strings.TrimSpace(target) == "" || !fileExists(target) {
			continue
		}

		if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}

	return nil
}

func installedAppLaunchersExist() bool {
	for _, target := range installedAppLauncherTargets() {
		if strings.TrimSpace(target) != "" && fileExists(target) {
			return true
		}
	}

	return false
}

func installedAppLauncherTargets() []string {
	targets := []string{}

	if desktop := desktopDir(); strings.TrimSpace(desktop) != "" {
		targets = append(targets, filepath.Join(desktop, "Nimvo PDV.vbs"))
	}

	if startMenuPrograms := startMenuProgramsDir(); strings.TrimSpace(startMenuPrograms) != "" {
		targets = append(targets, filepath.Join(startMenuPrograms, "Nimvo", "Nimvo PDV.vbs"))
	}

	return targets
}

func desktopDir() string {
	if home, err := os.UserHomeDir(); err == nil && strings.TrimSpace(home) != "" {
		return filepath.Join(home, "Desktop")
	}

	return ""
}

func startMenuProgramsDir() string {
	if appData := strings.TrimSpace(os.Getenv("APPDATA")); appData != "" {
		return filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs")
	}

	return ""
}

func escapeVBString(value string) string {
	return strings.ReplaceAll(value, `"`, `""`)
}

func setStartupEntry(vbsPath string) error {
	command := fmt.Sprintf(`wscript.exe //B //Nologo "%s"`, vbsPath)
	cmd := exec.Command("reg", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", runEntryName, "/t", "REG_SZ", "/d", command, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("nao foi possivel registrar a inicializacao automatica: %s", strings.TrimSpace(string(output)))
	}

	return nil
}

func removeStartupEntry() error {
	if _, exists := readStartupEntry(); !exists {
		return nil
	}

	cmd := exec.Command("reg", "delete", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", runEntryName, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		trimmed := strings.TrimSpace(string(output))
		return fmt.Errorf("nao foi possivel remover a inicializacao automatica: %s", trimmed)
	}

	return nil
}

func readStartupEntry() (string, bool) {
	cmd := exec.Command("reg", "query", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", runEntryName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", false
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if !strings.Contains(line, runEntryName) {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) >= 3 {
			return strings.Join(fields[2:], " "), true
		}
	}

	return "", false
}

func launchAgent(vbsPath string) error {
	if !fileExists(vbsPath) {
		return errors.New("script de inicializacao nao encontrado para iniciar o agente")
	}

	cmd := exec.Command("wscript.exe", "//B", "//Nologo", vbsPath)
	return cmd.Start()
}

func completeInstallationConfig(config AgentConfig, defaultLogoPath, activationCode string, interactive bool) (AgentConfig, error) {
	var err error

	config = normalizeAgentConfig(config)
	config.Certificate = normalizeInstallationCertificate(config.Certificate)
	config.Printer.LogoPath = resolveAutomaticPrinterLogoPath(defaultLogoPath)

	if interactive {
		config.Backend.BaseURL, err = promptRequired("URL do backend do Nimvo", strings.TrimSpace(config.Backend.BaseURL))
		if err != nil {
			return config, err
		}

		activationCode, err = promptRequired("Codigo de ativacao do tenant", activationCode)
		if err != nil {
			return config, err
		}
	} else {
		config.Backend.BaseURL = strings.TrimSpace(config.Backend.BaseURL)
		activationCode = strings.TrimSpace(activationCode)
	}

	if strings.TrimSpace(config.Backend.BaseURL) == "" {
		return config, errors.New("informe a URL do backend do Nimvo para concluir a instalacao")
	}

	if strings.TrimSpace(activationCode) == "" {
		return config, errors.New("informe um codigo de ativacao valido para concluir a instalacao")
	}

	requestedPollInterval := config.Agent.PollInterval
	activatedConfig, err := activateInstalledAgentConfig(config.Backend.BaseURL, activationCode)
	if err != nil {
		return config, err
	}
	config.Backend = activatedConfig.Backend
	config.Agent = activatedConfig.Agent
	config.TenantApp = activatedConfig.TenantApp

	if interactive {
		config.Certificate, err = promptInstallationCertificate(config.Certificate)
		if err != nil {
			return config, err
		}
	}

	if interactive {
		pollInterval, err := promptText("Polling em segundos", fmt.Sprintf("%d", config.Agent.PollInterval))
		if err != nil {
			return config, err
		}
		if parsedPollInterval, parseErr := strconv.Atoi(strings.TrimSpace(pollInterval)); parseErr == nil && parsedPollInterval > 0 {
			config.Agent.PollInterval = parsedPollInterval
		}
	} else if requestedPollInterval > 0 {
		config.Agent.PollInterval = requestedPollInterval
	}

	config.Certificate = normalizeInstallationCertificate(config.Certificate)
	if err := validateInstallationCertificate(config.Certificate); err != nil {
		return config, err
	}

	if interactive {
		config.Printer.Enabled, err = promptBool("Ativar impressao automatica do cupom", config.Printer.Enabled)
		if err != nil {
			return config, err
		}
	}

	if !config.Printer.Enabled {
		return config, nil
	}

	if interactive {
		config.Printer.Connector, err = promptChoice("Conector da impressora [windows/tcp/pdf]", []string{"windows", "tcp", "pdf"}, config.Printer.Connector)
		if err != nil {
			return config, err
		}
	} else {
		config.Printer.Connector = normalizePrinterConnector(config.Printer.Connector)
	}

	switch normalizePrinterConnector(config.Printer.Connector) {
	case "tcp", "network":
		if interactive {
			config.Printer.Host, err = promptRequired("IP ou hostname da impressora", config.Printer.Host)
			if err != nil {
				return config, err
			}

			port, err := promptRequired("Porta TCP da impressora", fmt.Sprintf("%d", config.Printer.Port))
			if err != nil {
				return config, err
			}

			parsedPort, err := strconv.Atoi(strings.TrimSpace(port))
			if err != nil || parsedPort <= 0 {
				return config, errors.New("porta TCP invalida")
			}

			config.Printer.Port = parsedPort
		}

		config.Printer.Host = strings.TrimSpace(config.Printer.Host)
		if config.Printer.Host == "" {
			return config, errors.New("informe o IP ou hostname da impressora TCP")
		}

		if config.Printer.Port <= 0 {
			return config, errors.New("informe uma porta TCP valida para a impressora")
		}

		config.Printer.Name = ""
		return config, nil
	case "pdf":
		config.Printer.Name = ""
		config.Printer.Host = ""
		if strings.TrimSpace(config.Printer.OutputPath) == "" {
			config.Printer.OutputPath = defaultPreviewOutputDir()
		}
		if interactive {
			fmt.Printf("Os cupons de exemplo serao gerados em PDF em: %s\n", config.Printer.OutputPath)
		}
		return config, nil
	default:
		if interactive {
			config.Printer.Name, err = promptPrinterName(config.Printer.Name)
			if err != nil {
				return config, err
			}
		}

		config.Printer.Name = strings.TrimSpace(config.Printer.Name)
		if config.Printer.Name == "" {
			return config, errors.New("informe o nome da impressora do Windows")
		}

		if reason := unsupportedWindowsPrinterReason(config.Printer.Name); reason != "" {
			return config, fmt.Errorf("a impressora %s %s e nao e compativel com o conector windows raw do Nimvo", config.Printer.Name, reason)
		}

		return config, nil
	}
}

func resolveAutomaticPrinterLogoPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" || !fileExists(path) {
		return ""
	}

	return path
}

func normalizeInstallationCertificate(certificate Certificate) Certificate {
	certificate.Path = strings.TrimSpace(certificate.Path)
	if certificate.Path == "" {
		return Certificate{}
	}

	certificate.Password = strings.TrimSpace(certificate.Password)

	return certificate
}

func validateInstallationCertificate(certificate Certificate) error {
	if strings.TrimSpace(certificate.Path) == "" {
		return nil
	}

	if !fileExists(certificate.Path) {
		return fmt.Errorf("o arquivo do certificado digital nao foi encontrado: %s", certificate.Path)
	}

	return nil
}

func promptInstallationCertificate(certificate Certificate) (Certificate, error) {
	configureNow, err := promptBool("Configurar certificado digital agora", true)
	if err != nil {
		return Certificate{}, err
	}

	if !configureNow {
		return Certificate{}, nil
	}

	for {
		fmt.Println("Informe o caminho do certificado digital ou pressione Enter para procurar o arquivo no Windows.")

		certificate.Path, err = promptFilePath(
			"Arquivo do certificado digital (.pfx/.p12)",
			certificate.Path,
			"Selecione o certificado digital",
			"Certificados digitais (*.pfx;*.p12)|*.pfx;*.p12|Todos os arquivos (*.*)|*.*",
		)
		if err != nil {
			return Certificate{}, err
		}

		certificate = normalizeInstallationCertificate(certificate)
		if err := validateInstallationCertificate(certificate); err != nil {
			fmt.Println(err.Error())
			continue
		}

		fmt.Printf("Caminho do certificado selecionado: %s\n", certificate.Path)

		certificate.Password, err = promptText("Senha do certificado digital", certificate.Password)
		if err != nil {
			return Certificate{}, err
		}

		if strings.TrimSpace(certificate.Password) == "" {
			continueWithoutPassword, err := promptBool("Continuar sem senha do certificado", false)
			if err != nil {
				return Certificate{}, err
			}

			if !continueWithoutPassword {
				continue
			}
		}

		return normalizeInstallationCertificate(certificate), nil
	}
}

func activateInstalledAgentConfig(baseURL, activationCode string) (AgentConfig, error) {
	config := defaultAgentConfig()
	config.Backend.BaseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")

	payload, err := json.Marshal(map[string]any{
		"activation_code": strings.TrimSpace(activationCode),
	})
	if err != nil {
		return config, err
	}

	request, err := http.NewRequest(http.MethodPost, config.Backend.BaseURL+"/api/local-agents/activate", bytes.NewReader(payload))
	if err != nil {
		return config, err
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: time.Duration(maxInt(1, config.Backend.Timeout)) * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return config, fmt.Errorf("nao foi possivel ativar o agente no backend do Nimvo: %w", err)
	}
	defer response.Body.Close()

	rawBody, err := io.ReadAll(response.Body)
	if err != nil {
		return config, err
	}

	decoded := map[string]any{}
	if len(bytes.TrimSpace(rawBody)) > 0 {
		if err := json.Unmarshal(rawBody, &decoded); err != nil {
			return config, errors.New("o backend respondeu com um JSON invalido durante a ativacao do agente")
		}
	}

	if response.StatusCode >= 400 {
		message := strings.TrimSpace(stringValueFromMap(decoded, "message"))
		if message == "" {
			message = fmt.Sprintf("o backend recusou a ativacao com HTTP %d", response.StatusCode)
		}

		return config, errors.New(message)
	}

	config.Agent.Key = strings.TrimSpace(stringValueFromMap(decoded, "credentials.key"))
	config.Agent.Secret = strings.TrimSpace(stringValueFromMap(decoded, "credentials.secret"))
	config.TenantApp.BaseURL = strings.TrimSpace(stringValueFromMap(decoded, "tenant_app.base_url"))
	if pollInterval := maxInt(0, intValueFromMap(decoded, "credentials.poll_interval_seconds")); pollInterval > 0 {
		config.Agent.PollInterval = pollInterval
	}

	if config.Agent.Key == "" || config.Agent.Secret == "" {
		return config, errors.New("o backend ativou o agente, mas nao retornou as credenciais internas")
	}

	return normalizeAgentConfig(config), nil
}

func installBundledFiscalBridge(sourceDir string, targetBridgeRoot string) (string, error) {
	archivePath := filepath.Join(strings.TrimSpace(sourceDir), bundledFiscalBridgeArchiveName)
	if fileExists(archivePath) {
		if dirExists(targetBridgeRoot) {
			if err := os.RemoveAll(targetBridgeRoot); err != nil {
				return "", fmt.Errorf("nao foi possivel atualizar o bridge fiscal local: %w", err)
			}
		}

		if err := ensureDir(targetBridgeRoot); err != nil {
			return "", err
		}

		if err := extractZipArchive(archivePath, targetBridgeRoot); err != nil {
			return "", err
		}

		return filepath.Clean(targetBridgeRoot), nil
	}

	sourceBridgeRoot := filepath.Join(strings.TrimSpace(sourceDir), "bridge")
	if hasBundledFiscalBridge(sourceBridgeRoot) {
		if dirExists(targetBridgeRoot) {
			if err := os.RemoveAll(targetBridgeRoot); err != nil {
				return "", fmt.Errorf("nao foi possivel substituir o bridge fiscal local: %w", err)
			}
		}

		if err := copyDir(sourceBridgeRoot, targetBridgeRoot); err != nil {
			return "", err
		}

		return filepath.Clean(targetBridgeRoot), nil
	}

	return "", nil
}

func extractZipArchive(archivePath string, destinationRoot string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("nao foi possivel abrir o pacote do bridge fiscal: %w", err)
	}
	defer reader.Close()

	root := filepath.Clean(destinationRoot)

	for _, file := range reader.File {
		targetPath := filepath.Clean(filepath.Join(root, file.Name))
		if !strings.HasPrefix(targetPath, root+string(os.PathSeparator)) && targetPath != root {
			return fmt.Errorf("entrada invalida no pacote do bridge fiscal: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			if err := ensureDir(targetPath); err != nil {
				return err
			}
			continue
		}

		if err := ensureDir(filepath.Dir(targetPath)); err != nil {
			return err
		}

		source, err := file.Open()
		if err != nil {
			return err
		}

		target, err := os.OpenFile(targetPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, file.Mode())
		if err != nil {
			source.Close()
			return err
		}

		_, copyErr := io.Copy(target, source)
		closeErr := target.Close()
		source.Close()

		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}

	return nil
}

func copyDir(sourceRoot string, targetRoot string) error {
	return filepath.Walk(sourceRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relativePath, err := filepath.Rel(sourceRoot, path)
		if err != nil {
			return err
		}

		targetPath := filepath.Join(targetRoot, relativePath)

		if info.IsDir() {
			return ensureDir(targetPath)
		}

		return copyFile(path, targetPath)
	})
}

package main

import (
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
	"time"
)

const runEntryName = "NimvoFiscalAgent"

func runInstall(args []string) error {
	fs := flag.NewFlagSet("install", flag.ContinueOnError)
	installDir := fs.String("install-dir", defaultInstallDir(), "Pasta de instalacao do agente")
	enableStartup := fs.Bool("startup", true, "Registrar o agente para iniciar com o Windows")
	startNow := fs.Bool("start", true, "Iniciar o agente apos instalar")

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
	targetLog := filepath.Join(installRoot, "logs", "agent.log")
	targetIcon := filepath.Join(installRoot, "assets", "nimvo.ico")
	targetLogo := filepath.Join(installRoot, "assets", "nimvo-logo.png")
	targetRunCmd := filepath.Join(installRoot, "run-agent.cmd")
	targetRunVbs := filepath.Join(installRoot, "run-agent.vbs")
	targetUninstall := filepath.Join(installRoot, "uninstall-agent.cmd")
	targetReadme := filepath.Join(installRoot, "README.txt")

	for _, directory := range []string{
		filepath.Join(installRoot, "bin"),
		filepath.Join(installRoot, "logs"),
		filepath.Join(installRoot, "assets"),
	} {
		if err := ensureDir(directory); err != nil {
			return err
		}
	}

	if err := copyFile(currentExe, targetExe); err != nil {
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

	config, err := completeInstallationConfig(defaultAgentConfig(), targetLogo)
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
		"install_dir":     installRoot,
		"config_storage":  "registry://HKCU/Software/NimvoFiscalAgent",
		"log":             targetLog,
		"startup":         fmt.Sprintf("%t", *enableStartup),
		"local_api_url":   localAPIBaseURL(config),
		"printer_target":  printerTarget(config.Printer),
		"logo_path":       strings.TrimSpace(config.Printer.LogoPath),
		"backend_baseurl": strings.TrimSpace(config.Backend.BaseURL),
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
		status["printer_target"] = printerTarget(config.Printer)
		status["local_api_url"] = localAPIBaseURL(config)
		status["local_api_enabled"] = config.LocalAPI.Enabled
	}

	payload, _ := json.MarshalIndent(status, "", "  ")
	fmt.Println(string(payload))

	return nil
}

func runUninstall(args []string) error {
	fs := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	installDir := fs.String("install-dir", defaultInstallDir(), "Pasta de instalacao do agente")

	if err := fs.Parse(args); err != nil {
		return err
	}

	installRoot, err := filepath.Abs(*installDir)
	if err != nil {
		return err
	}

	if err := removeStartupEntry(); err != nil {
		return err
	}

	if err := deleteInstalledAgentConfig(); err != nil {
		return err
	}

	fmt.Println("Inicializacao automatica e configuracao local removidas com sucesso.")
	fmt.Printf("Se quiser apagar os arquivos do agente, remova a pasta: %s\n", installRoot)

	return nil
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

func buildUninstallScript(exePath, installDir string) string {
	return strings.Join([]string{
		"@echo off",
		"setlocal",
		fmt.Sprintf(`"%s" uninstall -install-dir "%s"`, exePath, installDir),
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
		"1. O instalador coleta a URL do Nimvo, o codigo de ativacao do tenant, a impressora e o logo do cupom.",
		"2. O agente troca o codigo por credenciais internas e passa a operar em segundo plano na bandeja do Windows.",
		"3. O agente envia heartbeat para o Nimvo e consome a fila central de impressoes do tenant.",
		"4. Use run-agent.vbs para iniciar o agente manualmente sem abrir console.",
		"5. O agente grava a execucao em logs\\agent.log.",
		"",
		"Para desabilitar a inicializacao automatica, execute uninstall-agent.cmd.",
		"",
	}

	return strings.Join(lines, "\r\n")
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

func completeInstallationConfig(config AgentConfig, defaultLogoPath string) (AgentConfig, error) {
	var err error

	config = normalizeAgentConfig(config)
	config.Certificate = Certificate{}
	config.Printer.LogoPath = resolveAutomaticPrinterLogoPath(defaultLogoPath)

	config.Backend.BaseURL, err = promptRequired("URL do backend do Nimvo", strings.TrimSpace(config.Backend.BaseURL))
	if err != nil {
		return config, err
	}

	activationCode, err := promptRequired("Codigo de ativacao do tenant", "")
	if err != nil {
		return config, err
	}

	activatedConfig, err := activateInstalledAgentConfig(config.Backend.BaseURL, activationCode)
	if err != nil {
		return config, err
	}
	config.Backend = activatedConfig.Backend
	config.Agent = activatedConfig.Agent

	pollInterval, err := promptText("Polling em segundos", fmt.Sprintf("%d", config.Agent.PollInterval))
	if err != nil {
		return config, err
	}
	if parsedPollInterval, parseErr := strconv.Atoi(strings.TrimSpace(pollInterval)); parseErr == nil && parsedPollInterval > 0 {
		config.Agent.PollInterval = parsedPollInterval
	}

	config.Printer.Enabled, err = promptBool("Ativar impressao automatica do cupom", config.Printer.Enabled)
	if err != nil {
		return config, err
	}

	if !config.Printer.Enabled {
		return config, nil
	}

	config.Printer.Connector, err = promptChoice("Conector da impressora [windows/tcp]", []string{"windows", "tcp"}, config.Printer.Connector)
	if err != nil {
		return config, err
	}

	if config.Printer.Connector == "tcp" {
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
		config.Printer.Name = ""

		return config, nil
	}

	config.Printer.Name, err = promptPrinterName(config.Printer.Name)
	if err != nil {
		return config, err
	}

	return config, nil
}

func resolveAutomaticPrinterLogoPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" || !fileExists(path) {
		return ""
	}

	return path
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
	if pollInterval := maxInt(0, intValueFromMap(decoded, "credentials.poll_interval_seconds")); pollInterval > 0 {
		config.Agent.PollInterval = pollInterval
	}

	if config.Agent.Key == "" || config.Agent.Secret == "" {
		return config, errors.New("o backend ativou o agente, mas nao retornou as credenciais internas")
	}

	return normalizeAgentConfig(config), nil
}

package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

const runEntryName = "NimvoFiscalAgent"

func runInstall(args []string) error {
	fs := flag.NewFlagSet("install", flag.ContinueOnError)
	installDir := fs.String("install-dir", defaultInstallDir(), "Pasta de instalacao do agente")
	configSource := fs.String("config", "", "JSON base do agente para copiar na instalacao")
	projectRoot := fs.String("project-root", "", "Pasta raiz do Nimvo (onde existe o arquivo artisan)")
	phpPath := fs.String("php", "", "Caminho do php.exe usado pelo agente")
	enableStartup := fs.Bool("startup", true, "Registrar o agente para iniciar com o Windows")
	startNow := fs.Bool("start", true, "Iniciar o agente apos instalar")

	if err := fs.Parse(args); err != nil {
		return err
	}

	installRoot, err := filepath.Abs(*installDir)
	if err != nil {
		return err
	}

	projectRootPath, err := resolveProjectRoot(*projectRoot)
	if err != nil {
		return err
	}

	currentExe, err := os.Executable()
	if err != nil {
		return err
	}

	sourceDir := filepath.Dir(currentExe)
	targetExe := filepath.Join(installRoot, "bin", "nimvo-fiscal-agent.exe")
	targetConfig := filepath.Join(installRoot, "config", "agent.json")
	targetLog := filepath.Join(installRoot, "logs", "agent.log")
	targetRunCmd := filepath.Join(installRoot, "run-agent.cmd")
	targetRunVbs := filepath.Join(installRoot, "run-agent.vbs")
	targetUninstall := filepath.Join(installRoot, "uninstall-agent.cmd")
	targetReadme := filepath.Join(installRoot, "README.txt")

	for _, directory := range []string{
		filepath.Join(installRoot, "bin"),
		filepath.Join(installRoot, "config"),
		filepath.Join(installRoot, "logs"),
	} {
		if err := ensureDir(directory); err != nil {
			return err
		}
	}

	if err := copyFile(currentExe, targetExe); err != nil {
		return err
	}

	config, selectedConfigPath, err := resolveInstallSeedConfig(*configSource, sourceDir)
	if err != nil {
		return err
	}

	config, err = completeInstallationConfig(config)
	if err != nil {
		return err
	}

	if err := saveAgentConfig(targetConfig, config); err != nil {
		return err
	}

	if err := os.WriteFile(targetRunCmd, []byte(buildRunScript(targetExe, targetConfig, projectRootPath, *phpPath, targetLog)), 0o644); err != nil {
		return err
	}

	if err := os.WriteFile(targetRunVbs, []byte(buildVBSScript()), 0o644); err != nil {
		return err
	}

	if err := os.WriteFile(targetUninstall, []byte(buildUninstallScript(targetExe, installRoot)), 0o644); err != nil {
		return err
	}

	if err := os.WriteFile(targetReadme, []byte(buildReadme(targetConfig, projectRootPath, installRoot)), 0o644); err != nil {
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
		"install_dir":  installRoot,
		"project_root": projectRootPath,
		"config":       targetConfig,
		"seed_config":  selectedConfigPath,
		"log":          targetLog,
		"startup":      fmt.Sprintf("%t", *enableStartup),
	}

	payload, _ := json.MarshalIndent(summary, "", "  ")
	fmt.Println("Agente instalado com sucesso.")
	fmt.Println(string(payload))
	fmt.Println("As configuracoes centrais passam a vir do Nimvo. O arquivo local fica somente com os dados da maquina.")

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
		"install_dir":       installRoot,
		"installed":         fileExists(filepath.Join(installRoot, "bin", "nimvo-fiscal-agent.exe")),
		"config_exists":     fileExists(filepath.Join(installRoot, "config", "agent.json")),
		"log_exists":        fileExists(filepath.Join(installRoot, "logs", "agent.log")),
		"startup_enabled":   startupEnabled,
		"startup_command":   runValue,
		"run_script_exists": fileExists(filepath.Join(installRoot, "run-agent.cmd")),
	}

	if config, err := loadAgentConfig(filepath.Join(installRoot, "config", "agent.json")); err == nil {
		config = normalizeAgentConfig(config)
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

	fmt.Println("Inicializacao automatica removida com sucesso.")
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

func buildRunScript(exePath, configPath, projectRoot, phpPath, logPath string) string {
	phpArgument := ""
	if strings.TrimSpace(phpPath) != "" {
		phpArgument = fmt.Sprintf(` -php "%s"`, phpPath)
	}

	return strings.Join([]string{
		"@echo off",
		"setlocal",
		":loop",
		fmt.Sprintf(`cd /d "%s"`, projectRoot),
		fmt.Sprintf(`"%s" daemon -config "%s" -project-root "%s"%s >> "%s" 2>&1`, exePath, configPath, projectRoot, phpArgument, logPath),
		"timeout /t 5 /nobreak >nul",
		"goto loop",
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

func buildReadme(configPath, projectRoot, installDir string) string {
	lines := []string{
		"Nimvo Fiscal Agent",
		"",
		"Arquivos principais:",
		fmt.Sprintf("Config: %s", configPath),
		fmt.Sprintf("Projeto Nimvo: %s", projectRoot),
		fmt.Sprintf("Instalacao: %s", installDir),
		"",
		"Fluxo sugerido:",
		"1. O instalador coleta o JSON base do agente, o certificado A1 e a impressora.",
		"2. O agente sobe uma API local HTTP para a ponte de impressao do Nimvo no navegador.",
		"3. O agente sincroniza as configuracoes centrais com o Nimvo a cada heartbeat.",
		"4. Use run-agent.vbs para iniciar o agente manualmente sem abrir console.",
		"5. O agente grava o loop em logs\\agent.log.",
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

func resolveInstallSeedConfig(configSource, sourceDir string) (AgentConfig, string, error) {
	defaultPath := strings.TrimSpace(configSource)
	if defaultPath == "" {
		for _, candidate := range []string{
			filepath.Join(sourceDir, "agent.seed.json"),
			filepath.Join(sourceDir, "config.example.json"),
		} {
			if fileExists(candidate) {
				defaultPath = candidate
				break
			}
		}
	}

	for {
		selectedPath, err := promptSeedConfigPath(defaultPath)
		if err != nil {
			return AgentConfig{}, "", err
		}

		config, err := loadAgentConfig(selectedPath)
		if err != nil {
			fmt.Printf("Nao foi possivel ler o JSON do agente: %s\n", err.Error())
			defaultPath = ""
			continue
		}

		config = normalizeAgentConfig(config)
		reason := ""
		if err := ensureBootstrapConfig(config); err != nil {
			reason = err.Error()
		} else if isPlaceholderConfig(config) {
			reason = "o arquivo ainda contem valores de exemplo"
		}

		if reason != "" {
			fmt.Printf("O JSON selecionado nao esta pronto para instalar este cliente: %s.\n", reason)
			fmt.Println("Selecione o JSON real gerado pelo Nimvo para esse tenant.")
			defaultPath = ""
			continue
		}

		return config, selectedPath, nil
	}
}

func promptSeedConfigPath(defaultPath string) (string, error) {
	defaultPath = strings.TrimSpace(defaultPath)
	if defaultPath != "" && fileExists(defaultPath) {
		value, err := promptText("JSON base do agente (Enter para usar, B para procurar)", defaultPath)
		if err != nil {
			return "", err
		}

		switch strings.ToLower(strings.TrimSpace(value)) {
		case "":
			return defaultPath, nil
		case "b", "browse", "procurar":
			picked, err := openFileDialog("Selecione o JSON do agente Nimvo", "Arquivos JSON (*.json)|*.json|Todos os arquivos (*.*)|*.*")
			if err != nil {
				return "", err
			}
			if strings.TrimSpace(picked) != "" {
				return picked, nil
			}
		default:
			return strings.TrimSpace(value), nil
		}
	}

	return promptFilePath(
		"Informe o JSON do agente Nimvo",
		"",
		"Selecione o JSON do agente Nimvo",
		"Arquivos JSON (*.json)|*.json|Todos os arquivos (*.*)|*.*",
	)
}

func completeInstallationConfig(config AgentConfig) (AgentConfig, error) {
	var err error

	config = normalizeAgentConfig(config)
	if isPlaceholderValue(config.Certificate.Path) {
		config.Certificate.Path = ""
	}
	if isPlaceholderValue(config.Certificate.Password) {
		config.Certificate.Password = ""
	}

	config.Certificate.Path, err = promptFilePath(
		"Certificado A1 da empresa",
		config.Certificate.Path,
		"Selecione o certificado A1",
		"Certificados A1 (*.pfx;*.p12)|*.pfx;*.p12|Todos os arquivos (*.*)|*.*",
	)
	if err != nil {
		return config, err
	}

	config.Certificate.Password, err = promptRequired("Senha do certificado", config.Certificate.Password)
	if err != nil {
		return config, err
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

package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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

	config, err := resolveSeedConfig(*configSource, sourceDir)
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
		"log":          targetLog,
		"startup":      fmt.Sprintf("%t", *enableStartup),
	}

	payload, _ := json.MarshalIndent(summary, "", "  ")
	fmt.Println("Agente instalado com sucesso.")
	fmt.Println(string(payload))
	fmt.Println("Edite o arquivo de configuracao se precisar trocar backend, credenciais, certificado ou impressora.")

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
		fmt.Sprintf(`"%s" run -config "%s" -project-root "%s"%s >> "%s" 2>&1`, exePath, configPath, projectRoot, phpArgument, logPath),
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
		"1. Edite o JSON de configuracao com backend, agent_key, agent_secret, certificado e impressora.",
		"2. Use run-agent.vbs para iniciar o agente manualmente sem abrir console.",
		"3. O agente grava o loop em logs\\agent.log.",
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

package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type AgentConfig struct {
	Backend     BackendConfig  `json:"backend"`
	Agent       AgentAuth      `json:"agent"`
	Certificate Certificate    `json:"certificate"`
	Printer     PrinterConfig  `json:"printer"`
	LocalAPI    LocalAPIConfig `json:"local_api"`
}

type BackendConfig struct {
	BaseURL      string `json:"base_url"`
	Timeout      int    `json:"timeout_seconds"`
	RetryTimes   int    `json:"retry_times,omitempty"`
	RetrySleepMS int    `json:"retry_sleep_ms,omitempty"`
}

type AgentAuth struct {
	Key          string `json:"key"`
	Secret       string `json:"secret"`
	PollInterval int    `json:"poll_interval_seconds"`
}

type Certificate struct {
	Path     string `json:"path"`
	Password string `json:"password"`
}

type PrinterConfig struct {
	Enabled   bool   `json:"enabled"`
	Connector string `json:"connector"`
	Name      string `json:"name"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	LogoPath  string `json:"logo_path"`
}

type LocalAPIConfig struct {
	Enabled bool   `json:"enabled"`
	Host    string `json:"host"`
	Port    int    `json:"port"`
}

func defaultAgentConfig() AgentConfig {
	return AgentConfig{
		Backend: BackendConfig{
			BaseURL:      "https://app.seudominio.com",
			Timeout:      30,
			RetryTimes:   3,
			RetrySleepMS: 500,
		},
		Agent: AgentAuth{
			Key:          "preencher-com-agent_key",
			Secret:       "preencher-com-agent_secret",
			PollInterval: 3,
		},
		Certificate: Certificate{
			Path:     `C:\certificados\empresa.pfx`,
			Password: "alterar-aqui",
		},
		Printer: PrinterConfig{
			Enabled:   true,
			Connector: "windows",
			Name:      "POS-58",
			Host:      "127.0.0.1",
			Port:      9100,
			LogoPath:  "",
		},
		LocalAPI: LocalAPIConfig{
			Enabled: true,
			Host:    "127.0.0.1",
			Port:    18123,
		},
	}
}

func loadAgentConfig(path string) (AgentConfig, error) {
	var config AgentConfig

	content, err := os.ReadFile(path)
	if err != nil {
		return config, err
	}

	if err := json.Unmarshal(content, &config); err != nil {
		return config, err
	}

	return config, nil
}

func saveAgentConfig(path string, config AgentConfig) error {
	if err := ensureDir(filepath.Dir(path)); err != nil {
		return err
	}

	content, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, append(content, '\n'), 0o644)
}

func resolveSeedConfig(configSource, sourceDir string) (AgentConfig, error) {
	if strings.TrimSpace(configSource) != "" {
		return loadAgentConfig(configSource)
	}

	for _, candidate := range []string{
		filepath.Join(sourceDir, "agent.seed.json"),
		filepath.Join(sourceDir, "config.example.json"),
	} {
		if fileExists(candidate) {
			return loadAgentConfig(candidate)
		}
	}

	return defaultAgentConfig(), nil
}

func normalizeAgentConfig(config AgentConfig) AgentConfig {
	if strings.TrimSpace(config.Backend.BaseURL) == "" {
		config.Backend.BaseURL = defaultAgentConfig().Backend.BaseURL
	}

	if config.Backend.Timeout <= 0 {
		config.Backend.Timeout = 30
	}

	if config.Backend.RetryTimes <= 0 {
		config.Backend.RetryTimes = 3
	}

	if config.Backend.RetrySleepMS <= 0 {
		config.Backend.RetrySleepMS = 500
	}

	if config.Agent.PollInterval <= 0 {
		config.Agent.PollInterval = 3
	}

	if strings.TrimSpace(config.Printer.Connector) == "" {
		config.Printer.Connector = "windows"
	}

	if config.Printer.Port <= 0 {
		config.Printer.Port = 9100
	}

	if strings.TrimSpace(config.LocalAPI.Host) == "" {
		config.LocalAPI.Host = "127.0.0.1"
	}

	if config.LocalAPI.Port <= 0 {
		config.LocalAPI.Port = 18123
	}

	return config
}

func ensureDir(path string) error {
	if strings.TrimSpace(path) == "" {
		return nil
	}

	return os.MkdirAll(path, 0o755)
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	if err := ensureDir(filepath.Dir(dst)); err != nil {
		return err
	}

	target, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer target.Close()

	if _, err := io.Copy(target, source); err != nil {
		return err
	}

	return target.Close()
}

func resolveProjectRoot(explicit string) (string, error) {
	candidates := []string{}

	if explicit != "" {
		candidates = append(candidates, explicit)
	}

	if envRoot := os.Getenv("NIMVO_PROJECT_ROOT"); envRoot != "" {
		candidates = append(candidates, envRoot)
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, cwd)
	}

	candidates = append(candidates, defaultProjectRoot())

	for _, candidate := range candidates {
		if root := searchProjectRoot(candidate); root != "" {
			return root, nil
		}
	}

	fmt.Print("Informe a pasta do Nimvo onde existe o arquivo artisan: ")
	line, err := readLine()
	if err != nil {
		return "", err
	}

	if root := searchProjectRoot(line); root != "" {
		return root, nil
	}

	return "", errors.New("nao foi possivel localizar a pasta do Nimvo. Use -project-root apontando para a raiz do projeto")
}

func searchProjectRoot(start string) string {
	start = strings.TrimSpace(start)
	if start == "" {
		return ""
	}

	current, err := filepath.Abs(start)
	if err != nil {
		return ""
	}

	for {
		if fileExists(filepath.Join(current, "artisan")) && dirExists(filepath.Join(current, "app")) {
			return current
		}

		parent := filepath.Dir(current)
		if parent == current {
			return ""
		}

		current = parent
	}
}

func readLine() (string, error) {
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}

	return strings.TrimSpace(line), nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

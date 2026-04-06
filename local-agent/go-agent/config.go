package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
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
	Enabled    bool   `json:"enabled"`
	Connector  string `json:"connector"`
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	LogoPath   string `json:"logo_path"`
	OutputPath string `json:"output_path"`
}

type LocalAPIConfig struct {
	Enabled bool   `json:"enabled"`
	Host    string `json:"host"`
	Port    int    `json:"port"`
}

func defaultAgentConfig() AgentConfig {
	return AgentConfig{
		Backend: BackendConfig{
			BaseURL:      "",
			Timeout:      30,
			RetryTimes:   3,
			RetrySleepMS: 500,
		},
		Agent: AgentAuth{
			Key:          "",
			Secret:       "",
			PollInterval: 3,
		},
		Certificate: Certificate{},
		Printer: PrinterConfig{
			Enabled:    true,
			Connector:  "windows",
			Name:       "",
			Host:       "127.0.0.1",
			Port:       9100,
			LogoPath:   "",
			OutputPath: defaultPreviewOutputDir(),
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

func normalizeAgentConfig(config AgentConfig) AgentConfig {
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

	if strings.TrimSpace(config.Printer.OutputPath) == "" {
		config.Printer.OutputPath = defaultPreviewOutputDir()
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

const installedAgentRegistryKey = `HKCU\Software\NimvoFiscalAgent`

func loadInstalledAgentConfig() (AgentConfig, error) {
	values, err := readRegistryKey(installedAgentRegistryKey)
	if err != nil {
		return AgentConfig{}, errors.New("configuracao local do agente nao encontrada. Rode o instalador do Nimvo Fiscal Agent nesta maquina")
	}

	config := defaultAgentConfig()
	config.Backend.BaseURL = strings.TrimSpace(values.stringValue("BackendBaseURL"))
	config.Backend.Timeout = values.intValue("BackendTimeoutSeconds", config.Backend.Timeout)
	config.Backend.RetryTimes = values.intValue("BackendRetryTimes", config.Backend.RetryTimes)
	config.Backend.RetrySleepMS = values.intValue("BackendRetrySleepMS", config.Backend.RetrySleepMS)
	config.Agent.Key = strings.TrimSpace(values.stringValue("AgentKey"))
	config.Agent.Secret = values.stringValue("AgentSecret")
	config.Agent.PollInterval = values.intValue("AgentPollIntervalSeconds", config.Agent.PollInterval)
	config.Certificate.Path = values.stringValue("CertificatePath")
	config.Certificate.Password = values.stringValue("CertificatePassword")
	config.Printer.Enabled = values.boolValue("PrinterEnabled", config.Printer.Enabled)
	config.Printer.Connector = strings.TrimSpace(values.stringValue("PrinterConnector"))
	config.Printer.Name = values.stringValue("PrinterName")
	config.Printer.Host = values.stringValue("PrinterHost")
	config.Printer.Port = values.intValue("PrinterPort", config.Printer.Port)
	config.Printer.LogoPath = values.stringValue("PrinterLogoPath")
	config.Printer.OutputPath = values.stringValue("PrinterOutputPath")
	config.LocalAPI.Enabled = values.boolValue("LocalAPIEnabled", config.LocalAPI.Enabled)
	config.LocalAPI.Host = values.stringValue("LocalAPIHost")
	config.LocalAPI.Port = values.intValue("LocalAPIPort", config.LocalAPI.Port)

	return normalizeAgentConfig(config), nil
}

func saveInstalledAgentConfig(config AgentConfig) error {
	config = normalizeAgentConfig(config)

	type registryWrite struct {
		name  string
		kind  string
		value string
	}

	writes := []registryWrite{
		{name: "BackendBaseURL", kind: "REG_SZ", value: strings.TrimSpace(config.Backend.BaseURL)},
		{name: "BackendTimeoutSeconds", kind: "REG_DWORD", value: formatRegistryDWORD(config.Backend.Timeout)},
		{name: "BackendRetryTimes", kind: "REG_DWORD", value: formatRegistryDWORD(config.Backend.RetryTimes)},
		{name: "BackendRetrySleepMS", kind: "REG_DWORD", value: formatRegistryDWORD(config.Backend.RetrySleepMS)},
		{name: "AgentKey", kind: "REG_SZ", value: strings.TrimSpace(config.Agent.Key)},
		{name: "AgentSecret", kind: "REG_SZ", value: config.Agent.Secret},
		{name: "AgentPollIntervalSeconds", kind: "REG_DWORD", value: formatRegistryDWORD(config.Agent.PollInterval)},
		{name: "CertificatePath", kind: "REG_SZ", value: config.Certificate.Path},
		{name: "CertificatePassword", kind: "REG_SZ", value: config.Certificate.Password},
		{name: "PrinterEnabled", kind: "REG_DWORD", value: formatRegistryBool(config.Printer.Enabled)},
		{name: "PrinterConnector", kind: "REG_SZ", value: config.Printer.Connector},
		{name: "PrinterName", kind: "REG_SZ", value: config.Printer.Name},
		{name: "PrinterHost", kind: "REG_SZ", value: config.Printer.Host},
		{name: "PrinterPort", kind: "REG_DWORD", value: formatRegistryDWORD(config.Printer.Port)},
		{name: "PrinterLogoPath", kind: "REG_SZ", value: config.Printer.LogoPath},
		{name: "PrinterOutputPath", kind: "REG_SZ", value: config.Printer.OutputPath},
		{name: "LocalAPIEnabled", kind: "REG_DWORD", value: formatRegistryBool(config.LocalAPI.Enabled)},
		{name: "LocalAPIHost", kind: "REG_SZ", value: config.LocalAPI.Host},
		{name: "LocalAPIPort", kind: "REG_DWORD", value: formatRegistryDWORD(config.LocalAPI.Port)},
	}

	for _, write := range writes {
		if err := writeRegistryValue(installedAgentRegistryKey, write.name, write.kind, write.value); err != nil {
			return err
		}
	}

	return nil
}

func deleteInstalledAgentConfig() error {
	cmd := exec.Command("reg", "delete", installedAgentRegistryKey, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		trimmed := strings.ToLower(strings.TrimSpace(string(output)))
		if strings.Contains(trimmed, "unable to find") || strings.Contains(trimmed, "nao foi possivel localizar") {
			return nil
		}

		return errors.New(strings.TrimSpace(string(output)))
	}

	return nil
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

func defaultPreviewOutputDir() string {
	if home, err := os.UserHomeDir(); err == nil && strings.TrimSpace(home) != "" {
		return filepath.Join(home, "Documents", "NimvoFiscalAgent", "prints")
	}

	if localAppData := strings.TrimSpace(os.Getenv("LOCALAPPDATA")); localAppData != "" {
		return filepath.Join(localAppData, "NimvoFiscalAgent", "prints")
	}

	return filepath.Join(os.TempDir(), "NimvoFiscalAgent", "prints")
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

type registryValues map[string]registryEntry

type registryEntry struct {
	kind  string
	value string
}

func (values registryValues) stringValue(name string) string {
	entry, ok := values[name]
	if !ok {
		return ""
	}

	return strings.TrimSpace(entry.value)
}

func (values registryValues) intValue(name string, fallback int) int {
	entry, ok := values[name]
	if !ok {
		return fallback
	}

	normalized := strings.TrimSpace(entry.value)
	if normalized == "" {
		return fallback
	}

	if strings.HasPrefix(strings.ToLower(normalized), "0x") {
		parsed, err := strconv.ParseInt(normalized[2:], 16, 32)
		if err == nil {
			return int(parsed)
		}
	}

	parsed, err := strconv.Atoi(normalized)
	if err != nil {
		return fallback
	}

	return parsed
}

func (values registryValues) boolValue(name string, fallback bool) bool {
	if values.intValue(name, boolToInt(fallback)) > 0 {
		return true
	}

	return false
}

func readRegistryKey(key string) (registryValues, error) {
	cmd := exec.Command("reg", "query", key)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(output), "\n")
	values := registryValues{}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(strings.ToUpper(line), "HKEY_") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}

		values[fields[0]] = registryEntry{
			kind:  fields[1],
			value: strings.Join(fields[2:], " "),
		}
	}

	if len(values) == 0 {
		return nil, errors.New("registro vazio")
	}

	return values, nil
}

func writeRegistryValue(key, name, kind, value string) error {
	cmd := exec.Command("reg", "add", key, "/v", name, "/t", kind, "/d", value, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return errors.New(strings.TrimSpace(string(output)))
	}

	return nil
}

func formatRegistryDWORD(value int) string {
	if value < 0 {
		value = 0
	}

	return strconv.Itoa(value)
}

func formatRegistryBool(value bool) string {
	return formatRegistryDWORD(boolToInt(value))
}

func boolToInt(value bool) int {
	if value {
		return 1
	}

	return 0
}

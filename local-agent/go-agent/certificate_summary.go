package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"time"
)

type cachedCertificateSummary struct {
	path     string
	password string
	modTime  time.Time
	payload  map[string]any
}

var certificateSummaryCache cachedCertificateSummary

func certificateSummaryForConfig(config AgentConfig) map[string]any {
	path := strings.TrimSpace(config.Certificate.Path)
	password := config.Certificate.Password

	if path == "" || password == "" || !fileExists(path) {
		return map[string]any{}
	}

	if !fiscalBridgeAvailable(config) {
		return map[string]any{}
	}

	fileInfo, err := os.Stat(path)
	if err == nil &&
		certificateSummaryCache.path == path &&
		certificateSummaryCache.password == password &&
		certificateSummaryCache.modTime.Equal(fileInfo.ModTime()) {
		return cloneSummaryMap(certificateSummaryCache.payload)
	}

	projectRoot := resolveLaravelProjectRoot(config)
	phpBinary := resolvePHPBinary(config)

	if projectRoot == "" || phpBinary == "" {
		return map[string]any{}
	}

	process := exec.Command(
		phpBinary,
		"artisan",
		"fiscal:cert:inspect",
		path,
		"--password="+password,
		"--json",
	)
	process.Dir = projectRoot

	output, execErr := process.CombinedOutput()
	if execErr != nil {
		return map[string]any{}
	}

	decoded := map[string]any{}
	if json.Unmarshal(output, &decoded) != nil {
		return map[string]any{}
	}

	summary := map[string]any{
		"company_name": strings.TrimSpace(stringValueFromMap(decoded, "company_name")),
		"cnpj":         strings.TrimSpace(stringValueFromMap(decoded, "cnpj")),
		"valid_from":   strings.TrimSpace(stringValueFromMap(decoded, "valid_from")),
		"valid_to":     strings.TrimSpace(stringValueFromMap(decoded, "valid_to")),
	}

	if err == nil {
		certificateSummaryCache = cachedCertificateSummary{
			path:     path,
			password: password,
			modTime:  fileInfo.ModTime(),
			payload:  cloneSummaryMap(summary),
		}
	}

	return summary
}

func cloneSummaryMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}

	cloned := make(map[string]any, len(input))
	for key, value := range input {
		cloned[key] = value
	}

	return cloned
}

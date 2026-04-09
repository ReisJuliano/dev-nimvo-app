package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var printerCommandTypes = []string{
	"print_payment_receipt",
	"print_test",
}

var fiscalBridgeCommandTypes = []string{
	"emit_nfce",
	"cancel_fiscal_document",
}

func supportedCommandTypesForConfig(config AgentConfig) []string {
	supported := append([]string{}, printerCommandTypes...)
	if fiscalBridgeAvailable(config) {
		supported = append(fiscalBridgeCommandTypes, supported...)
	}

	return supported
}

func fiscalBridgeAvailable(config AgentConfig) bool {
	return resolveLaravelProjectRoot(config) != "" && resolvePHPBinary(config) != ""
}

func resolveLaravelProjectRoot(config AgentConfig) string {
	candidates := []string{strings.TrimSpace(config.Software.ProjectRoot)}

	if currentDir, err := os.Getwd(); err == nil {
		candidates = append(candidates, currentDir)
	}

	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) == "" {
			continue
		}

		if hasLaravelProject(candidate) {
			return candidate
		}
	}

	return ""
}

func hasLaravelProject(root string) bool {
	artisan := filepath.Join(strings.TrimSpace(root), "artisan")
	return fileExists(artisan)
}

func resolvePHPBinary(config AgentConfig) string {
	configured := strings.TrimSpace(config.Software.PHPPath)
	if configured != "" {
		if fileExists(configured) {
			return configured
		}

		if resolved, err := exec.LookPath(configured); err == nil {
			return resolved
		}
	}

	if resolved, err := exec.LookPath("php"); err == nil {
		return resolved
	}

	return ""
}

func executeFiscalBridgeCommand(config AgentConfig, command polledAgentCommand) (map[string]any, error) {
	projectRoot := resolveLaravelProjectRoot(config)
	if projectRoot == "" {
		return nil, errors.New("ponte fiscal indisponivel: projeto Laravel nao configurado no agente")
	}

	phpBinary := resolvePHPBinary(config)
	if phpBinary == "" {
		return nil, errors.New("ponte fiscal indisponivel: executavel do PHP nao configurado no agente")
	}

	tempDir, err := os.MkdirTemp("", "nimvo-fiscal-bridge-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	configPath := filepath.Join(tempDir, "agent-config.json")
	payloadPath := filepath.Join(tempDir, "command-payload.json")

	if err := saveAgentConfig(configPath, config); err != nil {
		return nil, err
	}

	payloadContent, err := json.MarshalIndent(command.Payload, "", "  ")
	if err != nil {
		return nil, errors.New("nao foi possivel serializar o payload do comando fiscal")
	}

	if err := os.WriteFile(payloadPath, append(payloadContent, '\n'), 0o644); err != nil {
		return nil, err
	}

	process := exec.Command(
		phpBinary,
		"artisan",
		"fiscal:agent:execute-command",
		configPath,
		command.Type,
		payloadPath,
	)
	process.Dir = projectRoot

	output, execErr := process.CombinedOutput()
	result, parseErr := decodeFiscalBridgeResult(output)
	if parseErr != nil {
		if execErr != nil {
			return nil, fmt.Errorf("falha na ponte fiscal local: %s", strings.TrimSpace(string(output)))
		}

		return nil, parseErr
	}

	if execErr != nil {
		return result, errors.New(resolveBridgeErrorMessage(result, string(output)))
	}

	status := strings.TrimSpace(stringValueFromMap(result, "status"))
	if status == "failed" || status == "rejected" {
		return result, errors.New(resolveBridgeErrorMessage(result, string(output)))
	}

	return result, nil
}

func decodeFiscalBridgeResult(output []byte) (map[string]any, error) {
	trimmed := strings.TrimSpace(string(output))
	if trimmed == "" {
		return nil, errors.New("a ponte fiscal local nao retornou resultado")
	}

	decoded := map[string]any{}
	if err := json.Unmarshal([]byte(trimmed), &decoded); err != nil {
		return nil, errors.New("a ponte fiscal local retornou JSON invalido")
	}

	return decoded, nil
}

func resolveBridgeErrorMessage(result map[string]any, rawOutput string) string {
	if message := strings.TrimSpace(stringValueFromMap(result, "message")); message != "" {
		return message
	}

	if message := strings.TrimSpace(stringValueFromMap(result, "error")); message != "" {
		return message
	}

	return strings.TrimSpace(rawOutput)
}

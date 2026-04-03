package main

import (
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

func promptText(label, defaultValue string) (string, error) {
	if strings.TrimSpace(defaultValue) != "" {
		fmt.Printf("%s [%s]: ", label, defaultValue)
	} else {
		fmt.Printf("%s: ", label)
	}

	line, err := readLine()
	if err != nil {
		return "", err
	}

	if strings.TrimSpace(line) == "" {
		return strings.TrimSpace(defaultValue), nil
	}

	return strings.TrimSpace(line), nil
}

func promptRequired(label, defaultValue string) (string, error) {
	for {
		value, err := promptText(label, defaultValue)
		if err != nil {
			return "", err
		}

		if strings.TrimSpace(value) != "" {
			return value, nil
		}

		fmt.Println("Esse campo e obrigatorio.")
	}
}

func promptBool(label string, defaultValue bool) (bool, error) {
	defaultLabel := "N"
	if defaultValue {
		defaultLabel = "S"
	}

	for {
		value, err := promptText(label+" [S/N]", defaultLabel)
		if err != nil {
			return false, err
		}

		switch strings.ToLower(strings.TrimSpace(value)) {
		case "s", "sim", "y", "yes":
			return true, nil
		case "n", "nao", "no":
			return false, nil
		case "":
			return defaultValue, nil
		default:
			fmt.Println("Resposta invalida. Use S ou N.")
		}
	}
}

func promptChoice(label string, options []string, defaultValue string) (string, error) {
	valid := map[string]struct{}{}
	for _, option := range options {
		valid[strings.ToLower(option)] = struct{}{}
	}

	for {
		value, err := promptText(label, defaultValue)
		if err != nil {
			return "", err
		}

		normalized := strings.ToLower(strings.TrimSpace(value))
		if normalized == "" {
			normalized = strings.ToLower(strings.TrimSpace(defaultValue))
		}

		if _, ok := valid[normalized]; ok {
			return normalized, nil
		}

		fmt.Printf("Opcao invalida. Use uma destas: %s\n", strings.Join(options, ", "))
	}
}

func promptFilePath(label, defaultPath, dialogTitle, filter string) (string, error) {
	current := strings.TrimSpace(defaultPath)

	for {
		if current != "" {
			value, err := promptText(label+" (Enter para usar, B para procurar)", current)
			if err != nil {
				return "", err
			}

			switch strings.ToLower(strings.TrimSpace(value)) {
			case "":
				if fileExists(current) {
					return current, nil
				}

				fmt.Println("O arquivo informado nao existe mais.")
			case "b", "browse", "procurar":
				picked, err := openFileDialog(dialogTitle, filter)
				if err != nil {
					return "", err
				}
				if strings.TrimSpace(picked) != "" {
					current = picked
					continue
				}
			default:
				current = value
			}
		} else {
			fmt.Printf("%s. Pressione Enter para procurar ou cole o caminho do arquivo: ", label)
			value, err := readLine()
			if err != nil {
				return "", err
			}

			value = strings.TrimSpace(value)
			if value == "" {
				picked, err := openFileDialog(dialogTitle, filter)
				if err != nil {
					return "", err
				}
				current = strings.TrimSpace(picked)
			} else {
				current = value
			}
		}

		if fileExists(current) {
			return current, nil
		}

		fmt.Println("Arquivo nao encontrado. Tente novamente.")
		current = ""
	}
}

func promptPrinterName(current string) (string, error) {
	printers := listInstalledPrinters()
	if len(printers) > 0 {
		fmt.Println("Impressoras encontradas neste Windows:")
		for index, name := range printers {
			fmt.Printf("  %d. %s\n", index+1, name)
		}

		value, err := promptText("Numero ou nome da impressora", current)
		if err != nil {
			return "", err
		}

		if numeric, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			if numeric >= 1 && numeric <= len(printers) {
				return printers[numeric-1], nil
			}
		}

		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value), nil
		}
	}

	return promptRequired("Nome da impressora do Windows", current)
}

func openFileDialog(title, filter string) (string, error) {
	command := strings.Join([]string{
		"Add-Type -AssemblyName System.Windows.Forms",
		fmt.Sprintf(`$dialog = New-Object System.Windows.Forms.OpenFileDialog`),
		fmt.Sprintf(`$dialog.Title = '%s'`, escapePowerShellSingleQuoted(title)),
		fmt.Sprintf(`$dialog.Filter = '%s'`, escapePowerShellSingleQuoted(filter)),
		`$dialog.Multiselect = $false`,
		`if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }`,
	}, "; ")

	output, err := exec.Command("powershell", "-NoProfile", "-STA", "-Command", command).CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}

		return "", fmt.Errorf("nao foi possivel abrir o seletor de arquivos: %s", message)
	}

	return strings.TrimSpace(string(output)), nil
}

func listInstalledPrinters() []string {
	command := strings.Join([]string{
		`$ErrorActionPreference = 'Stop'`,
		`$printers = Get-Printer | Select-Object -ExpandProperty Name`,
		`if ($printers) { [Console]::Out.Write(($printers -join [Environment]::NewLine)) }`,
	}, "; ")

	output, err := exec.Command("powershell", "-NoProfile", "-Command", command).CombinedOutput()
	if err != nil {
		return nil
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	printers := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			printers = append(printers, line)
		}
	}

	return printers
}

func escapePowerShellSingleQuoted(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func isPlaceholderConfig(config AgentConfig) bool {
	return isPlaceholderValue(config.Backend.BaseURL) || isPlaceholderValue(config.Agent.Key) || isPlaceholderValue(config.Agent.Secret)
}

func isPlaceholderValue(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))

	return normalized == "" ||
		strings.Contains(normalized, "preencher-com-") ||
		strings.Contains(normalized, "alterar-aqui") ||
		strings.Contains(normalized, "seudominio.com")
}

func ensureBootstrapConfig(config AgentConfig) error {
	if isPlaceholderValue(config.Backend.BaseURL) {
		return errors.New("a URL do backend nao foi preenchida")
	}

	if isPlaceholderValue(config.Agent.Key) || isPlaceholderValue(config.Agent.Secret) {
		return errors.New("o JSON nao tem agent_key e agent_secret validos")
	}

	return nil
}

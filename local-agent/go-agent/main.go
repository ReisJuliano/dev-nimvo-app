package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type runtimeOptions struct {
	ConfigPath string
	Once       bool
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "run":
		if err := runAgent(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "serve":
		if err := runServe(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "daemon":
		if err := runDaemon(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "tray":
		if err := runTray(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "install":
		if err := runInstall(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "list-printers":
		if err := runListPrinters(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "local-test":
		if err := runLocalTest(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "status":
		if err := runStatus(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	case "uninstall":
		if err := runUninstall(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
	default:
		printUsage()
		os.Exit(1)
	}
}

func runAgent(args []string) error {
	return runDaemon(args)
}

func runDaemon(args []string) error {
	options, err := parseLocalAgentRuntimeOptions("daemon", args)
	if err != nil {
		return err
	}

	config, err := loadNormalizedAgentConfig(options.ConfigPath)
	if err != nil {
		return err
	}

	var server *httpServerHandle
	if config.LocalAPI.Enabled {
		server, err = startLocalAPIServer(config, &localAgentHTTPServer{
			configPath: options.ConfigPath,
		})
		if err != nil {
			return err
		}
		defer server.Close()

		fmt.Printf("API local do agente ouvindo em %s\n", localAPIBaseURL(config))
	}

	return runHeartbeatLoop(options)
}

func runLocalTest(args []string) error {
	options, err := parseLocalAgentRuntimeOptions("local-test", args)
	if err != nil {
		return err
	}

	config, err := loadNormalizedAgentConfig(options.ConfigPath)
	if err != nil {
		return err
	}

	outputPath, err := printTestReceipt(config.Printer, printTestRequest{
		StoreName: "Nimvo",
		Message:   "Teste local do agente standalone de impressao.",
	})
	if err != nil {
		return err
	}

	if strings.TrimSpace(outputPath) != "" {
		fmt.Printf("Preview PDF salvo em: %s\n", outputPath)
	}

	return nil
}

func runListPrinters(args []string) error {
	fs := flag.NewFlagSet("list-printers", flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}

	for _, name := range listInstalledPrinters() {
		fmt.Println(strings.TrimSpace(name))
	}

	return nil
}

func runHeartbeatLoop(options runtimeOptions) error {
	lastInterval := 3 * time.Second

	for {
		config, err := loadNormalizedAgentConfig(options.ConfigPath)
		if err != nil {
			return err
		}

		interval := time.Duration(maxInt(1, config.Agent.PollInterval)) * time.Second
		lastInterval = interval

		heartbeatErr := sendHeartbeat(config)
		if heartbeatErr != nil {
			fmt.Fprintf(os.Stderr, "Falha no heartbeat do agente: %s\n", heartbeatErr.Error())
		}

		commandErr := pollAndProcessCommands(config)
		if commandErr != nil {
			fmt.Fprintf(os.Stderr, "Falha ao consumir a fila central do agente: %s\n", commandErr.Error())
		}

		if options.Once {
			if heartbeatErr != nil {
				return heartbeatErr
			}
			if commandErr != nil {
				return commandErr
			}
			return nil
		}

		time.Sleep(lastInterval)
	}
}

func sendHeartbeat(config AgentConfig) error {
	if strings.TrimSpace(config.Backend.BaseURL) == "" {
		return errors.New("a URL do backend do Nimvo nao foi configurada")
	}

	if strings.TrimSpace(config.Agent.Key) == "" || strings.TrimSpace(config.Agent.Secret) == "" {
		return errors.New("as credenciais do agente nao foram configuradas")
	}

	payload := heartbeatPayload(config)
	response, err := postBackendJSON(config, "/api/local-agents/heartbeat", payload)
	if err != nil {
		return err
	}

	if pollInterval := maxInt(0, intValueFromMap(response, "config.poll_interval_seconds")); pollInterval > 0 && optionsDiffer(config.Agent.PollInterval, pollInterval) {
		config.Agent.PollInterval = pollInterval
		if err := saveInstalledAgentConfig(config); err != nil {
			return err
		}
	}

	return nil
}

func postBackendJSON(config AgentConfig, uri string, payload any) (map[string]any, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	baseURL := strings.TrimRight(strings.TrimSpace(config.Backend.BaseURL), "/")
	client := &http.Client{
		Timeout: time.Duration(maxInt(1, config.Backend.Timeout)) * time.Second,
	}

	request, err := http.NewRequest(http.MethodPost, baseURL+uri, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-Agent-Key", config.Agent.Key)
	request.Header.Set("X-Agent-Secret", config.Agent.Secret)

	var response *http.Response
	for attempt := 0; attempt < maxInt(1, config.Backend.RetryTimes); attempt++ {
		response, err = client.Do(request.Clone(request.Context()))
		if err == nil {
			break
		}

		if attempt+1 < maxInt(1, config.Backend.RetryTimes) {
			time.Sleep(time.Duration(maxInt(100, config.Backend.RetrySleepMS)) * time.Millisecond)
		}
	}
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	decoded := map[string]any{}
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return nil, err
	}

	if response.StatusCode >= 400 {
		message := strings.TrimSpace(stringValueFromMap(decoded, "message"))
		if message == "" {
			message = strings.TrimSpace(stringValueFromMap(decoded, "error"))
		}
		if message == "" {
			message = fmt.Sprintf("backend retornou HTTP %d", response.StatusCode)
		}

		return nil, errors.New(message)
	}

	return decoded, nil
}

func heartbeatPayload(config AgentConfig) map[string]any {
	hostName, _ := os.Hostname()
	userName := strings.TrimSpace(os.Getenv("USERNAME"))

	return map[string]any{
		"supported_types": supportedCommandTypes,
		"machine": map[string]any{
			"name": hostName,
			"user": userName,
		},
		"certificate": map[string]any{
			"path": strings.TrimSpace(config.Certificate.Path),
		},
		"printer": map[string]any{
			"enabled":     config.Printer.Enabled,
			"connector":   config.Printer.Connector,
			"name":        config.Printer.Name,
			"host":        config.Printer.Host,
			"port":        config.Printer.Port,
			"logo_path":   config.Printer.LogoPath,
			"output_path": config.Printer.OutputPath,
		},
		"local_api": map[string]any{
			"enabled": config.LocalAPI.Enabled,
			"host":    config.LocalAPI.Host,
			"port":    config.LocalAPI.Port,
			"url":     localAPIBaseURL(config),
		},
		"software": map[string]any{
			"version":      localAgentVersion,
			"project_root": "",
			"php_path":     "",
			"installed_at": time.Now().Format(time.RFC3339),
			"config_path":  "registry://HKCU/Software/NimvoFiscalAgent",
		},
	}
}

func parseLocalAgentRuntimeOptions(command string, args []string) (runtimeOptions, error) {
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	configPath := fs.String("config", "", "Arquivo JSON apenas para bootstrap ou override do agente")
	once := fs.Bool("once", false, "Executa um unico ciclo de heartbeat")

	if err := fs.Parse(args); err != nil {
		return runtimeOptions{}, err
	}

	return runtimeOptions{
		ConfigPath: strings.TrimSpace(*configPath),
		Once:       *once,
	}, nil
}

func printUsage() {
	fmt.Println("nimvo-fiscal-agent")
	fmt.Println("")
	fmt.Println("Comandos:")
	fmt.Println("  install    Instala o agente local do Nimvo e configura a inicializacao automatica")
	fmt.Println("  serve      Sobe somente a API HTTP local para a ponte de impressao")
	fmt.Println("  daemon     Sobe a API local e envia heartbeat para o backend do Nimvo")
	fmt.Println("  tray       Sobe o agente em segundo plano com icone na bandeja do Windows")
	fmt.Println("  run        Alias de daemon")
	fmt.Println("  list-printers Lista as impressoras Windows compativeis com o Nimvo")
	fmt.Println("  local-test Imprime um cupom de teste usando a configuracao instalada")
	fmt.Println("  status     Mostra o estado da instalacao local")
	fmt.Println("  uninstall  Remove a inicializacao automatica e a configuracao local do agente")
	fmt.Println("")
	fmt.Println("Exemplos:")
	fmt.Println(`  nimvo-fiscal-agent install`)
	fmt.Println(`  nimvo-fiscal-agent list-printers`)
	fmt.Println(`  nimvo-fiscal-agent tray`)
	fmt.Println(`  nimvo-fiscal-agent daemon`)
	fmt.Println(`  nimvo-fiscal-agent serve`)
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}

	return b
}

func optionsDiffer(current, next int) bool {
	return maxInt(1, current) != maxInt(1, next)
}

func intValueFromMap(payload map[string]any, path string) int {
	current := any(payload)
	for _, segment := range strings.Split(path, ".") {
		asMap, ok := current.(map[string]any)
		if !ok {
			return 0
		}

		current, ok = asMap[segment]
		if !ok {
			return 0
		}
	}

	switch value := current.(type) {
	case float64:
		return int(value)
	case int:
		return value
	default:
		return 0
	}
}

func stringValueFromMap(payload map[string]any, path string) string {
	current := any(payload)
	for _, segment := range strings.Split(path, ".") {
		asMap, ok := current.(map[string]any)
		if !ok {
			return ""
		}

		current, ok = asMap[segment]
		if !ok {
			return ""
		}
	}

	if value, ok := current.(string); ok {
		return value
	}

	return ""
}

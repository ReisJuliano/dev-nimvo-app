package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

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
	case "install":
		if err := runInstall(os.Args[2:]); err != nil {
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
	fs := flag.NewFlagSet("run", flag.ContinueOnError)
	configPath := fs.String("config", "", "Caminho do JSON do agente")
	projectRoot := fs.String("project-root", defaultProjectRoot(), "Pasta raiz do projeto Laravel")
	phpPath := fs.String("php", "", "Caminho do php.exe")
	once := fs.Bool("once", false, "Executa um unico ciclo")

	if err := fs.Parse(args); err != nil {
		return err
	}

	if *configPath == "" {
		return errors.New("informe -config com o arquivo JSON do agente")
	}

	commandArgs := []string{"artisan", "fiscal:agent:run", *configPath}
	if *once {
		commandArgs = append(commandArgs, "--once")
	}

	return runPHP(*phpPath, *projectRoot, commandArgs...)
}

func runLocalTest(args []string) error {
	fs := flag.NewFlagSet("local-test", flag.ContinueOnError)
	configPath := fs.String("config", "", "Caminho do JSON do agente")
	projectRoot := fs.String("project-root", defaultProjectRoot(), "Pasta raiz do projeto Laravel")
	phpPath := fs.String("php", "", "Caminho do php.exe")
	tenantID := fs.String("tenant", "", "Tenant para o ensaio local")
	saleID := fs.String("sale", "", "ID da venda para o ensaio local")
	saveDir := fs.String("save-dir", "storage/app/fiscal-local-tests", "Pasta para salvar XML e resultado")

	if err := fs.Parse(args); err != nil {
		return err
	}

	if *configPath == "" || *tenantID == "" || *saleID == "" {
		return errors.New("informe -config, -tenant e -sale para o ensaio local")
	}

	commandArgs := []string{
		"artisan",
		"fiscal:sale:local-test",
		*tenantID,
		*saleID,
		*configPath,
		fmt.Sprintf("--save-dir=%s", *saveDir),
	}

	return runPHP(*phpPath, *projectRoot, commandArgs...)
}

func runPHP(explicitPHP, projectRoot string, args ...string) error {
	phpBinary, err := resolvePHP(explicitPHP)
	if err != nil {
		return err
	}

	root, err := filepath.Abs(projectRoot)
	if err != nil {
		return err
	}

	cmd := exec.Command(phpBinary, args...)
	cmd.Dir = root
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	return cmd.Run()
}

func resolvePHP(explicit string) (string, error) {
	candidates := []string{}

	if explicit != "" {
		candidates = append(candidates, explicit)
	}

	if envPHP := os.Getenv("PHP_BIN"); envPHP != "" {
		candidates = append(candidates, envPHP)
	}

	if lookedUp, err := exec.LookPath("php"); err == nil {
		candidates = append(candidates, lookedUp)
	}

	candidates = append(candidates,
		`C:\php-8.3.30-nts-Win32-vs16-x64\php.exe`,
		`C:\xampp\php\php.exe`,
	)

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}

		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", errors.New("php.exe nao encontrado. Use -php ou defina PHP_BIN")
}

func defaultProjectRoot() string {
	exePath, err := os.Executable()
	if err != nil {
		return "."
	}

	return filepath.Clean(filepath.Join(filepath.Dir(exePath), "..", ".."))
}

func printUsage() {
	fmt.Println("nimvo-fiscal-agent")
	fmt.Println("")
	fmt.Println("Comandos:")
	fmt.Println("  install    Instala o agente no Windows e configura a inicializacao automatica")
	fmt.Println("  run        Executa o agente fiscal client-side")
	fmt.Println("  local-test Faz um ensaio local da NFC-e a partir de uma venda")
	fmt.Println("  status     Mostra o estado da instalacao local")
	fmt.Println("  uninstall  Remove a inicializacao automatica do agente")
	fmt.Println("")
	fmt.Println("Exemplos:")
	fmt.Println(`  nimvo-fiscal-agent install -project-root "D:\nimvo"`)
	fmt.Println(`  nimvo-fiscal-agent run -config "D:\app\agent.json"`)
	fmt.Println(`  nimvo-fiscal-agent local-test -config "D:\app\agent.json" -tenant tenant-teste -sale 6`)
}

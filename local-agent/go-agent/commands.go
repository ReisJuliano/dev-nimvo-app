package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type polledAgentCommand struct {
	ID       string
	Type     string
	Payload  map[string]any
	Attempts int
}

func pollAndProcessCommands(config AgentConfig) error {
	for {
		command, err := pollNextCommand(config)
		if err != nil {
			return err
		}

		if command == nil {
			return nil
		}

		result, execErr := executePolledCommand(config, *command)
		if completeErr := completePolledCommand(config, command.ID, result, execErr); completeErr != nil {
			return completeErr
		}

		if execErr != nil {
			fmt.Fprintf(os.Stderr, "Falha ao executar comando %s (%s): %s\n", command.ID, command.Type, execErr.Error())
		}
	}
}

func pollNextCommand(config AgentConfig) (*polledAgentCommand, error) {
	response, err := postBackendJSON(config, "/api/local-agents/commands/poll", map[string]any{
		"supported_types": supportedCommandTypesForConfig(config),
	})
	if err != nil {
		return nil, err
	}

	commandPayload, ok := response["command"].(map[string]any)
	if !ok || commandPayload == nil {
		return nil, nil
	}

	commandID := strings.TrimSpace(stringValueFromMap(response, "command.id"))
	commandType := strings.TrimSpace(stringValueFromMap(response, "command.type"))
	if commandID == "" || commandType == "" {
		return nil, nil
	}

	payload, _ := commandPayload["payload"].(map[string]any)

	return &polledAgentCommand{
		ID:       commandID,
		Type:     commandType,
		Payload:  payload,
		Attempts: intValueFromMap(response, "command.attempts"),
	}, nil
}

func executePolledCommand(config AgentConfig, command polledAgentCommand) (result map[string]any, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("falha inesperada no agente local ao executar %s: %v", command.Type, recovered)
			result = nil
			fmt.Fprintf(os.Stderr, "panic ao executar comando %s (%s): %v\n", command.ID, command.Type, recovered)
		}
	}()

	switch command.Type {
	case "emit_nfce", "cancel_fiscal_document":
		return executeFiscalBridgeCommand(config, command)
	case "print_test":
		payload := printTestRequest{}
		if err := decodeCommandPayload(command.Payload, &payload); err != nil {
			return nil, err
		}

		outputPath, err := executeLocalPrint(config, "/v1/prints/test", payload, func() (string, error) {
			return printTestReceipt(config.Printer, payload)
		})
		if err != nil {
			return nil, err
		}

		result := map[string]any{
			"message":    "Teste enviado para a impressora local.",
			"printed_at": time.Now().Format(time.RFC3339),
		}
		if strings.TrimSpace(outputPath) != "" {
			result["message"] = "Preview PDF do teste gerado com sucesso."
			result["output_file"] = outputPath
		}

		return result, nil
	case "print_payment_receipt":
		payload := paymentReceiptRequest{}
		if err := decodeCommandPayload(command.Payload, &payload); err != nil {
			return nil, err
		}

		outputPath, err := executeLocalPrint(config, "/v1/prints/payment-receipt", payload, func() (string, error) {
			return printPaymentReceipt(config.Printer, payload)
		})
		if err != nil {
			return nil, err
		}

		result := map[string]any{
			"message":     "Comprovante enviado para a impressora local.",
			"printed_at":  time.Now().Format(time.RFC3339),
			"sale_number": payload.SaleNumber,
		}
		if strings.TrimSpace(outputPath) != "" {
			result["message"] = "Preview PDF do comprovante gerado com sucesso."
			result["output_file"] = outputPath
		}

		return result, nil
	case "print_fiscal_receipt":
		payload := fiscalReceiptRequest{}
		if err := decodeCommandPayload(command.Payload, &payload); err != nil {
			return nil, err
		}

		outputPath, err := executeLocalPrint(config, "/v1/prints/fiscal-receipt", payload, func() (string, error) {
			return printFiscalReceipt(config.Printer, payload)
		})
		if err != nil {
			return nil, err
		}

		result := map[string]any{
			"message":    "Cupom fiscal enviado para a impressora local.",
			"printed_at": time.Now().Format(time.RFC3339),
		}
		if strings.TrimSpace(outputPath) != "" {
			result["output_file"] = outputPath
		}

		return result, nil
	case "print_operation_receipt":
		payload := operationReceiptRequest{}
		if err := decodeCommandPayload(command.Payload, &payload); err != nil {
			return nil, err
		}

		outputPath, err := executeLocalPrint(config, "/v1/prints/operation-receipt", payload, func() (string, error) {
			return printOperationReceipt(config.Printer, payload)
		})
		if err != nil {
			return nil, err
		}

		result := map[string]any{
			"message":    "Comprovante operacional enviado para a impressora local.",
			"printed_at": time.Now().Format(time.RFC3339),
			"type":       payload.Type,
		}
		if strings.TrimSpace(outputPath) != "" {
			result["output_file"] = outputPath
		}

		return result, nil
	default:
		return nil, fmt.Errorf("tipo de comando nao suportado neste agente: %s", command.Type)
	}
}

func completePolledCommand(config AgentConfig, commandID string, result map[string]any, execErr error) error {
	payload := map[string]any{}

	if execErr != nil {
		payload["successful"] = false
		payload["message"] = execErr.Error()
		payload["error"] = execErr.Error()
	} else {
		payload["successful"] = true
	}

	for key, value := range result {
		payload[key] = value
	}

	_, err := postBackendJSON(config, "/api/local-agents/commands/"+commandID+"/complete", payload)
	return err
}

func decodeCommandPayload(payload map[string]any, target any) error {
	if payload == nil {
		return errors.New("o comando retornou sem payload para processamento")
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return errors.New("nao foi possivel preparar o payload do comando")
	}

	if err := json.Unmarshal(encoded, target); err != nil {
		return errors.New("o payload do comando e invalido para este agente")
	}

	return nil
}

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const localAgentVersion = "nimvo-go-agent"

type localAgentHTTPServer struct {
	configPath string
}

type httpServerHandle struct {
	server *http.Server
}

type printTestRequest struct {
	StoreName string `json:"store_name"`
	Message   string `json:"message"`
}

type localAPIResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

func runServe(args []string) error {
	options, err := parseLocalAgentRuntimeOptions("serve", args)
	if err != nil {
		return err
	}

	config, err := loadNormalizedAgentConfig(options.ConfigPath)
	if err != nil {
		return err
	}

	if !config.LocalAPI.Enabled {
		return errors.New("a API local do agente esta desativada neste JSON")
	}

	server := &localAgentHTTPServer{
		configPath: options.ConfigPath,
	}

	fmt.Printf("API local do agente ouvindo em %s\n", localAPIBaseURL(config))

	return serveLocalAPI(config, server)
}

func serveLocalAPI(config AgentConfig, handler http.Handler) error {
	address := fmt.Sprintf("%s:%d", config.LocalAPI.Host, config.LocalAPI.Port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("nao foi possivel iniciar a API local em %s: %w", address, err)
	}
	defer listener.Close()

	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	return server.Serve(listener)
}

func startLocalAPIServer(config AgentConfig, handler http.Handler) (*httpServerHandle, error) {
	address := fmt.Sprintf("%s:%d", config.LocalAPI.Host, config.LocalAPI.Port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return nil, fmt.Errorf("nao foi possivel iniciar a API local em %s: %w", address, err)
	}

	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		_ = server.Serve(listener)
	}()

	return &httpServerHandle{server: server}, nil
}

func (handle *httpServerHandle) Close() error {
	if handle == nil || handle.server == nil {
		return nil
	}

	return handle.server.Close()
}

func (server *localAgentHTTPServer) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	server.writeCORSHeaders(writer)
	if request.Method == http.MethodOptions {
		writer.WriteHeader(http.StatusNoContent)
		return
	}

	switch {
	case request.URL.Path == "/health" && request.Method == http.MethodGet:
		server.handleHealth(writer)
	case request.URL.Path == "/v1/printers" && request.Method == http.MethodGet:
		if !server.authorize(writer, request) {
			return
		}
		server.handlePrinters(writer)
	case request.URL.Path == "/v1/prints/test" && request.Method == http.MethodPost:
		if !server.authorize(writer, request) {
			return
		}
		server.handlePrintTest(writer, request)
	case request.URL.Path == "/v1/prints/payment-receipt" && request.Method == http.MethodPost:
		if !server.authorize(writer, request) {
			return
		}
		server.handlePaymentReceipt(writer, request)
	default:
		server.writeJSON(writer, http.StatusNotFound, localAPIResponse{
			Status: "not_found",
			Error:  "rota local do agente nao encontrada",
		})
	}
}

func (server *localAgentHTTPServer) handleHealth(writer http.ResponseWriter) {
	config, err := loadNormalizedAgentConfig(server.configPath)
	if err != nil {
		server.writeJSON(writer, http.StatusInternalServerError, localAPIResponse{
			Status: "error",
			Error:  err.Error(),
		})
		return
	}

	server.writeJSON(writer, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": localAgentVersion,
		"local_api": map[string]any{
			"enabled": config.LocalAPI.Enabled,
			"url":     localAPIBaseURL(config),
			"host":    config.LocalAPI.Host,
			"port":    config.LocalAPI.Port,
		},
		"printer": map[string]any{
			"enabled":   config.Printer.Enabled,
			"connector": config.Printer.Connector,
			"target":    printerTarget(config.Printer),
		},
	})
}

func (server *localAgentHTTPServer) handlePrinters(writer http.ResponseWriter) {
	server.writeJSON(writer, http.StatusOK, map[string]any{
		"status":   "ok",
		"printers": listInstalledPrinters(),
	})
}

func (server *localAgentHTTPServer) handlePrintTest(writer http.ResponseWriter, request *http.Request) {
	payload := printTestRequest{}
	if err := server.decodeJSONBody(request, &payload); err != nil {
		server.writeJSON(writer, http.StatusBadRequest, localAPIResponse{
			Status: "invalid_request",
			Error:  err.Error(),
		})
		return
	}

	config, err := loadNormalizedAgentConfig(server.configPath)
	if err != nil {
		server.writeJSON(writer, http.StatusInternalServerError, localAPIResponse{
			Status: "error",
			Error:  err.Error(),
		})
		return
	}

	if err := printTestReceipt(config.Printer, payload); err != nil {
		server.writeJSON(writer, http.StatusBadGateway, localAPIResponse{
			Status: "print_failed",
			Error:  err.Error(),
		})
		return
	}

	server.writeJSON(writer, http.StatusOK, map[string]any{
		"status":     "printed",
		"type":       "test",
		"printed_at": time.Now().Format(time.RFC3339),
	})
}

func (server *localAgentHTTPServer) handlePaymentReceipt(writer http.ResponseWriter, request *http.Request) {
	payload := paymentReceiptRequest{}
	if err := server.decodeJSONBody(request, &payload); err != nil {
		server.writeJSON(writer, http.StatusBadRequest, localAPIResponse{
			Status: "invalid_request",
			Error:  err.Error(),
		})
		return
	}

	config, err := loadNormalizedAgentConfig(server.configPath)
	if err != nil {
		server.writeJSON(writer, http.StatusInternalServerError, localAPIResponse{
			Status: "error",
			Error:  err.Error(),
		})
		return
	}

	if err := printPaymentReceipt(config.Printer, payload); err != nil {
		server.writeJSON(writer, http.StatusBadGateway, localAPIResponse{
			Status: "print_failed",
			Error:  err.Error(),
		})
		return
	}

	server.writeJSON(writer, http.StatusOK, map[string]any{
		"status":     "printed",
		"type":       "payment_receipt",
		"printed_at": time.Now().Format(time.RFC3339),
	})
}

func (server *localAgentHTTPServer) authorize(writer http.ResponseWriter, request *http.Request) bool {
	config, err := loadNormalizedAgentConfig(server.configPath)
	if err != nil {
		server.writeJSON(writer, http.StatusInternalServerError, localAPIResponse{
			Status: "error",
			Error:  err.Error(),
		})
		return false
	}

	headerValue := strings.TrimSpace(request.Header.Get("X-Nimvo-Agent-Key"))
	if headerValue == "" || headerValue != strings.TrimSpace(config.Agent.Key) {
		server.writeJSON(writer, http.StatusUnauthorized, localAPIResponse{
			Status: "unauthorized",
			Error:  "cabecalho X-Nimvo-Agent-Key invalido",
		})
		return false
	}

	return true
}

func (server *localAgentHTTPServer) decodeJSONBody(request *http.Request, target any) error {
	body, err := io.ReadAll(io.LimitReader(request.Body, 1<<20))
	if err != nil {
		return errors.New("nao foi possivel ler o corpo da requisicao")
	}

	if len(bytes.TrimSpace(body)) == 0 {
		return nil
	}

	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		return errors.New("o JSON enviado para a API local e invalido")
	}

	return nil
}

func (server *localAgentHTTPServer) writeCORSHeaders(writer http.ResponseWriter) {
	headers := writer.Header()
	headers.Set("Access-Control-Allow-Origin", "*")
	headers.Set("Access-Control-Allow-Headers", "Content-Type, X-Nimvo-Agent-Key")
	headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	headers.Set("Content-Type", "application/json; charset=utf-8")
}

func (server *localAgentHTTPServer) writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.WriteHeader(status)
	encoded, _ := json.Marshal(payload)
	_, _ = writer.Write(encoded)
}

func loadNormalizedAgentConfig(path string) (AgentConfig, error) {
	if strings.TrimSpace(path) == "" {
		return loadInstalledAgentConfig()
	}

	config, err := loadAgentConfig(path)
	if err != nil {
		return AgentConfig{}, err
	}

	return normalizeAgentConfig(config), nil
}

func localAPIBaseURL(config AgentConfig) string {
	return fmt.Sprintf("http://%s:%d", config.LocalAPI.Host, config.LocalAPI.Port)
}

func printerTarget(config PrinterConfig) string {
	if strings.EqualFold(strings.TrimSpace(config.Connector), "tcp") || strings.EqualFold(strings.TrimSpace(config.Connector), "network") {
		return fmt.Sprintf("%s:%d", config.Host, config.Port)
	}

	return config.Name
}

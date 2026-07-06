package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSupportedCommandTypesForConfigWithoutBridge(t *testing.T) {
	config := defaultAgentConfig()
	supported := supportedCommandTypesForConfig(config)
	expected := []string{"print_payment_receipt", "print_test", "print_fiscal_receipt", "print_operation_receipt", "print_label"}

	if len(supported) != len(expected) {
		t.Fatalf("expected %v, got %v", expected, supported)
	}

	for index, item := range expected {
		if supported[index] != item {
			t.Fatalf("expected supported[%d] to be %q, got %q", index, item, supported[index])
		}
	}
}

func TestSupportedCommandTypesForConfigWithBridge(t *testing.T) {
	tempDir := t.TempDir()
	bridgeRoot := filepath.Join(tempDir, "bridge")
	phpBinary := filepath.Join(tempDir, "php.exe")

	if err := os.MkdirAll(bridgeRoot, 0o755); err != nil {
		t.Fatalf("failed to create bridge root: %v", err)
	}

	if err := os.WriteFile(filepath.Join(bridgeRoot, bundledFiscalBridgeEntryPoint), []byte("bridge"), 0o644); err != nil {
		t.Fatalf("failed to create bridge file: %v", err)
	}

	if err := os.MkdirAll(filepath.Join(bridgeRoot, "vendor"), 0o755); err != nil {
		t.Fatalf("failed to create vendor directory: %v", err)
	}

	if err := os.WriteFile(filepath.Join(bridgeRoot, "vendor", "autoload.php"), []byte("autoload"), 0o644); err != nil {
		t.Fatalf("failed to create vendor autoload file: %v", err)
	}

	if err := os.WriteFile(phpBinary, []byte("php"), 0o644); err != nil {
		t.Fatalf("failed to create php binary placeholder: %v", err)
	}

	config := defaultAgentConfig()
	config.Software.BridgeRoot = bridgeRoot
	config.Software.PHPPath = phpBinary

	supported := supportedCommandTypesForConfig(config)
	expected := []string{"print_payment_receipt", "print_test", "print_fiscal_receipt", "print_operation_receipt", "print_label"}

	if len(supported) != len(expected) {
		t.Fatalf("expected %v, got %v", expected, supported)
	}

	for index, item := range expected {
		if supported[index] != item {
			t.Fatalf("expected supported[%d] to be %q, got %q", index, item, supported[index])
		}
	}
}

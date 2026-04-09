package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSupportedCommandTypesForConfigWithoutBridge(t *testing.T) {
	config := defaultAgentConfig()
	supported := supportedCommandTypesForConfig(config)

	if len(supported) != 2 {
		t.Fatalf("expected print-only support without bridge, got %v", supported)
	}

	if supported[0] != "print_payment_receipt" || supported[1] != "print_test" {
		t.Fatalf("unexpected supported types without bridge: %v", supported)
	}
}

func TestSupportedCommandTypesForConfigWithBridge(t *testing.T) {
	tempDir := t.TempDir()
	projectRoot := filepath.Join(tempDir, "nimvo")
	phpBinary := filepath.Join(tempDir, "php.exe")

	if err := os.MkdirAll(projectRoot, 0o755); err != nil {
		t.Fatalf("failed to create project root: %v", err)
	}

	if err := os.WriteFile(filepath.Join(projectRoot, "artisan"), []byte("artisan"), 0o644); err != nil {
		t.Fatalf("failed to create artisan file: %v", err)
	}

	if err := os.WriteFile(phpBinary, []byte("php"), 0o644); err != nil {
		t.Fatalf("failed to create php binary placeholder: %v", err)
	}

	config := defaultAgentConfig()
	config.Software.ProjectRoot = projectRoot
	config.Software.PHPPath = phpBinary

	supported := supportedCommandTypesForConfig(config)
	expected := []string{"emit_nfce", "cancel_fiscal_document", "invalidate_fiscal_range", "print_payment_receipt", "print_test"}

	if len(supported) != len(expected) {
		t.Fatalf("expected %v, got %v", expected, supported)
	}

	for index, item := range expected {
		if supported[index] != item {
			t.Fatalf("expected supported[%d] to be %q, got %q", index, item, supported[index])
		}
	}
}

package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalizeInstallationCertificateClearsPasswordWithoutPath(t *testing.T) {
	certificate := normalizeInstallationCertificate(Certificate{
		Path:     "   ",
		Password: "secret",
	})

	if certificate.Path != "" {
		t.Fatalf("expected empty certificate path, got %q", certificate.Path)
	}

	if certificate.Password != "" {
		t.Fatalf("expected empty certificate password, got %q", certificate.Password)
	}
}

func TestValidateInstallationCertificateAcceptsExistingFile(t *testing.T) {
	tempDir := t.TempDir()
	certificatePath := filepath.Join(tempDir, "certificado.pfx")

	if err := saveAgentConfig(filepath.Join(tempDir, "config.json"), defaultAgentConfig()); err != nil {
		t.Fatalf("failed to prepare temp dir: %v", err)
	}

	if err := copyFile(filepath.Join(tempDir, "config.json"), certificatePath); err != nil {
		t.Fatalf("failed to create temp certificate file: %v", err)
	}

	certificate := normalizeInstallationCertificate(Certificate{
		Path:     certificatePath,
		Password: "123456",
	})

	if err := validateInstallationCertificate(certificate); err != nil {
		t.Fatalf("expected certificate path to be accepted, got %v", err)
	}
}

func TestValidateInstallationCertificateRejectsMissingFile(t *testing.T) {
	certificate := normalizeInstallationCertificate(Certificate{
		Path:     filepath.Join(t.TempDir(), "ausente.pfx"),
		Password: "123456",
	})

	if err := validateInstallationCertificate(certificate); err == nil {
		t.Fatal("expected missing certificate file to be rejected")
	}
}

func TestBuildUninstallScriptUsesPurgeFlag(t *testing.T) {
	script := buildUninstallScript(`C:\Nimvo\bin\nimvo-fiscal-agent.exe`, `C:\Nimvo`)

	if !strings.Contains(script, `uninstall -install-dir "C:\Nimvo" --purge`) {
		t.Fatalf("expected uninstall script to use purge flag, got %q", script)
	}
}

func TestPathWithinRoot(t *testing.T) {
	if !pathWithinRoot(`C:\Nimvo\bin\nimvo-fiscal-agent.exe`, `C:\Nimvo`) {
		t.Fatal("expected executable inside install root to be detected")
	}

	if pathWithinRoot(`C:\Outro\bin\nimvo-fiscal-agent.exe`, `C:\Nimvo`) {
		t.Fatal("expected executable outside install root to be rejected")
	}
}

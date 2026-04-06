package main

import (
	"path/filepath"
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

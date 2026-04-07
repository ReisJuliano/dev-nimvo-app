package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type workspaceSnapshot struct {
	TenantID  string          `json:"tenant_id"`
	UpdatedAt string          `json:"updated_at"`
	Workspace json.RawMessage `json:"workspace"`
}

func loadWorkspaceSnapshot(tenantID string) (workspaceSnapshot, error) {
	targetPath, err := workspaceSnapshotPath(tenantID)
	if err != nil {
		return workspaceSnapshot{}, err
	}

	content, err := os.ReadFile(targetPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return workspaceSnapshot{}, os.ErrNotExist
		}

		return workspaceSnapshot{}, err
	}

	var snapshot workspaceSnapshot
	if err := json.Unmarshal(content, &snapshot); err != nil {
		return workspaceSnapshot{}, err
	}

	return snapshot, nil
}

func saveWorkspaceSnapshot(tenantID string, workspace json.RawMessage) (workspaceSnapshot, error) {
	targetPath, err := workspaceSnapshotPath(tenantID)
	if err != nil {
		return workspaceSnapshot{}, err
	}

	if err := ensureDir(filepath.Dir(targetPath)); err != nil {
		return workspaceSnapshot{}, err
	}

	snapshot := workspaceSnapshot{
		TenantID:  strings.TrimSpace(tenantID),
		UpdatedAt: time.Now().Format(time.RFC3339),
		Workspace: workspace,
	}

	content, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return workspaceSnapshot{}, err
	}

	if err := os.WriteFile(targetPath, append(content, '\n'), 0o644); err != nil {
		return workspaceSnapshot{}, err
	}

	return snapshot, nil
}

func workspaceSnapshotPath(tenantID string) (string, error) {
	normalizedTenantID := sanitizeWorkspaceTenantID(tenantID)
	if normalizedTenantID == "" {
		return "", errors.New("tenant_id invalido para o workspace offline local")
	}

	return filepath.Join(localAgentDataDir(), "workspaces", normalizedTenantID+".json"), nil
}

func localAgentDataDir() string {
	executablePath, err := os.Executable()
	if err == nil {
		installRoot := filepath.Dir(filepath.Dir(executablePath))
		if strings.TrimSpace(installRoot) != "" {
			return filepath.Join(installRoot, "data")
		}
	}

	return filepath.Join(defaultInstallDir(), "data")
}

func sanitizeWorkspaceTenantID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	var builder strings.Builder
	for _, character := range value {
		switch {
		case character >= 'a' && character <= 'z':
			builder.WriteRune(character)
		case character >= 'A' && character <= 'Z':
			builder.WriteRune(character)
		case character >= '0' && character <= '9':
			builder.WriteRune(character)
		case character == '-' || character == '_' || character == '.':
			builder.WriteRune(character)
		default:
			builder.WriteRune('_')
		}
	}

	return strings.Trim(builder.String(), "._")
}

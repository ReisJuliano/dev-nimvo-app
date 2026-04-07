import { useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import ActionButton from '@/Components/UI/ActionButton'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'
import AppLayout from '@/Layouts/AppLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import useModules from '@/hooks/useModules'
import { CUSTOM_PRESET } from '@/lib/modules'
import { apiRequest } from '@/lib/http'
import './settings.css'

function getValueByPath(object, path) {
    return path.split('.').reduce((current, segment) => current?.[segment], object)
}

function setValueByPath(object, path, value) {
    const segments = path.split('.')
    const nextObject = { ...object }
    let cursor = nextObject

    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            cursor[segment] = value
            return
        }

        cursor[segment] = { ...cursor[segment] }
        cursor = cursor[segment]
    })

    return nextObject
}

export default function SettingsIndex({ settings, businessPresets, generalOptions, moduleSections }) {
    const [form, setForm] = useState(settings)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const moduleState = useModules(form)
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })
    const enabledModulesCount = Object.values(moduleState.modules || {}).filter(Boolean).length
    const enabledCapabilitiesCount = Object.values(moduleState.capabilities || {}).filter(Boolean).length
    const activePreset = form.business?.preset || CUSTOM_PRESET
    const activeLabels = useMemo(
        () =>
            moduleSections
                .flatMap((section) => section.items)
                .filter((item) => moduleState.modules?.[item.key])
                .map((item) => item.label),
        [moduleSections, moduleState.modules],
    )

    function handleToggle(path) {
        setForm((current) => {
            const next = setValueByPath(current, path, !getValueByPath(current, path))

            if (path.startsWith('modules.')) {
                next.business = {
                    ...next.business,
                    preset: CUSTOM_PRESET,
                }
            }

            return next
        })
    }

    function applyPreset(preset) {
        setForm((current) => ({
            ...current,
            business: {
                ...current.business,
                preset: preset.key,
            },
            modules: { ...preset.modules },
        }))

        setFeedback({
            type: 'info',
            text: `Preset ${preset.label} aplicado localmente. Salve para publicar no tenant.`,
        })
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/api/settings', {
                method: 'put',
                data: form,
            })

            setForm(response.settings)
            setFeedback({ type: 'success', text: response.message })
            router.reload()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <AppLayout title="Configuracoes" settingsOverride={form}>
            <div className="settings-page">
                <form className="settings-form" onSubmit={handleSubmit}>
                    <PageContainer
                        sidebar={(
                            <RightSidebarPanel>
                                <RightSidebarSection title="Contexto" subtitle="Estado atual">
                                    <div className="right-sidebar-meta">
                                        <div className="right-sidebar-meta-item">
                                            <span>Preset</span>
                                            <strong>{moduleState.presetLabel}</strong>
                                        </div>
                                        <div className="right-sidebar-meta-item">
                                            <span>Modulos ativos</span>
                                            <strong>{enabledModulesCount}</strong>
                                        </div>
                                        <div className="right-sidebar-meta-item">
                                            <span>Telas visiveis</span>
                                            <strong>{enabledCapabilitiesCount}</strong>
                                        </div>
                                    </div>
                                </RightSidebarSection>

                                <RightSidebarSection title="Ativos" subtitle="Resumo rapido">
                                    <div className="settings-summary-badges">
                                        {activeLabels.slice(0, 6).map((label) => (
                                            <span key={label} className="settings-summary-badge">
                                                {label}
                                            </span>
                                        ))}
                                        {activeLabels.length > 6 ? (
                                            <span className="settings-summary-badge muted">+{activeLabels.length - 6}</span>
                                        ) : null}
                                    </div>
                                </RightSidebarSection>

                                <RightSidebarSection title="Publicar" subtitle="Aplicar no tenant">
                                    {feedback ? (
                                        <div className={`settings-feedback ${feedback.type}`}>
                                            <strong>{feedback.text}</strong>
                                        </div>
                                    ) : (
                                        <div className="settings-feedback neutral">
                                            <strong>O menu lateral ja acompanha os modulos do formulario atual.</strong>
                                        </div>
                                    )}

                                    <ActionButton icon="fa-floppy-disk" type="submit" disabled={saving}>
                                        {saving ? 'Salvando...' : 'Salvar configuracoes'}
                                    </ActionButton>
                                </RightSidebarSection>
                            </RightSidebarPanel>
                        )}
                    >
                        <section className="settings-section">
                            <div className="settings-section-header">
                                <div>
                                    <h2>Presets</h2>
                                </div>
                            </div>

                            <div className="settings-preset-grid">
                                {businessPresets.map((preset) => {
                                    const isActive = preset.key === activePreset
                                    const activeCount = Object.values(preset.modules || {}).filter(Boolean).length

                                    return (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            className={`settings-preset-card ${isActive ? 'active' : ''}`}
                                            onClick={() => applyPreset(preset)}
                                        >
                                            <div className="settings-preset-top">
                                                <span>{preset.label}</span>
                                                <strong>{activeCount} modulos</strong>
                                            </div>
                                            <small>{isActive ? 'Ativo' : 'Aplicar'}</small>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        {generalOptions.map((option) => {
                            const active = Boolean(getValueByPath(form, option.key))

                            return (
                                <section key={option.key} className={`settings-inline-option ${active ? 'active' : ''}`}>
                                    <div>
                                        <strong>{option.label}</strong>
                                        <p>{option.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={`settings-toggle-button ${active ? 'active' : ''}`}
                                        onClick={() => handleToggle(option.key)}
                                    >
                                        <span>{active ? 'Ativado' : 'Desativado'}</span>
                                    </button>
                                </section>
                            )
                        })}

                        <section className="settings-section">
                            <div className="settings-section-header">
                                <div>
                                    <h2>Modulos por area</h2>
                                </div>
                            </div>

                            <div className="settings-modules-stack">
                                {moduleSections.map((section) => (
                                    <section key={section.section} className="settings-module-section">
                                        <header>
                                            <div>
                                                <strong>{section.section}</strong>
                                                <small>
                                                    {section.items.filter((item) => moduleState.modules?.[item.key]).length} ativo(s)
                                                </small>
                                            </div>
                                        </header>

                                        <div className="settings-card-grid">
                                            {section.items.map((item) => {
                                                const active = Boolean(moduleState.modules?.[item.key])

                                                return (
                                                    <article key={item.key} className={`settings-toggle-card ${active ? 'active' : ''}`}>
                                                        <div>
                                                            <strong>{item.label}</strong>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={`settings-toggle-button ${active ? 'active' : ''}`}
                                                            onClick={() => handleToggle(`modules.${item.key}`)}
                                                        >
                                                            <span>{active ? 'Ligado' : 'Desligado'}</span>
                                                        </button>
                                                    </article>
                                                )
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </section>
                    </PageContainer>
                </form>
            </div>
        </AppLayout>
    )
}

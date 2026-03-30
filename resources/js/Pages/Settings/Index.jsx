import { useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
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
                <section className="settings-hero">
                    <div>
                        <span>Plataforma modular</span>
                        <h1>Modulos do sistema por tipo de comercio</h1>
                        <p>Escolha um preset rapido ou personalize cada switch para liberar so as telas, menus e fluxos que fazem sentido para o negocio.</p>
                    </div>
                    <div className="settings-hero-metrics">
                        <div>
                            <small>Preset ativo</small>
                            <strong>{moduleState.presetLabel}</strong>
                        </div>
                        <div>
                            <small>Modulos ativos</small>
                            <strong>{enabledModulesCount}</strong>
                        </div>
                        <div>
                            <small>Telas visiveis</small>
                            <strong>{enabledCapabilitiesCount}</strong>
                        </div>
                    </div>
                </section>

                <form className="settings-form" onSubmit={handleSubmit}>
                    <section className="settings-section">
                        <div className="settings-section-header">
                            <div>
                                <span>Tipo de comercio</span>
                                <h2>Presets rapidos</h2>
                                <p>Ao selecionar um preset, os modulos principais sao ligados automaticamente.</p>
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
                                        <p>{preset.description}</p>
                                        <small>{isActive ? 'Preset em uso' : 'Aplicar preset'}</small>
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
                                <span>Modulos do sistema</span>
                                <h2>Liga e desliga por area</h2>
                                <p>A sidebar, as rotas e as telas acompanham os modulos ativos sem deixar espacos vazios.</p>
                            </div>
                            <div className="settings-summary-badges">
                                {activeLabels.slice(0, 6).map((label) => (
                                    <span key={label} className="settings-summary-badge">
                                        {label}
                                    </span>
                                ))}
                                {activeLabels.length > 6 ? (
                                    <span className="settings-summary-badge muted">+{activeLabels.length - 6} ativos</span>
                                ) : null}
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
                                                        <p>{item.description}</p>
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

                    <div className="settings-actions">
                        {feedback ? (
                            <div className={`settings-feedback ${feedback.type}`}>
                                <strong>{feedback.text}</strong>
                            </div>
                        ) : (
                            <div className="settings-feedback neutral">
                                <strong>O menu lateral ja esta sendo simulado com os modulos do formulario atual.</strong>
                            </div>
                        )}

                        <button className="settings-save-button" type="submit" disabled={saving}>
                            <i className="fa-solid fa-floppy-disk" />
                            {saving ? 'Salvando...' : 'Salvar configuracoes'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    )
}

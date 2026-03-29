import { useState } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
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

export default function SettingsIndex({ settings, generalOptions, moduleSections }) {
    const [form, setForm] = useState(settings)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const enabledModulesCount = Object.values(form.modules || {}).filter(Boolean).length

    function handleToggle(path) {
        setForm((current) => setValueByPath(current, path, !getValueByPath(current, path)))
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
        <AppLayout title="Configuracoes" navigationModulesOverride={form.modules}>
            <div className="settings-page">
                <section className="settings-hero">
                    <div>
                        <span>Configuracao geral</span>
                        <h1>Regras e modulos da operacao</h1>
                        <p>Ative obrigatoriedades do fechamento e decida quais modulos ficam disponiveis na lateral e nas rotas.</p>
                    </div>
                    <div className="settings-hero-metrics">
                        <div>
                            <small>Modulos ativos</small>
                            <strong>{enabledModulesCount}</strong>
                        </div>
                    </div>
                </section>

                <form className="settings-form" onSubmit={handleSubmit}>
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
                                <span>Modulos</span>
                                <h2>Ativacao por area</h2>
                            </div>
                        </div>

                        <div className="settings-modules-stack">
                            {moduleSections.map((section) => (
                                <section key={section.section} className="settings-module-section">
                                    <header>
                                        <strong>{section.section}</strong>
                                        <small>
                                            {section.items.filter((item) => form.modules?.[item.key]).length} ativo(s)
                                        </small>
                                    </header>

                                    <div className="settings-card-grid">
                                        {section.items.map((item) => {
                                            const active = Boolean(form.modules?.[item.key])

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
                                                        <span>{active ? 'Ativo' : 'Oculto'}</span>
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
                        ) : null}

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

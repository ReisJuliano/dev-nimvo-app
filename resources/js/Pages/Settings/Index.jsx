import { useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import ActionButton from '@/Components/UI/ActionButton'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'
import AppLayout from '@/Layouts/AppLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import useModules from '@/hooks/useModules'
import { DIRECT_SALES_PRESET } from '@/lib/modules'
import { apiRequest } from '@/lib/http'
import './settings.css'

const SIMPLE_MODULE_KEYS = new Set([
    'pdv_simples',
    'caixa',
    'estoque',
    'prazo',
    'clientes',
    'fornecedores',
    'controle_validade',
    'relatorios_basicos',
])

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
    const visibleBusinessPresets = useMemo(
        () => businessPresets.filter((preset) => preset.key === DIRECT_SALES_PRESET),
        [businessPresets],
    )
    const visibleModuleSections = useMemo(
        () =>
            moduleSections
                .map((section) => ({
                    ...section,
                    items: section.items.filter((item) => SIMPLE_MODULE_KEYS.has(item.key)),
                }))
                .filter((section) => section.items.length > 0),
        [moduleSections],
    )
    const visibleModuleKeys = useMemo(
        () => visibleModuleSections.flatMap((section) => section.items.map((item) => item.key)),
        [visibleModuleSections],
    )
    const enabledModulesCount = visibleModuleKeys.filter((key) => moduleState.modules?.[key]).length
    const enabledCapabilitiesCount = ['pdv', 'caixa', 'produtos', 'entrada_estoque', 'prazo', 'clientes', 'fornecedores', 'resumo']
        .filter((key) => moduleState.capabilities?.[key])
        .length
    const activePreset = form.business?.preset || DIRECT_SALES_PRESET
    const activeLabels = useMemo(
        () =>
            visibleModuleSections
                .flatMap((section) => section.items)
                .filter((item) => moduleState.modules?.[item.key])
                .map((item) => item.label),
        [visibleModuleSections, moduleState.modules],
    )

    function handleToggle(path) {
        setForm((current) => {
            const next = setValueByPath(current, path, !getValueByPath(current, path))

            if (path.startsWith('modules.')) {
                next.business = {
                    ...next.business,
                    preset: DIRECT_SALES_PRESET,
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
        <AppLayout title="Configurações" settingsOverride={form}>
            <div className="cfg-page">
                <form onSubmit={handleSubmit}>

                    {/* ─── Header ─── */}
                    <div className="cfg-header">
                        <div className="cfg-header-left">
                            <div className="cfg-header-icon">
                                <i className="fa-solid fa-gear" />
                            </div>
                            <div>
                                <h1 className="cfg-header-title">Configurações da loja</h1>
                                <p className="cfg-header-sub">
                                    {enabledModulesCount} recurso(s) ativo(s) · {enabledCapabilitiesCount} tela(s) visível(is)
                                </p>
                            </div>
                        </div>
                        <div className="cfg-active-chips">
                            {activeLabels.slice(0, 5).map((label) => (
                                <span key={label} className="cfg-active-chip">{label}</span>
                            ))}
                            {activeLabels.length > 5 ? (
                                <span className="cfg-active-chip cfg-active-chip--more">+{activeLabels.length - 5}</span>
                            ) : null}
                        </div>
                    </div>

                    {/* ─── Seção: Tipo de operação ─── */}
                    {visibleBusinessPresets.length > 0 ? (
                        <div className="cfg-section">
                            <div className="cfg-section-title">
                                <i className="fa-solid fa-store" />
                                Tipo de operação
                                <p>Escolha como a loja trabalha no dia a dia.</p>
                            </div>
                            <div className="cfg-preset-grid">
                                {visibleBusinessPresets.map((preset) => {
                                    const isActive = preset.key === activePreset
                                    return (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            className={`cfg-preset-card ${isActive ? 'active' : ''}`}
                                            onClick={() => applyPreset(preset)}
                                        >
                                            <div className="cfg-preset-top">
                                                <span>{preset.label}</span>
                                                {isActive ? (
                                                    <span className="cfg-preset-badge">
                                                        <i className="fa-solid fa-circle-check" /> Ativo
                                                    </span>
                                                ) : (
                                                    <span className="cfg-preset-apply">Aplicar</span>
                                                )}
                                            </div>
                                            <p>{preset.description}</p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ) : null}

                    {/* ─── Seção: Opções gerais ─── */}
                    {generalOptions.length > 0 ? (
                        <div className="cfg-section">
                            <div className="cfg-section-title">
                                <i className="fa-solid fa-sliders" />
                                Preferências gerais
                                <p>Opções que afetam o comportamento geral do sistema.</p>
                            </div>
                            <div className="cfg-options-list">
                                {generalOptions.map((option) => {
                                    const active = Boolean(getValueByPath(form, option.key))
                                    return (
                                        <div key={option.key} className={`cfg-option ${active ? 'active' : ''}`}>
                                            <div className="cfg-option-info">
                                                <strong>{option.label}</strong>
                                                <p>{option.description}</p>
                                            </div>
                                            <button
                                                type="button"
                                                className={`cfg-toggle ${active ? 'active' : ''}`}
                                                onClick={() => handleToggle(option.key)}
                                            >
                                                <span className="cfg-toggle-knob" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : null}

                    {/* ─── Seção: Recursos da loja ─── */}
                    <div className="cfg-section">
                        <div className="cfg-section-title">
                            <i className="fa-solid fa-puzzle-piece" />
                            Recursos da loja
                            <p>Ative apenas o que a loja usa no dia a dia. O menu lateral reflete as opções ligadas aqui.</p>
                        </div>
                        <div className="cfg-modules-grid">
                            {visibleModuleSections.map((section) => (
                                <div key={section.section} className="cfg-module-group">
                                    <div className="cfg-module-group-header">
                                        <span>{section.section}</span>
                                        <small>
                                            {section.items.filter((item) => moduleState.modules?.[item.key]).length} / {section.items.length} ativo(s)
                                        </small>
                                    </div>
                                    <div className="cfg-module-list">
                                        {section.items.map((item) => {
                                            const active = Boolean(moduleState.modules?.[item.key])
                                            return (
                                                <div key={item.key} className={`cfg-module-item ${active ? 'active' : ''}`}>
                                                    <div className={`cfg-module-dot ${active ? 'active' : ''}`} />
                                                    <div className="cfg-module-info">
                                                        <strong>{item.label}</strong>
                                                        <p>{item.description}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={`cfg-toggle ${active ? 'active' : ''}`}
                                                        onClick={() => handleToggle(`modules.${item.key}`)}
                                                    >
                                                        <span className="cfg-toggle-knob" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ─── Footer com salvar ─── */}
                    <div className="cfg-footer">
                        <p>As configurações afetam todos os usuários da loja imediatamente após salvar.</p>
                        <button type="submit" className="cfg-save-btn" disabled={saving}>
                            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
                            {saving ? 'Salvando...' : 'Salvar configurações'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    )
}

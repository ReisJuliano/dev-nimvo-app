import { useEffect, useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import ActionButton from '@/Components/UI/ActionButton'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'
import AppLayout from '@/Layouts/AppLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import useModules from '@/hooks/useModules'
import { DIRECT_SALES_PRESET } from '@/lib/modules'
import { apiRequest } from '@/lib/http'
import { canUseLocalAgentBridge, listPrintersViaLocalAgent, printTestViaLocalAgent } from '@/lib/localAgentBridge'
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
    const { localAgentBridge } = usePage().props
    const [form, setForm] = useState(settings)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [localAgents, setLocalAgents] = useState([])
    const [localAgentsLoading, setLocalAgentsLoading] = useState(false)
    const [newAgentLabel, setNewAgentLabel] = useState('Caixa 1')
    const [printers, setPrinters] = useState([])
    const [printersLoading, setPrintersLoading] = useState(false)
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

    useEffect(() => {
        void refreshLocalAgents()
        const timer = window.setInterval(() => {
            void refreshLocalAgents({ quiet: true })
        }, 5000)

        return () => window.clearInterval(timer)
    }, [])

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

    async function refreshLocalAgents({ quiet = false } = {}) {
        if (!quiet) {
            setLocalAgentsLoading(true)
        }

        try {
            const response = await apiRequest('/api/settings/local-agent')
            setLocalAgents(response.agents || [])
        } catch (error) {
            if (!quiet) {
                setFeedback({ type: 'error', text: error.message })
            }
        } finally {
            setLocalAgentsLoading(false)
        }
    }

    async function createLocalAgent() {
        const label = newAgentLabel.trim()
        if (!label) {
            setFeedback({ type: 'warning', text: 'Informe um nome para o computador ou caixa.' })
            return
        }

        setLocalAgentsLoading(true)
        try {
            const response = await apiRequest('/api/settings/local-agent', {
                method: 'post',
                data: { label },
            })
            setLocalAgents((current) => [response.agent, ...current])
            setNewAgentLabel('')
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLocalAgentsLoading(false)
        }
    }

    async function generateActivationCode(agentId) {
        try {
            const response = await apiRequest(`/api/settings/local-agent/${agentId}/activation-code`, { method: 'post' })
            setLocalAgents((current) => current.map((agent) => agent.id === agentId ? response.agent : agent))
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function updateLocalAgent(agentId, data) {
        try {
            const response = await apiRequest(`/api/settings/local-agent/${agentId}`, {
                method: 'put',
                data,
            })
            setLocalAgents((current) => current.map((agent) => agent.id === agentId ? response.agent : agent))
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    function downloadAgent(agentId) {
        window.location.href = `/api/settings/local-agent/${agentId}/download`
    }

    async function refreshPrinters() {
        if (!canUseLocalAgentBridge(localAgentBridge)) {
            setFeedback({ type: 'warning', text: 'Este navegador ainda não está conectado ao agente local.' })
            return
        }

        setPrintersLoading(true)
        try {
            const response = await listPrintersViaLocalAgent(localAgentBridge)
            setPrinters(response.printers || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setPrintersLoading(false)
        }
    }

    async function testLocalPrinter() {
        if (!canUseLocalAgentBridge(localAgentBridge)) {
            setFeedback({ type: 'warning', text: 'Este navegador ainda não está conectado ao agente local.' })
            return
        }

        try {
            await printTestViaLocalAgent(localAgentBridge, {
                store_name: 'Nimvo',
                message: 'Teste disparado pela tela de Configurações.',
            })
            setFeedback({ type: 'success', text: 'Teste enviado para o agente local.' })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
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
                    <div className="cfg-section">
                        <div className="cfg-section-title">
                            <i className="fa-solid fa-print" />
                            Impressora / Agente local
                            <p>Instale o agente nos computadores que imprimem comprovantes.</p>
                        </div>

                        <div className="cfg-agent-panel">
                            <div className="cfg-agent-create">
                                <input
                                    type="text"
                                    className="cfg-agent-input"
                                    value={newAgentLabel}
                                    onChange={(event) => setNewAgentLabel(event.target.value)}
                                    placeholder="Nome do computador, ex. Caixa 1"
                                />
                                <button type="button" className="cfg-agent-button" onClick={createLocalAgent} disabled={localAgentsLoading}>
                                    <i className="fa-solid fa-plus" />
                                    Adicionar
                                </button>
                                <button type="button" className="cfg-agent-button ghost" onClick={refreshPrinters} disabled={printersLoading}>
                                    <i className={`fa-solid ${printersLoading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} />
                                    Impressoras
                                </button>
                                <button type="button" className="cfg-agent-button ghost" onClick={testLocalPrinter}>
                                    <i className="fa-solid fa-receipt" />
                                    Teste
                                </button>
                            </div>

                            {printers.length ? (
                                <div className="cfg-printer-list">
                                    {printers.map((printer) => (
                                        <span key={printer.name || printer} className="cfg-printer-chip">
                                            {printer.name || printer}
                                            {printer.status ? <small>{printer.status}</small> : null}
                                        </span>
                                    ))}
                                </div>
                            ) : null}

                            <div className="cfg-agent-list">
                                {localAgents.length ? localAgents.map((agent) => (
                                    <div key={agent.id} className="cfg-agent-card">
                                        <div className="cfg-agent-main">
                                            <strong>{agent.label}</strong>
                                            <span className={`cfg-agent-status ${agent.online ? 'online' : 'offline'}`}>
                                                {agent.online ? 'Online' : agent.activation?.pending ? 'Aguardando ativação' : 'Offline'}
                                            </span>
                                            <small>{agent.printer?.mode === 'relay' ? `Relay ${agent.printer.relay_target || ''}` : agent.printer?.name || 'Impressora local'}</small>
                                            <div className="cfg-agent-config">
                                                <select
                                                    value={agent.printer?.mode || 'local'}
                                                    onChange={(event) => updateLocalAgent(agent.id, { printer: { mode: event.target.value } })}
                                                >
                                                    <option value="local">Local</option>
                                                    <option value="relay">Relay</option>
                                                </select>
                                                <select
                                                    value={agent.printer?.name || ''}
                                                    onChange={(event) => updateLocalAgent(agent.id, { printer: { name: event.target.value, mode: 'local' } })}
                                                >
                                                    <option value="">Selecionar impressora</option>
                                                    {printers.map((printer) => (
                                                        <option key={printer.name || printer} value={printer.name || printer}>{printer.name || printer}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    defaultValue={agent.printer?.relay_target || ''}
                                                    placeholder="IP relay, ex. 192.168.0.12:18123"
                                                    onBlur={(event) => updateLocalAgent(agent.id, { printer: { relay_target: event.target.value } })}
                                                />
                                            </div>
                                        </div>
                                        <div className="cfg-agent-actions">
                                            {agent.activation?.code ? (
                                                <code className="cfg-agent-code">{agent.activation.code}</code>
                                            ) : null}
                                            <button type="button" className="cfg-agent-button ghost" onClick={() => generateActivationCode(agent.id)}>
                                                Código
                                            </button>
                                            <button type="button" className="cfg-agent-button" onClick={() => downloadAgent(agent.id)}>
                                                Baixar
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="cfg-agent-empty">
                                        {localAgentsLoading ? 'Carregando agentes...' : 'Nenhum agente local cadastrado para esta loja.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

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

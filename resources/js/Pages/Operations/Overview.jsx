import { router } from '@inertiajs/react'
import { useState } from 'react'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import DataTable from '@/Components/Operations/DataTable'
import FilterBar from '@/Components/Operations/FilterBar'
import InfoPanels from '@/Components/Operations/InfoPanels'
import MetricGrid from '@/Components/Operations/MetricGrid'
import ReportsShowcase from '@/Components/Operations/ReportsShowcase'
import AppLayout from '@/Layouts/AppLayout'
import './operations.css'

function buildFilterPayload(filters, overrides = {}) {
    return Object.fromEntries(
        Object.entries({
            from: filters?.from || undefined,
            to: filters?.to || undefined,
            product: filters?.product || undefined,
            section: filters?.section || undefined,
            cash_register: filters?.cash_register || undefined,
            ...overrides,
        }).filter(([, value]) => value != null && value !== ''),
    )
}

export default function OperationsOverview({ module }) {
    const [activeTab, setActiveTab] = useState('overview')
    const isReportsCatalog = module.view === 'reports_catalog'
    const hasSections = Array.isArray(module.sections) && module.sections.length > 0
    const currentSection = hasSections
        ? module.sections.find((section) => section.key === module.activeSection) || module.sections[0]
        : module
    const moduleMetrics = Array.isArray(module.metrics) ? module.metrics : []
    const modulePanels = Array.isArray(module.panels) ? module.panels : []
    const moduleTables = Array.isArray(module.tables) ? module.tables : []
    const currentDialog = currentSection?.dialog ?? null
    const heroTitle = hasSections
        ? module.title
        : `Painel de ${module.title.charAt(0).toLowerCase()}${module.title.slice(1)}`
    const availableTabs = hasSections
        ? []
        : [
            moduleMetrics.length || modulePanels.length || moduleTables.length
                ? { key: 'overview', icon: 'fa-compass-drafting', label: 'Visao geral' }
                : null,
            moduleTables.length ? { key: 'tables', icon: 'fa-table-list', label: 'Tabelas' } : null,
            modulePanels.length ? { key: 'insights', icon: 'fa-lightbulb', label: 'Painel' } : null,
        ].filter(Boolean)
    const resolvedActiveTab = availableTabs.some((tab) => tab.key === activeTab)
        ? activeTab
        : availableTabs[0]?.key || 'overview'

    function handleSectionChange(sectionKey) {
        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, {
                section: sectionKey,
                cash_register: sectionKey === 'cash_registers' ? module.filters?.cash_register || undefined : undefined,
            }),
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        )
    }

    function handleCloseDialog() {
        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, {
                cash_register: undefined,
            }),
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        )
    }

    return (
        <AppLayout title={module.title} navigationMode={isReportsCatalog ? 'overlay' : 'default'}>
            <div className="operations-page">
                <section className="operations-hero">
                    <div>
                        <span>{isReportsCatalog ? 'Relatorios' : 'Operacoes'}</span>
                        <h1>{heroTitle}</h1>
                    </div>
                    <div className="operations-hero-badges">
                        <span className="ui-badge success">
                            {isReportsCatalog
                                ? `${module.catalog?.categories?.length || 0} categoria(s)`
                                : hasSections
                                ? `${module.sections.length} aba(s)`
                                : modulePanels.length
                                  ? `${modulePanels.length} painel(is)`
                                  : `${moduleTables.length} tabela(s)`}
                        </span>
                        {isReportsCatalog ? (
                            <span className="ui-badge warning">
                                {module.catalog?.categories?.reduce((total, category) => total + (category.report_count || 0), 0) || 0} relatorio(s)
                            </span>
                        ) : null}
                        {!isReportsCatalog && module.filters?.product ? (
                            <span className="ui-badge warning">Produto: {module.filters.product}</span>
                        ) : null}
                    </div>
                </section>

                {isReportsCatalog ? null : <FilterBar filters={module.filters} />}

                {isReportsCatalog ? (
                    <ReportsShowcase module={module} />
                ) : hasSections ? (
                    <>
                        <section className="operations-section-tabs">
                            {module.sections.map((section) => (
                                <button
                                    key={section.key}
                                    type="button"
                                    className={`operations-section-tab ${section.key === currentSection.key ? 'active' : ''}`}
                                    onClick={() => handleSectionChange(section.key)}
                                >
                                    <i className={`fa-solid ${section.icon || 'fa-layer-group'}`} />
                                    <span>{section.label || section.title}</span>
                                </button>
                            ))}
                        </section>

                        <section className="operations-section-hero">
                            <div>
                                <span className="operations-section-kicker">Visao ativa</span>
                                <h2>{currentSection.title}</h2>
                            </div>
                            <div className="operations-section-badges">
                                {currentSection.metrics?.length ? (
                                    <span className="ui-badge success">{currentSection.metrics.length} indicador(es)</span>
                                ) : null}
                                {currentSection.tables?.length ? (
                                    <span className="ui-badge warning">{currentSection.tables.length} tabela(s)</span>
                                ) : null}
                                {currentSection.panels?.length ? (
                                    <span className="ui-badge">{currentSection.panels.length} painel(is)</span>
                                ) : null}
                            </div>
                        </section>

                        <MetricGrid metrics={currentSection.metrics} />
                        <InfoPanels panels={currentSection.panels} />

                        <div className="operations-table-grid">
                            {currentSection.tables.map((table) => (
                                <DataTable key={`${currentSection.key}-${table.title}`} table={table} />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        {availableTabs.length > 1 ? (
                            <section className="ui-tabs">
                                {availableTabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        className={`ui-tab ${resolvedActiveTab === tab.key ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        <i className={`fa-solid ${tab.icon}`} />
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </section>
                        ) : null}

                        {resolvedActiveTab !== 'tables' && moduleMetrics.length ? <MetricGrid metrics={moduleMetrics} /> : null}

                        {resolvedActiveTab !== 'tables' ? <InfoPanels panels={modulePanels} /> : null}

                        {resolvedActiveTab !== 'insights' && moduleTables.length ? (
                            <div className="operations-table-grid">
                                {moduleTables.map((table) => (
                                    <DataTable key={table.title} table={table} />
                                ))}
                            </div>
                        ) : null}
                    </>
                )}
            </div>

            {currentDialog?.type === 'cash_register_closing_report' ? (
                <ClosingReportModal report={currentDialog.report} onClose={handleCloseDialog} />
            ) : null}
        </AppLayout>
    )
}

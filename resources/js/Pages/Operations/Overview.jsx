import { router } from '@inertiajs/react'
import { useState } from 'react'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import DataTable from '@/Components/Operations/DataTable'
import FilterBar from '@/Components/Operations/FilterBar'
import InfoPanels from '@/Components/Operations/InfoPanels'
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

function formatMetricValue(metric) {
    if (metric?.format === 'money') {
        return formatMoney(metric.value)
    }

    if (metric?.format === 'percent') {
        return formatPercent(metric.value)
    }

    if (metric?.format === 'text') {
        return metric?.value || '-'
    }

    return formatNumber(metric?.value || 0)
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
    const activeMetrics = Array.isArray(currentSection?.metrics) ? currentSection.metrics : moduleMetrics
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
        <AppLayout title={module.title} defaultCollapsed={isReportsCatalog}>
            <div className="operations-page">
                <PageContainer
                    toolbar={!isReportsCatalog && !hasSections && availableTabs.length > 1 ? (
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
                    sidebar={(
                        <RightSidebarPanel>
                            {!isReportsCatalog ? (
                                <RightSidebarSection title="Filtros" subtitle="Atualizar recorte">
                                    <FilterBar filters={module.filters} />
                                </RightSidebarSection>
                            ) : null}

                            <RightSidebarSection title="Contexto" subtitle={isReportsCatalog ? heroTitle : currentSection?.title || heroTitle}>
                                <div className="right-sidebar-meta">
                                    <div className="right-sidebar-meta-item">
                                        <span>{isReportsCatalog ? 'Categorias' : 'Abas'}</span>
                                        <strong>
                                            {isReportsCatalog
                                                ? module.catalog?.categories?.length || 0
                                                : hasSections
                                                    ? module.sections.length
                                                    : 0}
                                        </strong>
                                    </div>
                                    <div className="right-sidebar-meta-item">
                                        <span>Indicadores</span>
                                        <strong>{activeMetrics.length || 0}</strong>
                                    </div>
                                    <div className="right-sidebar-meta-item">
                                        <span>Tabelas</span>
                                        <strong>{(currentSection?.tables || moduleTables).length || 0}</strong>
                                    </div>
                                    {isReportsCatalog ? (
                                        <div className="right-sidebar-meta-item">
                                            <span>Relatorios</span>
                                            <strong>{module.catalog?.categories?.reduce((total, category) => total + (category.report_count || 0), 0) || 0}</strong>
                                        </div>
                                    ) : null}
                                    {!isReportsCatalog && module.filters?.product ? (
                                        <div className="right-sidebar-note">
                                            Produto em foco: {module.filters.product}
                                        </div>
                                    ) : null}
                                </div>
                            </RightSidebarSection>

                            {activeMetrics.length ? (
                                <RightSidebarSection title="Indicadores" subtitle="Valores atuais">
                                    <div className="right-sidebar-meta">
                                        {activeMetrics.map((metric) => (
                                            <div key={metric.label} className="right-sidebar-meta-item">
                                                <span>{metric.label}</span>
                                                <strong>{formatMetricValue(metric)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </RightSidebarSection>
                            ) : null}
                        </RightSidebarPanel>
                    )}
                >
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

                            <InfoPanels panels={currentSection.panels} />

                            <div className="operations-table-grid">
                                {currentSection.tables.map((table) => (
                                    <DataTable key={`${currentSection.key}-${table.title}`} table={table} />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
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
                </PageContainer>
            </div>

            {currentDialog?.type === 'cash_register_closing_report' ? (
                <ClosingReportModal report={currentDialog.report} onClose={handleCloseDialog} />
            ) : null}
        </AppLayout>
    )
}

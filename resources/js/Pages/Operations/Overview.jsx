import { router } from '@inertiajs/react'
import { useState } from 'react'
import DataTable from '@/Components/Operations/DataTable'
import FilterBar from '@/Components/Operations/FilterBar'
import InfoPanels from '@/Components/Operations/InfoPanels'
import MetricGrid from '@/Components/Operations/MetricGrid'
import AppLayout from '@/Layouts/AppLayout'
import './operations.css'

function buildFilterPayload(filters, overrides = {}) {
    return Object.fromEntries(
        Object.entries({
            from: filters?.from || undefined,
            to: filters?.to || undefined,
            product: filters?.product || undefined,
            section: filters?.section || undefined,
            ...overrides,
        }).filter(([, value]) => value != null && value !== ''),
    )
}

export default function OperationsOverview({ module }) {
    const [activeTab, setActiveTab] = useState('overview')
    const hasSections = Array.isArray(module.sections) && module.sections.length > 0
    const currentSection = hasSections
        ? module.sections.find((section) => section.key === module.activeSection) || module.sections[0]
        : module
    const heroTitle = hasSections
        ? module.title
        : `Painel de ${module.title.charAt(0).toLowerCase()}${module.title.slice(1)}`

    function handleSectionChange(sectionKey) {
        router.get(window.location.pathname, buildFilterPayload(module.filters, { section: sectionKey }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    return (
        <AppLayout title={module.title}>
            <div className="operations-page">
                <section className="operations-hero">
                    <div>
                        <span>Operacoes</span>
                        <h1>{heroTitle}</h1>
                        <p>{module.description}</p>
                    </div>
                    <div className="operations-hero-badges">
                        <span className="ui-badge success">
                            {hasSections ? `${module.sections.length} secao(oes)` : `${currentSection.panels?.length || 0} resumo(s)`}
                        </span>
                        {module.filters?.product ? (
                            <span className="ui-badge warning">Produto: {module.filters.product}</span>
                        ) : null}
                    </div>
                </section>

                <FilterBar filters={module.filters} />

                {hasSections ? (
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
                                <p>{currentSection.description}</p>
                            </div>
                            <div className="operations-section-badges">
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
                        <section className="ui-tabs">
                            <button
                                type="button"
                                className={`ui-tab ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                <i className="fa-solid fa-compass-drafting" />
                                <span>Visao geral</span>
                            </button>
                            <button
                                type="button"
                                className={`ui-tab ${activeTab === 'tables' ? 'active' : ''}`}
                                onClick={() => setActiveTab('tables')}
                            >
                                <i className="fa-solid fa-table-list" />
                                <span>Tabelas</span>
                            </button>
                            <button
                                type="button"
                                className={`ui-tab ${activeTab === 'insights' ? 'active' : ''}`}
                                onClick={() => setActiveTab('insights')}
                            >
                                <i className="fa-solid fa-lightbulb" />
                                <span>Resumo</span>
                            </button>
                        </section>

                        <MetricGrid metrics={module.metrics} />

                        {activeTab !== 'tables' ? <InfoPanels panels={module.panels} /> : null}

                        {activeTab !== 'insights' ? (
                            <div className="operations-table-grid">
                                {module.tables.map((table) => (
                                    <DataTable key={table.title} table={table} />
                                ))}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </AppLayout>
    )
}

import { useState } from 'react'
import DataTable from '@/Components/Operations/DataTable'
import FilterBar from '@/Components/Operations/FilterBar'
import InfoPanels from '@/Components/Operations/InfoPanels'
import MetricGrid from '@/Components/Operations/MetricGrid'
import AppLayout from '@/Layouts/AppLayout'
import './operations.css'

export default function OperationsOverview({ module }) {
    const [activeTab, setActiveTab] = useState('overview')
    const heroTitle = `Painel de ${module.title.charAt(0).toLowerCase()}${module.title.slice(1)}`

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
                        <span className="ui-badge info">{module.metrics.length} KPI(s)</span>
                        <span className="ui-badge primary">{module.tables.length} tabela(s)</span>
                        <span className="ui-badge success">{module.panels?.length || 0} resumo(s)</span>
                    </div>
                </section>

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

                <FilterBar filters={module.filters} />
                <MetricGrid metrics={module.metrics} />

                {activeTab !== 'tables' ? <InfoPanels panels={module.panels} /> : null}

                {activeTab !== 'insights' ? (
                    <div className="operations-table-grid">
                        {module.tables.map((table) => (
                            <DataTable key={table.title} table={table} />
                        ))}
                    </div>
                ) : null}
            </div>
        </AppLayout>
    )
}

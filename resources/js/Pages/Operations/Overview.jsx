import DataTable from '@/Components/Operations/DataTable'
import FilterBar from '@/Components/Operations/FilterBar'
import InfoPanels from '@/Components/Operations/InfoPanels'
import MetricGrid from '@/Components/Operations/MetricGrid'
import AppLayout from '@/Layouts/AppLayout'
import './operations.css'

export default function OperationsOverview({ module }) {
    return (
        <AppLayout title={module.title}>
            <div className="operations-page">
                <section className="operations-hero">
                    <span>Painel operacional</span>
                    <h1>{module.title}</h1>
                    <p>{module.description}</p>
                </section>

                <FilterBar filters={module.filters} />
                <MetricGrid metrics={module.metrics} />
                <InfoPanels panels={module.panels} />

                <div className="operations-table-grid">
                    {module.tables.map((table) => (
                        <DataTable key={table.title} table={table} />
                    ))}
                </div>
            </div>
        </AppLayout>
    )
}

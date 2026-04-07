import { formatMoney, formatNumber, formatPercent } from '@/lib/format'

function renderValue(metric) {
    if (metric.format === 'money') {
        return formatMoney(metric.value)
    }

    if (metric.format === 'percent') {
        return formatPercent(metric.value)
    }

    if (metric.format === 'text') {
        return metric.value || '-'
    }

    return formatNumber(metric.value)
}

export default function MetricGrid({ metrics }) {
    return (
        <section className="operations-metric-grid">
            {metrics.map((metric, index) => (
                <article key={metric.label} className={`operations-metric-card tone-${index % 4}`}>
                    <div className="operations-metric-top">
                        <span>{metric.label}</span>
                        <i className={`fa-solid ${metric.icon || 'fa-chart-column'}`} />
                    </div>
                    <strong>{renderValue(metric)}</strong>
                    <small>{metric.caption || 'Sem observacao'}</small>
                </article>
            ))}
        </section>
    )
}

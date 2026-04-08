import { formatMoney, formatNumber, formatPercent } from '@/lib/format'

function formatValue(value, type) {
    if (type === 'number') {
        return formatNumber(value)
    }

    if (type === 'percent') {
        return formatPercent(value)
    }

    return formatMoney(value)
}

export default function DashboardChartTooltip({
    active,
    label,
    payload = [],
    valueTypes = {},
    resolveLabel = null,
}) {
    if (!active || !payload.length) {
        return null
    }

    const tooltipLabel = resolveLabel ? resolveLabel(payload, label) : label

    return (
        <div className="dashboard-tooltip">
            <strong>{tooltipLabel}</strong>

            <div className="dashboard-tooltip-list">
                {payload
                    .filter((item) => item?.value !== undefined && item?.value !== null)
                    .map((item) => (
                        <div key={`${item.dataKey}-${item.name}`} className="dashboard-tooltip-row">
                            <span>{item.name}</span>
                            <b>{formatValue(item.value, valueTypes[item.dataKey])}</b>
                        </div>
                    ))}
            </div>
        </div>
    )
}

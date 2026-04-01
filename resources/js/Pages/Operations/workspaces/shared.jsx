import { formatMoney, formatNumber } from '@/lib/format'

export function EmptyState({ title, text }) {
    return (
        <section className="ops-workspace-empty-state">
            <strong>{title}</strong>
            <p>{text}</p>
        </section>
    )
}

export function Feedback({ feedback }) {
    if (!feedback) {
        return null
    }

    return <div className={`ops-workspace-feedback ${feedback.type}`}>{feedback.text}</div>
}

export function SectionTabs({ tabs, activeTab, onChange }) {
    return (
        <section className="ui-tabs ops-workspace-tabs">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    className={`ui-tab ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => onChange(tab.key)}
                >
                    <i className={`fa-solid ${tab.icon}`} />
                    <span>{tab.label}</span>
                </button>
            ))}
        </section>
    )
}

export function FeedbackHeader({ title, subtitle, action = null }) {
    return (
        <header className="ops-workspace-panel-header">
            <div>
                <h2>{title}</h2>
                {subtitle ? <span>{subtitle}</span> : null}
            </div>
            {action}
        </header>
    )
}

export function ListCard({ active, onClick, title, badge = null, description = null, meta = [] }) {
    return (
        <button type="button" className={`ops-workspace-list-card ${active ? 'active' : ''}`} onClick={onClick}>
            <div className="ops-workspace-list-card-top">
                <strong>{title}</strong>
                {badge}
            </div>
            {description ? <p>{description}</p> : null}
            {meta.length ? (
                <div className="ops-workspace-list-card-meta">
                    {meta.map((item) => (
                        <span key={item}>{item}</span>
                    ))}
                </div>
            ) : null}
        </button>
    )
}

export function MetricGrid({ items }) {
    return (
        <section className="ops-workspace-metric-grid">
            {items.map((item) => (
                <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.format === 'money' ? formatMoney(item.value) : formatNumber(item.value)}</strong>
                    <small>{item.caption}</small>
                </article>
            ))}
        </section>
    )
}

export function buildRecordsUrl(moduleKey, id = null) {
    return id ? `/api/operations/${moduleKey}/records/${id}` : `/api/operations/${moduleKey}/records`
}

export function upsertRecord(records, record) {
    const exists = records.some((entry) => entry.id === record.id)

    return exists ? records.map((entry) => (entry.id === record.id ? record : entry)) : [record, ...records]
}

export function parseNumber(value, fallback = 0) {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : fallback
}

export function ensureDate(value) {
    if (!value) {
        return ''
    }

    return String(value).slice(0, 10)
}

export function ensureDateTime(value) {
    if (!value) {
        return ''
    }

    return String(value).slice(0, 16)
}

export function getProductOptionLabel(product) {
    if (!product) {
        return ''
    }

    return product.code ? `${product.name} (${product.code})` : product.name
}

export function Badge({ tone = 'warning', children }) {
    return <span className={`ui-badge ${tone}`}>{children}</span>
}

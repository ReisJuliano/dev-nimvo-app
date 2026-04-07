import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { formatMoney, formatNumber } from '@/lib/format'
import ActionButton from '@/Components/UI/ActionButton'
import DataList from '@/Components/UI/DataList'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'

export function EmptyState({ title, text }) {
    return (
        <section className="ops-workspace-empty-state">
            <strong>{title}</strong>
            <p>{text}</p>
        </section>
    )
}

export function Feedback({ feedback }) {
    useErrorFeedbackPopup(feedback)

    return null
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

function formatMetricValue(item) {
    return item.format === 'money' ? formatMoney(item.value) : formatNumber(item.value)
}

export function WorkspaceCollectionShell({
    tabs,
    activeTab,
    onTabChange,
    listTitle,
    listIcon = 'fa-table-list',
    listCount,
    createLabel,
    onCreate,
    emptyState,
    listChildren,
    summaryItems = [],
    formTitle,
    formSubtitle = null,
    formChildren,
}) {
    return (
        <div className="ops-workspace-stack">
            <SectionTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />

            <PageContainer
                sidebar={(
                    <RightSidebarPanel>
                        {summaryItems.length ? (
                            <RightSidebarSection title="Contexto" subtitle="Resumo do modulo">
                                <div className="ops-workspace-sidebar-meta">
                                    {summaryItems.map((item) => (
                                        <div key={item.label} className="right-sidebar-meta-item">
                                            <div className="ops-workspace-sidebar-copy">
                                                <span>{item.label}</span>
                                                <small>{item.caption}</small>
                                            </div>
                                            <strong>{formatMetricValue(item)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </RightSidebarSection>
                        ) : null}

                        <RightSidebarSection title={formTitle} subtitle={formSubtitle}>
                            {formChildren}
                        </RightSidebarSection>
                    </RightSidebarPanel>
                )}
            >
                <DataList
                    title={listTitle}
                    icon={listIcon}
                    count={listCount}
                    actions={(
                        <ActionButton icon="fa-plus" onClick={onCreate}>
                            {createLabel}
                        </ActionButton>
                    )}
                    empty={emptyState}
                >
                    {listChildren}
                </DataList>
            </PageContainer>
        </div>
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

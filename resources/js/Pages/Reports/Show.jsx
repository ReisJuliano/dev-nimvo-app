import { Link, router } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import './reports.css'

const SCOPE_OPTIONS = [
    { key: 'date', label: 'Data', icon: 'fa-calendar-day' },
    { key: 'month', label: 'Mes', icon: 'fa-calendar' },
    { key: 'months', label: 'Mes a mes', icon: 'fa-calendar-days' },
    { key: 'range', label: 'Periodo', icon: 'fa-arrow-right-long' },
    { key: 'year', label: 'Ano', icon: 'fa-hashtag' },
]

function buildPayload(filters, overrides = {}) {
    return Object.fromEntries(
        Object.entries({
            scope: overrides.scope ?? filters.scope,
            date: overrides.date ?? filters.date,
            month: overrides.month ?? filters.month,
            month_from: overrides.month_from ?? filters.month_from,
            month_to: overrides.month_to ?? filters.month_to,
            year: overrides.year ?? filters.year,
            from: overrides.from ?? filters.from,
            to: overrides.to ?? filters.to,
            per_page: overrides.per_page ?? filters.per_page,
            page: overrides.page ?? filters.page,
        }).filter(([, value]) => value != null && value !== ''),
    )
}

function renderValue(value, format) {
    if (format === 'money') {
        return formatMoney(value)
    }

    if (format === 'percent') {
        return formatPercent(value)
    }

    if (format === 'date') {
        return formatDate(value)
    }

    if (format === 'datetime') {
        return formatDateTime(value)
    }

    if (format === 'number') {
        return formatNumber(value)
    }

    if (format === 'decimal') {
        return formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    }

    return value ?? '-'
}

function buildPeriodLabel(filters) {
    if (filters.scope === 'date') {
        return formatDate(filters.date)
    }

    if (filters.scope === 'year') {
        return filters.year
    }

    if (filters.scope === 'months') {
        return `${filters.month_from} ate ${filters.month_to}`
    }

    if (filters.scope === 'range') {
        return `${formatDate(filters.from)} ate ${formatDate(filters.to)}`
    }

    return filters.month
}

function SummaryCard({ item }) {
    return (
        <article className="report-summary-card">
            <span className="report-summary-icon">
                <i className={`fa-solid ${item.icon || 'fa-chart-column'}`} />
            </span>
            <div className="report-summary-copy">
                <small>{item.label}</small>
                <strong>{renderValue(item.value, item.format)}</strong>
            </div>
        </article>
    )
}

function ReportTable({ columns, rows }) {
    if (!rows.length) {
        return (
            <div className="report-empty-state">
                <i className="fa-solid fa-table-list" />
                <span>Sem dados</span>
            </div>
        )
    }

    return (
        <div className="report-table-wrap">
            <table className="report-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>{column.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={`${index}-${row[columns[0]?.key] ?? 'row'}`}>
                            {columns.map((column) => (
                                <td key={column.key}>{renderValue(row[column.key], column.format)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default function Show({ report, filters, summary, columns, rows, pagination, backHref }) {
    const [scope, setScope] = useState(filters.scope)

    useEffect(() => {
        setScope(filters.scope)
    }, [filters.scope])

    function handleSubmit(event) {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)

        router.get(
            window.location.pathname,
            buildPayload(filters, {
                scope,
                date: String(formData.get('date') || filters.date),
                month: String(formData.get('month') || filters.month),
                month_from: String(formData.get('month_from') || filters.month_from),
                month_to: String(formData.get('month_to') || filters.month_to),
                year: String(formData.get('year') || filters.year),
                from: String(formData.get('from') || filters.from),
                to: String(formData.get('to') || filters.to),
                per_page: String(formData.get('per_page') || filters.per_page),
                page: 1,
            }),
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        )
    }

    function handleReset() {
        router.get(
            window.location.pathname,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        )
    }

    function goToPage(page) {
        if (!page || page === pagination.current_page) {
            return
        }

        router.get(
            window.location.pathname,
            buildPayload(filters, { page }),
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        )
    }

    return (
        <AppLayout
            title={report.title}
            showTopbar={false}
            navigationMode="hidden"
            contentClassName="app-page-content-flush"
        >
            <div className="report-screen">
                <header className="report-toolbar">
                    <div className="report-toolbar-left">
                        <Link href={backHref} className="report-back-link">
                            <i className="fa-solid fa-arrow-left" />
                        </Link>

                        <div className="report-toolbar-title">
                            <h1>{report.title}</h1>
                            <div className="report-toolbar-meta">
                                <span>
                                    <i className={`fa-solid ${report.category.icon}`} />
                                    {report.category.label}
                                </span>
                                <span>
                                    <i className="fa-solid fa-calendar" />
                                    {buildPeriodLabel(filters)}
                                </span>
                                <span>
                                    <i className="fa-solid fa-table-list" />
                                    {pagination.total || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <form className="report-filter-panel" onSubmit={handleSubmit}>
                    <div className="report-filter-modes">
                        {SCOPE_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                className={`report-scope-button ${scope === option.key ? 'active' : ''}`}
                                onClick={() => setScope(option.key)}
                            >
                                <i className={`fa-solid ${option.icon}`} />
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="report-filter-grid">
                        {scope === 'date' ? (
                            <label>
                                <span>
                                    <i className="fa-solid fa-calendar-day" />
                                    Data
                                </span>
                                <input name="date" type="date" defaultValue={filters.date} />
                            </label>
                        ) : null}

                        {scope === 'month' ? (
                            <label>
                                <span>
                                    <i className="fa-solid fa-calendar" />
                                    Mes
                                </span>
                                <input name="month" type="month" defaultValue={filters.month} />
                            </label>
                        ) : null}

                        {scope === 'months' ? (
                            <>
                                <label>
                                    <span>
                                        <i className="fa-solid fa-calendar-plus" />
                                        Mes de
                                    </span>
                                    <input name="month_from" type="month" defaultValue={filters.month_from} />
                                </label>
                                <label>
                                    <span>
                                        <i className="fa-solid fa-calendar-check" />
                                        Mes ate
                                    </span>
                                    <input name="month_to" type="month" defaultValue={filters.month_to} />
                                </label>
                            </>
                        ) : null}

                        {scope === 'range' ? (
                            <>
                                <label>
                                    <span>
                                        <i className="fa-solid fa-calendar-plus" />
                                        Data de
                                    </span>
                                    <input name="from" type="date" defaultValue={filters.from} />
                                </label>
                                <label>
                                    <span>
                                        <i className="fa-solid fa-calendar-check" />
                                        Data ate
                                    </span>
                                    <input name="to" type="date" defaultValue={filters.to} />
                                </label>
                            </>
                        ) : null}

                        {scope === 'year' ? (
                            <label>
                                <span>
                                    <i className="fa-solid fa-hashtag" />
                                    Ano
                                </span>
                                <input name="year" type="number" min="2000" max="2100" defaultValue={filters.year} />
                            </label>
                        ) : null}

                        <label>
                            <span>
                                <i className="fa-solid fa-list-ol" />
                                Linhas
                            </span>
                            <select name="per_page" defaultValue={String(filters.per_page)}>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </label>
                    </div>

                    <div className="report-filter-actions">
                        <button className="report-button report-button-primary" type="submit">
                            <i className="fa-solid fa-filter" />
                            <span>Aplicar</span>
                        </button>
                        <button className="report-button" type="button" onClick={handleReset}>
                            <i className="fa-solid fa-rotate-left" />
                            <span>Padrao</span>
                        </button>
                    </div>
                </form>

                <section className="report-summary-grid">
                    {summary.map((item) => (
                        <SummaryCard key={item.label} item={item} />
                    ))}
                </section>

                <section className="report-table-card">
                    <div className="report-table-toolbar">
                        <div className="report-table-count">
                            <span>{pagination.total || 0} registros</span>
                        </div>

                        <div className="report-table-pagination">
                            <button type="button" onClick={() => goToPage(pagination.current_page - 1)} disabled={pagination.current_page <= 1}>
                                <i className="fa-solid fa-chevron-left" />
                            </button>
                            <span>
                                {pagination.current_page}/{pagination.last_page || 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => goToPage(pagination.current_page + 1)}
                                disabled={pagination.current_page >= pagination.last_page}
                            >
                                <i className="fa-solid fa-chevron-right" />
                            </button>
                        </div>
                    </div>

                    <ReportTable columns={columns} rows={rows} />
                </section>
            </div>
        </AppLayout>
    )
}

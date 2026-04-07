import { Link, router } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import './reports.css'

const SCOPE_OPTIONS = [
    { key: 'date', label: 'Data', icon: 'fa-calendar-day' },
    { key: 'month', label: 'Mes', icon: 'fa-calendar' },
    { key: 'range', label: 'Periodo', icon: 'fa-calendar-days' },
    { key: 'year', label: 'Ano', icon: 'fa-hashtag' },
]

function buildPayload(filters, overrides = {}) {
    return Object.fromEntries(
        Object.entries({
            scope: overrides.scope ?? filters.scope,
            date: overrides.date ?? filters.date,
            month: overrides.month ?? filters.month,
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
        return `Data: ${formatDate(filters.date)}`
    }

    if (filters.scope === 'year') {
        return `Ano: ${filters.year}`
    }

    if (filters.scope === 'range') {
        return `Periodo: ${formatDate(filters.from)} ate ${formatDate(filters.to)}`
    }

    return `Mes: ${filters.month}`
}

function SummaryCard({ item }) {
    return (
        <article className="report-summary-card">
            <div className="report-summary-icon">
                <i className={`fa-solid ${item.icon || 'fa-chart-column'}`} />
            </div>
            <div className="report-summary-copy">
                <small>{item.label}</small>
                <strong>{renderValue(item.value, item.format)}</strong>
            </div>
        </article>
    )
}

function ReportTable({ columns, rows, emptyText }) {
    if (!rows.length) {
        return (
            <div className="report-empty-state">
                <span className="report-empty-icon">
                    <i className="fa-solid fa-table-list" />
                </span>
                <p>{emptyText}</p>
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

export default function Show({ report, filters, summary, columns, rows, pagination, emptyText, backHref }) {
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
        <AppLayout title={report.title}>
            <div className="report-page">
                <section className="report-hero">
                    <div className="report-hero-main">
                        <Link href={backHref} className="report-back-link">
                            <i className="fa-solid fa-arrow-left" />
                            <span>Voltar aos relatorios</span>
                        </Link>

                        <div className="report-hero-title">
                            <span className="report-hero-kicker">
                                <i className={`fa-solid ${report.category.icon}`} />
                                {report.category.label}
                            </span>
                            <h1>{report.title}</h1>
                            <p>{report.description}</p>
                        </div>
                    </div>

                    <div className="report-hero-badges">
                        <span className="ui-badge success">{buildPeriodLabel(filters)}</span>
                        <span className="ui-badge warning">{pagination.total || 0} registro(s)</span>
                    </div>
                </section>

                <form className="report-filter-card" onSubmit={handleSubmit}>
                    <div className="report-filter-scope">
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

                    <div className="report-filter-fields">
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

                        {scope === 'range' ? (
                            <>
                                <label>
                                    <span>
                                        <i className="fa-solid fa-calendar-plus" />
                                        De
                                    </span>
                                    <input name="from" type="date" defaultValue={filters.from} />
                                </label>
                                <label>
                                    <span>
                                        <i className="fa-solid fa-calendar-check" />
                                        Ate
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
                                <i className="fa-solid fa-table-list" />
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
                        <button className="ui-button" type="submit">
                            <i className="fa-solid fa-filter" />
                            <span>Aplicar</span>
                        </button>

                        <button className="ui-button-ghost" type="button" onClick={handleReset}>
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
                    <header className="report-table-header">
                        <div>
                            <small>Layout fixo</small>
                            <h2>Resultado do relatorio</h2>
                        </div>

                        <div className="report-table-pagination">
                            <span>
                                Pagina {pagination.current_page} de {pagination.last_page || 1}
                            </span>
                            <button type="button" onClick={() => goToPage(pagination.current_page - 1)} disabled={pagination.current_page <= 1}>
                                <i className="fa-solid fa-chevron-left" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(pagination.current_page + 1)}
                                disabled={pagination.current_page >= pagination.last_page}
                            >
                                <i className="fa-solid fa-chevron-right" />
                            </button>
                        </div>
                    </header>

                    <ReportTable columns={columns} rows={rows} emptyText={emptyText} />
                </section>
            </div>
        </AppLayout>
    )
}

import { Link, router, useForm, usePage } from '@inertiajs/react'
import { useCallback, useMemo, useState } from 'react'
import DashboardChartTooltip from '@/Components/Dashboard/DashboardChartTooltip'
import AppLayout from '@/Layouts/AppLayout'
import useResetPageHistoryOnLeave from '@/hooks/useResetPageHistoryOnLeave'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { invalidateCurrentInertiaHistoryPage } from '@/lib/inertiaHistory'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import './reports.css'

const DONUT_COLORS = ['#2563eb', '#14b8a6', '#7c3aed', '#f59e0b', '#ef4444', '#64748b']

const DONUT_STATUS_COLORS = {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
}

function matchDonutStatusTone(label = '') {
    const normalized = String(label).toLowerCase()

    if (normalized.includes('saudável') || normalized.includes('saudavel') || normalized.includes('com saldo')) {
        return 'success'
    }

    if (normalized.includes('baixo') || normalized.includes('perto do limite')) {
        return 'warning'
    }

    if (normalized.includes('sem saldo') || normalized.includes('sem limite')) {
        return 'danger'
    }

    return null
}

function resolveDonutColor(label, index) {
    const tone = matchDonutStatusTone(label)

    return tone ? DONUT_STATUS_COLORS[tone] : DONUT_COLORS[index % DONUT_COLORS.length]
}

const SCOPE_OPTIONS = [
    { key: 'date', label: 'Data', icon: 'fa-calendar-day' },
    { key: 'month', label: 'Mês', icon: 'fa-calendar' },
    { key: 'months', label: 'Meses', icon: 'fa-calendar-days' },
    { key: 'range', label: 'Período', icon: 'fa-arrow-right-long' },
    { key: 'year', label: 'Ano', icon: 'fa-hashtag' },
]

const QUICK_PRESETS = [
    { key: 'today', label: 'Hoje' },
    { key: 'last7', label: '7d' },
    { key: 'last30', label: '30d' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
]

const PER_PAGE_OPTIONS = [
    { value: '10', label: '10' },
    { value: '20', label: '20' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
]

const DIRECTION_OPTIONS = [
    { value: 'desc', label: 'Desc' },
    { value: 'asc', label: 'Asc' },
]

const FIELD_LABELS = {
    query: 'Buscar',
    payment_method: 'Pagamento',
    operator_id: 'Operador',
    customer_id: 'Cliente',
    category_id: 'Categoria',
    supplier_id: 'Fornecedor',
    stock_status: 'Status',
    balance_status: 'Carteira',
    sort_by: 'Ordenar',
    sort_direction: 'Direção',
    per_page: 'Linhas',
}

function toDateInput(date) {
    return date.toISOString().slice(0, 10)
}

function toMonthInput(date) {
    return date.toISOString().slice(0, 7)
}

function buildPresetPayload(key) {
    const now = new Date()

    if (key === 'today') {
        return {
            scope: 'date',
            date: toDateInput(now),
        }
    }

    if (key === 'last7') {
        const from = new Date(now)
        from.setDate(from.getDate() - 6)

        return {
            scope: 'range',
            from: toDateInput(from),
            to: toDateInput(now),
        }
    }

    if (key === 'last30') {
        const from = new Date(now)
        from.setDate(from.getDate() - 29)

        return {
            scope: 'range',
            from: toDateInput(from),
            to: toDateInput(now),
        }
    }

    if (key === 'year') {
        return {
            scope: 'year',
            year: String(now.getFullYear()),
        }
    }

    return {
        scope: 'month',
        month: toMonthInput(now),
    }
}

function buildFormState(filters = {}, schema = {}) {
    return {
        applied: Boolean(filters.applied),
        scope: filters.scope || 'month',
        date: filters.date || '',
        month: filters.month || '',
        month_from: filters.month_from || '',
        month_to: filters.month_to || '',
        year: filters.year || String(new Date().getFullYear()),
        from: filters.from || '',
        to: filters.to || '',
        query: filters.query || '',
        payment_method: filters.payment_method || '',
        operator_id: filters.operator_id || '',
        customer_id: filters.customer_id || '',
        category_id: filters.category_id || '',
        supplier_id: filters.supplier_id || '',
        stock_status: filters.stock_status || '',
        balance_status: filters.balance_status || '',
        sort_by: filters.sort_by || schema?.default_sort?.by || '',
        sort_direction: filters.sort_direction || schema?.default_sort?.direction || 'desc',
        per_page: String(filters.per_page || 20),
        page: String(filters.page || 1),
    }
}

function buildPayload(data, overrides = {}) {
    const payload = {
        ...data,
        ...overrides,
    }
    const scope = payload.scope || 'month'
    const periodPayload = {
        date: {
            date: payload.date,
        },
        month: {
            month: payload.month,
        },
        months: {
            month_from: payload.month_from,
            month_to: payload.month_to,
        },
        range: {
            from: payload.from,
            to: payload.to,
        },
        year: {
            year: payload.year,
        },
    }

    return Object.fromEntries(
        Object.entries({
            applied: payload.applied ? 1 : undefined,
            scope,
            ...(periodPayload[scope] || periodPayload.month),
            query: payload.query,
            payment_method: payload.payment_method,
            operator_id: payload.operator_id,
            customer_id: payload.customer_id,
            category_id: payload.category_id,
            supplier_id: payload.supplier_id,
            stock_status: payload.stock_status,
            balance_status: payload.balance_status,
            sort_by: payload.sort_by,
            sort_direction: payload.sort_direction,
            export: payload.export,
            page: payload.page,
            per_page: payload.per_page,
        }).filter(([, value]) => value != null && value !== ''),
    )
}

function buildExportPayload(filters, schema, format) {
    return buildPayload(buildFormState(filters, schema), {
        applied: true,
        export: format,
        page: 1,
    })
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

function buildPeriodLabel(filters, schema) {
    if (!schema?.fields?.includes('scope')) {
        return 'Carteira atual'
    }

    if (filters.scope === 'date') {
        return formatDate(filters.date)
    }

    if (filters.scope === 'year') {
        return filters.year
    }

    if (filters.scope === 'months') {
        return `${filters.month_from} até ${filters.month_to}`
    }

    if (filters.scope === 'range') {
        return `${formatDate(filters.from)} até ${formatDate(filters.to)}`
    }

    return filters.month
}

function resolveStatusTone(value = '') {
    const normalized = String(value).toLowerCase()

    if (normalized.includes('saudavel')) {
        return 'success'
    }

    if (normalized.includes('baixo') || normalized.includes('limite')) {
        return 'warning'
    }

    return 'danger'
}

function countActiveAdvancedFilters(data, visibleFields) {
    return visibleFields.filter((field) =>
        ['payment_method', 'operator_id', 'customer_id', 'category_id', 'supplier_id', 'stock_status', 'balance_status']
            .includes(field) && Boolean(data[field]),
    ).length
}

function EmptyState({ icon, label }) {
    return (
        <div className="report-empty-state">
            <i className={`fa-solid ${icon}`} />
            <span>{label}</span>
        </div>
    )
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
                {item.meta ? <span>{item.meta}</span> : null}
            </div>
        </article>
    )
}

function HighlightCard({ item }) {
    return (
        <article className={`report-highlight-card tone-${item.tone || 'neutral'}`}>
            <span>{item.label}</span>
            <strong>{renderValue(item.value, item.format)}</strong>
            {item.meta ? <small>{item.meta}</small> : null}
        </article>
    )
}

function ReportChartCard({ chart }) {
    const hasData = Array.isArray(chart?.data) && chart.data.length > 0
    const series = Array.isArray(chart?.series) ? chart.series : []
    const valueTypes = Object.fromEntries(series.map((item) => [item.key, item.format]))

    function renderChart() {
        if (!hasData) {
            return <EmptyState icon="fa-chart-column" label="Sem dados" />
        }

        if (chart.type === 'donut') {
            const valueKey = chart.value_key || 'total'
            const nameKey = chart.name_key || 'label'
            const total = chart.data.reduce((sum, entry) => sum + (Number(entry[valueKey]) || 0), 0)

            return (
                <div className="report-donut">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip
                                cursor={false}
                                content={(props) => (
                                    <DashboardChartTooltip
                                        {...props}
                                        valueTypes={{ [valueKey]: chart.format || 'money' }}
                                        resolveLabel={(payload) => payload?.[0]?.name ?? ''}
                                    />
                                )}
                            />
                            <Pie
                                data={chart.data}
                                dataKey={valueKey}
                                nameKey={nameKey}
                                startAngle={90}
                                endAngle={-270}
                                innerRadius={68}
                                outerRadius={92}
                                paddingAngle={3}
                                strokeWidth={0}
                                isAnimationActive={false}
                            >
                                {chart.data.map((entry, index) => (
                                    <Cell key={`${entry[nameKey]}-${index}`} fill={resolveDonutColor(entry[nameKey], index)} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>

                    <ul className="report-donut-legend">
                        {chart.data.map((entry, index) => {
                            const value = Number(entry[valueKey]) || 0
                            const percent = total > 0 ? Math.round((value / total) * 100) : 0

                            return (
                                <li key={`${entry[nameKey]}-${index}`}>
                                    <span
                                        className="report-donut-legend-dot"
                                        style={{ background: resolveDonutColor(entry[nameKey], index) }}
                                    />
                                    <span className="report-donut-legend-label">{entry[nameKey]}</span>
                                    <span className="report-donut-legend-value">{renderValue(value, chart.format)} · {percent}%</span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )
        }

        if (chart.type === 'area') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart.data}>
                        <defs>
                            {series
                                .filter((item) => item.variant === 'area')
                                .map((item) => (
                                    <linearGradient key={`${chart.key}-${item.key}`} id={`${chart.key}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={item.color} stopOpacity={0.28} />
                                        <stop offset="95%" stopColor={item.color} stopOpacity={0.02} />
                                    </linearGradient>
                                ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} stroke="#94a3b8" />
                        <YAxis hide />
                        <Tooltip cursor={false} content={(props) => <DashboardChartTooltip {...props} valueTypes={valueTypes} />} />
                        {series.map((item) => (
                            item.variant === 'line'
                                ? (
                                    <Line
                                        key={item.key}
                                        type="monotone"
                                        dataKey={item.key}
                                        name={item.label}
                                        stroke={item.color}
                                        strokeWidth={2.5}
                                        dot={false}
                                    />
                                )
                                : (
                                    <Area
                                        key={item.key}
                                        type="monotone"
                                        dataKey={item.key}
                                        name={item.label}
                                        stroke={item.color}
                                        strokeWidth={3}
                                        fill={`url(#${chart.key}-${item.key})`}
                                    />
                                )
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            )
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} stroke="#94a3b8" />
                    <YAxis hide />
                    <Tooltip cursor={false} content={(props) => <DashboardChartTooltip {...props} valueTypes={valueTypes} />} />
                    {series.map((item) => (
                        <Bar
                            key={item.key}
                            dataKey={item.key}
                            name={item.label}
                            fill={item.color}
                            radius={[10, 10, 0, 0]}
                            maxBarSize={28}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        )
    }

    return (
        <article className="report-chart-card">
            <header className="report-chart-header">
                <div>
                    <strong>{chart.title}</strong>
                    {chart.meta ? <span>{chart.meta}</span> : null}
                </div>
            </header>

            <div className="report-chart-stage">{renderChart()}</div>
        </article>
    )
}

function ReportTable({ columns, rows }) {
    if (!rows.length) {
        return <EmptyState icon="fa-table-list" label="Sem dados" />
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
                                <td key={column.key}>
                                    {(column.key === 'status' || column.format === 'status') && row[column.key]
                                        ? <span className={`report-status-chip tone-${resolveStatusTone(row[column.key])}`}>{row[column.key]}</span>
                                        : renderValue(row[column.key], column.format)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function ExportFormButton({ action, params, icon, label }) {
    return (
        <form className="report-export-form" action={action} method="get">
            {Object.entries(params).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={String(value)} />
            ))}

            <button type="submit" className="report-icon-button" aria-label={label} title={label}>
                <i className={`fa-solid ${icon}`} />
            </button>
        </form>
    )
}

export default function Show({
    report,
    filters,
    filterSchema,
    filterOptions,
    filtersApplied,
    summary = [],
    highlights = [],
    charts = [],
    columns = [],
    rows = [],
    pagination,
    backHref,
    table,
}) {
    const { url } = usePage()
    const reportPath = url.split('?')[0]
    const resetHistoryEntry = useCallback(() => {
        invalidateCurrentInertiaHistoryPage(reportPath)
    }, [reportPath])
    useResetPageHistoryOnLeave(resetHistoryEntry)
    const visibleFields = filterSchema?.fields || []
    const form = useForm(buildFormState(filters, filterSchema))
    const [advancedOpen, setAdvancedOpen] = useState(
        countActiveAdvancedFilters(form.data, visibleFields) > 0 || !filtersApplied,
    )
    const visibleHighlights = useMemo(() => highlights.filter(Boolean), [highlights])
    const visibleCharts = useMemo(() => charts.filter(Boolean), [charts])
    const pdfExportParams = useMemo(() => buildExportPayload(filters, filterSchema, 'pdf'), [filters, filterSchema])
    const excelExportParams = useMemo(() => buildExportPayload(filters, filterSchema, 'excel'), [filters, filterSchema])
    const activeAdvancedCount = countActiveAdvancedFilters(form.data, visibleFields)
    const showPeriodFilters = visibleFields.includes('scope')
    const showSearch = visibleFields.includes('query')
    const hasAdvancedFilters = visibleFields.some((field) =>
        ['payment_method', 'operator_id', 'customer_id', 'category_id', 'supplier_id', 'stock_status', 'balance_status', 'sort_by', 'sort_direction', 'per_page']
            .includes(field),
    )

    function submit(overrides = {}) {
        router.get(
            reportPath,
            buildPayload(form.data, {
                ...overrides,
                applied: true,
            }),
            {
                preserveScroll: true,
                replace: true,
            },
        )
    }

    function handleSubmit(event) {
        event.preventDefault()
        submit({ page: 1 })
    }

    function handlePreset(key) {
        submit({
            ...buildPresetPayload(key),
            page: 1,
        })
    }

    function handleReset() {
        router.get(
            reportPath,
            {},
            {
                preserveScroll: true,
                replace: true,
            },
        )
    }

    function goToPage(page) {
        if (!page || page === pagination.current_page || page < 1 || page > pagination.last_page) {
            return
        }

        submit({ page })
    }

    function renderScopeFields() {
        if (!showPeriodFilters) {
            return null
        }

        if (form.data.scope === 'date') {
            return (
                <label className="report-field">
                    <span>Data</span>
                    <input
                        name="date"
                        type="date"
                        value={form.data.date}
                        onChange={(event) => form.setData('date', event.target.value)}
                    />
                </label>
            )
        }

        if (form.data.scope === 'month') {
            return (
                <label className="report-field">
                    <span>Mês</span>
                    <input
                        name="month"
                        type="month"
                        value={form.data.month}
                        onChange={(event) => form.setData('month', event.target.value)}
                    />
                </label>
            )
        }

        if (form.data.scope === 'months') {
            return (
                <>
                    <label className="report-field">
                        <span>Mês de</span>
                        <input
                            name="month_from"
                            type="month"
                            value={form.data.month_from}
                            onChange={(event) => form.setData('month_from', event.target.value)}
                        />
                    </label>
                    <label className="report-field">
                        <span>Mês até</span>
                        <input
                            name="month_to"
                            type="month"
                            value={form.data.month_to}
                            onChange={(event) => form.setData('month_to', event.target.value)}
                        />
                    </label>
                </>
            )
        }

        if (form.data.scope === 'range') {
            return (
                <>
                    <label className="report-field">
                        <span>Data de</span>
                        <input
                            name="from"
                            type="date"
                            value={form.data.from}
                            onChange={(event) => form.setData('from', event.target.value)}
                        />
                    </label>
                    <label className="report-field">
                        <span>Data até</span>
                        <input
                            name="to"
                            type="date"
                            value={form.data.to}
                            onChange={(event) => form.setData('to', event.target.value)}
                        />
                    </label>
                </>
            )
        }

        return (
            <label className="report-field">
                <span>Ano</span>
                <input
                    name="year"
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.data.year}
                    onChange={(event) => form.setData('year', event.target.value)}
                />
            </label>
        )
    }

    function renderAdvancedField(field) {
        if (!visibleFields.includes(field)) {
            return null
        }

        if (field === 'sort_by') {
            return (
                <label key={field} className="report-field">
                    <span>{FIELD_LABELS[field]}</span>
                    <select value={form.data.sort_by} onChange={(event) => form.setData('sort_by', event.target.value)}>
                        {(filterSchema?.sort_options || []).map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            )
        }

        if (field === 'sort_direction') {
            return (
                <label key={field} className="report-field">
                    <span>{FIELD_LABELS[field]}</span>
                    <select value={form.data.sort_direction} onChange={(event) => form.setData('sort_direction', event.target.value)}>
                        {DIRECTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            )
        }

        if (field === 'per_page') {
            return (
                <label key={field} className="report-field">
                    <span>{FIELD_LABELS[field]}</span>
                    <select value={form.data.per_page} onChange={(event) => form.setData('per_page', event.target.value)}>
                        {PER_PAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            )
        }

        const optionMap = {
            payment_method: filterOptions.payment_methods,
            operator_id: filterOptions.operators,
            customer_id: filterOptions.customers,
            category_id: filterOptions.categories,
            supplier_id: filterOptions.suppliers,
            stock_status: filterOptions.stock_statuses,
            balance_status: filterOptions.balance_statuses,
        }

        return (
            <label key={field} className="report-field">
                <span>{FIELD_LABELS[field]}</span>
                <select value={form.data[field]} onChange={(event) => form.setData(field, event.target.value)}>
                    <option value="">Todos</option>
                    {(optionMap[field] || []).map((option) => (
                        <option key={`${field}-${option.value}`} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
        )
    }

    return (
        <AppLayout title={report.title} defaultCollapsed>
            <div className="report-screen">
                <header className="report-header">
                    <div className="report-header-main">
                        <Link href={backHref} className="report-icon-button" aria-label="Voltar">
                            <i className="fa-solid fa-arrow-left" />
                        </Link>

                        <div className="report-header-copy">
                            <div className="report-header-tags">
                                <span className="report-chip">
                                    <i className={`fa-solid ${report.category.icon}`} />
                                    {report.category.label}
                                </span>
                                {(report.tags || []).slice(0, 3).map((tag) => (
                                    <span key={`${report.key}-${tag}`} className="report-chip muted">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <h1>{report.title}</h1>
                        </div>
                    </div>

                    <div className="report-header-meta">
                        {filtersApplied ? (
                            <div className="report-header-actions">
                                <ExportFormButton
                                    action={reportPath}
                                    params={pdfExportParams}
                                    icon="fa-file-pdf"
                                    label="Exportar PDF"
                                />
                                <ExportFormButton
                                    action={reportPath}
                                    params={excelExportParams}
                                    icon="fa-file-excel"
                                    label="Exportar Excel"
                                />
                            </div>
                        ) : null}
                        <span className="report-chip soft">
                            <i className="fa-solid fa-calendar" />
                            {buildPeriodLabel(filters, filterSchema)}
                        </span>
                        {filtersApplied ? (
                            <span className="report-chip soft">
                                <i className="fa-solid fa-table-list" />
                                {pagination.total || 0}
                            </span>
                        ) : null}
                    </div>
                </header>

                <div className="report-layout">
                    <aside className="report-sidebar">
                        <form className="report-filter-form" onSubmit={handleSubmit}>
                            <div className="report-sidebar-block">
                                <p className="report-sidebar-title">Filtros</p>
                                <button type="button" className="report-sidebar-reset" onClick={handleReset}>
                                    <i className="fa-solid fa-rotate-left" />
                                    Limpar
                                </button>
                            </div>

                            {showPeriodFilters ? (
                                <>
                                    <div className="report-filter-presets">
                                        {QUICK_PRESETS.map((preset) => (
                                            <button
                                                key={preset.key}
                                                type="button"
                                                className="report-filter-pill"
                                                onClick={() => handlePreset(preset.key)}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="report-scope-list">
                                        {SCOPE_OPTIONS.map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                className={`report-scope-button ${form.data.scope === option.key ? 'active' : ''}`}
                                                onClick={() => form.setData('scope', option.key)}
                                            >
                                                <i className={`fa-solid ${option.icon}`} />
                                                <span>{option.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="report-filter-primary">
                                        {renderScopeFields()}
                                    </div>
                                </>
                            ) : null}

                            {showSearch ? (
                                <label className="report-field report-field-search">
                                    <span>{FIELD_LABELS.query}</span>
                                    <div className="report-search-shell">
                                        <i className="fa-solid fa-magnifying-glass" />
                                        <input
                                            type="text"
                                            value={form.data.query}
                                            placeholder={filterSchema?.search_placeholder || 'Pesquisar'}
                                            onChange={(event) => form.setData('query', event.target.value)}
                                        />
                                    </div>
                                </label>
                            ) : null}

                            {hasAdvancedFilters ? (
                                <>
                                    <button
                                        type="button"
                                        className={`report-advanced-toggle ${advancedOpen ? 'active' : ''}`}
                                        onClick={() => setAdvancedOpen((current) => !current)}
                                    >
                                        <i className="fa-solid fa-sliders" />
                                        <span>Mais filtros</span>
                                        {activeAdvancedCount ? <span className="report-advanced-count">{activeAdvancedCount}</span> : null}
                                        <i className={`fa-solid fa-chevron-${advancedOpen ? 'up' : 'down'} report-advanced-caret`} />
                                    </button>

                                    {advancedOpen ? (
                                        <div className="report-filter-grid">
                                            {[
                                                'operator_id',
                                                'customer_id',
                                                'category_id',
                                                'supplier_id',
                                                'payment_method',
                                                'stock_status',
                                                'balance_status',
                                                'sort_by',
                                                'sort_direction',
                                                'per_page',
                                            ].map((field) => renderAdvancedField(field))}
                                        </div>
                                    ) : null}
                                </>
                            ) : null}

                            <div className="report-filter-actions">
                                <button className="report-button report-button-primary report-button-block" type="submit">
                                    <i className="fa-solid fa-filter" />
                                    <span>Aplicar filtros</span>
                                </button>
                            </div>
                        </form>
                    </aside>

                    <main className="report-main">
                        {!filtersApplied ? (
                            <section className="report-empty-panel">
                                <EmptyState icon="fa-sliders" label="Aplique filtros" />
                            </section>
                        ) : (
                            <>
                                {summary.length ? (
                                    <>
                                        <p className="report-section-label"><i className="fa-solid fa-chart-simple" />Resumo geral</p>
                                        <section className="report-summary-grid">
                                            {summary.map((item) => (
                                                <SummaryCard key={item.label} item={item} />
                                            ))}
                                        </section>
                                    </>
                                ) : null}

                                {visibleHighlights.length ? (
                                    <>
                                        <p className="report-section-label"><i className="fa-solid fa-star" />Destaques</p>
                                        <section className="report-highlight-grid">
                                            {visibleHighlights.map((item) => (
                                                <HighlightCard key={`${item.label}-${item.meta || 'meta'}`} item={item} />
                                            ))}
                                        </section>
                                    </>
                                ) : null}

                                {visibleCharts.length ? (
                                    <>
                                        <p className="report-section-label"><i className="fa-solid fa-chart-column" />Análise gráfica</p>
                                        <section className="report-chart-grid">
                                            {visibleCharts.map((chart) => (
                                                <ReportChartCard key={chart.key} chart={chart} />
                                            ))}
                                        </section>
                                    </>
                                ) : null}

                                <section className="report-table-card">
                                    <header className="report-table-toolbar">
                                        <div className="report-table-copy">
                                            <strong>{table?.title || 'Detalhamento'}</strong>
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
                                    </header>

                                    <ReportTable columns={columns} rows={rows} />
                                </section>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </AppLayout>
    )
}

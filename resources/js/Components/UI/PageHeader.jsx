function pad(value) {
    return String(value).padStart(2, '0')
}

function formatInputDate(value) {
    if (!value) {
        return ''
    }

    const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : new Date(value)

    if (Number.isNaN(date.getTime())) {
        return ''
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function createRangeFromToday(days) {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(end)
    start.setDate(end.getDate() - Math.max(0, days - 1))

    return {
        from: formatInputDate(start),
        to: formatInputDate(end),
    }
}

function resolveQuickDates(enabled, customOptions) {
    if (Array.isArray(customOptions) && customOptions.length > 0) {
        return customOptions
    }

    if (!enabled) {
        return []
    }

    return [
        { key: 'today', label: 'Hoje', days: 1 },
        { key: 'last-7', label: '7d', days: 7 },
        { key: 'last-30', label: '30d', days: 30 },
    ]
}

export default function PageHeader({
    title,
    search = null,
    filters = [],
    activeFilter = null,
    onFilterChange = null,
    dateRange = null,
    quickDates = false,
    quickDateOptions = null,
    onReset = null,
    onApply = null,
    applyLabel = 'Filtrar',
    className = '',
}) {
    const quickDateButtons = resolveQuickDates(quickDates, quickDateOptions)
    const hasDateRange = Boolean(dateRange)
    const hasApplyButton = Boolean(onApply || search?.onApply || hasDateRange)
    const hasSecondaryTools = filters.length > 0 || quickDateButtons.length > 0

    function handleSearchChange(event) {
        search?.onChange?.(event.target.value, event)
    }

    function handleDateChange(field, value) {
        dateRange?.onChange?.({
            from: field === 'from' ? value : (dateRange?.from || ''),
            to: field === 'to' ? value : (dateRange?.to || ''),
        })
    }

    function handleQuickDateClick(option) {
        if (!dateRange?.onChange) {
            return
        }

        if (typeof option.onClick === 'function') {
            option.onClick()
            return
        }

        dateRange.onChange(createRangeFromToday(option.days || 1), option)
    }

    function handleApply() {
        const payload = {
            search: search?.value || '',
            from: dateRange?.from || '',
            to: dateRange?.to || '',
        }

        if (typeof onApply === 'function') {
            onApply(payload)
            return
        }

        if (typeof search?.onApply === 'function') {
            search.onApply(payload.search, payload)
        }

        if (typeof dateRange?.onApply === 'function') {
            dateRange.onApply({
                from: payload.from,
                to: payload.to,
            }, payload)
            return
        }

        if (typeof dateRange?.onChange === 'function') {
            dateRange.onChange({
                from: payload.from,
                to: payload.to,
            })
        }
    }

    function handleReset() {
        if (typeof onReset === 'function') {
            onReset()
            return
        }

        search?.onChange?.('')
        search?.onApply?.('', { search: '', from: '', to: '' })
        dateRange?.onChange?.({ from: '', to: '' })

        const firstFilter = filters[0]
        const firstFilterValue = firstFilter?.value

        if (typeof firstFilter?.onClick === 'function') {
            firstFilter.onClick(firstFilterValue, firstFilter)
        } else if (onFilterChange && firstFilterValue !== undefined) {
            onFilterChange(firstFilterValue, firstFilter)
        }
    }

    return (
        <section className={['ui-page-header', className].filter(Boolean).join(' ')}>
            {title ? <h1 className="ui-page-header-title">{title}</h1> : null}

            <div className="ui-page-header-row">
                <label className="ui-page-header-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                        type="search"
                        placeholder={search?.placeholder || 'Buscar'}
                        value={search?.value || ''}
                        onChange={handleSearchChange}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                handleApply()
                            }
                        }}
                    />
                </label>

                <div className="ui-page-header-date-tools">
                    {hasDateRange ? (
                        <div className="ui-page-header-date-range">
                            <input
                                aria-label="Data inicial"
                                type="date"
                                value={dateRange?.from || ''}
                                onChange={(event) => handleDateChange('from', event.target.value)}
                            />
                            <span className="ui-page-header-date-separator">
                                <i className="fa-solid fa-arrow-right" />
                            </span>
                            <input
                                aria-label="Data final"
                                type="date"
                                value={dateRange?.to || ''}
                                onChange={(event) => handleDateChange('to', event.target.value)}
                            />
                        </div>
                    ) : null}

                    {hasApplyButton ? (
                        <button
                            type="button"
                            className="ui-page-header-apply"
                            onClick={handleApply}
                        >
                            <i className="fa-solid fa-filter" />
                            <span>{applyLabel}</span>
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className="ui-page-header-reset ui-tooltip"
                        data-tooltip="Resetar filtros"
                        title="Resetar filtros"
                        onClick={handleReset}
                    >
                        <i className="fa-solid fa-rotate-left" />
                    </button>
                </div>
            </div>

            {hasSecondaryTools ? (
                <div className="ui-page-header-row secondary">
                    <div className="ui-page-header-filters" role="tablist" aria-label={`${title || 'Lista'} filtros`}>
                        {filters.map((filter) => {
                            const isActive = Boolean(filter.active) || (activeFilter !== null && filter.value === activeFilter)

                            return (
                                <button
                                    key={filter.key || filter.value || filter.label}
                                    type="button"
                                    className={`ui-page-header-filter ${isActive ? 'active' : ''}`}
                                    disabled={filter.disabled}
                                    onClick={() => {
                                        if (typeof filter.onClick === 'function') {
                                            filter.onClick(filter.value, filter)
                                            return
                                        }

                                        onFilterChange?.(filter.value, filter)
                                    }}
                                >
                                    <span>{filter.label}</span>
                                    {filter.count !== undefined ? <strong>{filter.count}</strong> : null}
                                </button>
                            )
                        })}
                    </div>

                    <div className="ui-page-header-quick-dates">
                        {quickDateButtons.map((option) => (
                            <button
                                key={option.key || option.label}
                                type="button"
                                className={`ui-page-header-quick-date ${option.active ? 'active' : ''}`}
                                onClick={() => handleQuickDateClick(option)}
                            >
                                {option.icon ? <i className={`fa-solid ${option.icon}`} /> : null}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </section>
    )
}

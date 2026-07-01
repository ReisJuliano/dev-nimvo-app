import { useEffect, useMemo, useState } from 'react'

function readCollapsedPreference(storageKey, initialCollapsed, persistCollapsed) {
    if (!persistCollapsed || typeof window === 'undefined') {
        return initialCollapsed
    }

    try {
        const storedValue = window.localStorage.getItem(storageKey)

        if (storedValue === '1') {
            return true
        }

        if (storedValue === '0') {
            return false
        }
    } catch {
        return initialCollapsed
    }

    return initialCollapsed
}

export default function ActionSidebar({
    storageKey,
    actions = [],
    title = 'A??es',
    initialCollapsed = true,
    persistCollapsed = true,
    className = '',
}) {
    const resolvedStorageKey = storageKey || `ui-action-sidebar:${title.toLowerCase().replace(/\s+/g, '-')}`
    const [collapsed, setCollapsed] = useState(() => readCollapsedPreference(resolvedStorageKey, initialCollapsed, persistCollapsed))

    useEffect(() => {
        if (!persistCollapsed || typeof window === 'undefined') {
            return
        }

        try {
            window.localStorage.setItem(resolvedStorageKey, collapsed ? '1' : '0')
        } catch {
            return
        }
    }, [collapsed, persistCollapsed, resolvedStorageKey])

    useEffect(() => {
        if (persistCollapsed || typeof window === 'undefined') {
            return
        }

        try {
            window.localStorage.removeItem(resolvedStorageKey)
        } catch {
            return
        }
    }, [persistCollapsed, resolvedStorageKey])

    const visibleActions = useMemo(
        () => (actions || []).filter((action) => action && action.visible !== false),
        [actions],
    )

    return (
        <aside className={['ui-action-sidebar', collapsed ? 'is-collapsed' : 'is-expanded', className].filter(Boolean).join(' ')}>
            <button
                type="button"
                className="ui-action-sidebar-toggle"
                title={collapsed ? 'Expandir ações' : 'Recolher ações'}
                onClick={() => setCollapsed((current) => !current)}
            >
                <i className={`fa-solid ${collapsed ? 'fa-angles-left' : 'fa-angles-right'}`} />
            </button>

            <div className="ui-action-sidebar-list" aria-label={title}>
                {visibleActions.map((action) => (
                    <button
                        key={action.key || action.label}
                        type="button"
                        disabled={action.disabled}
                        className={[
                            'ui-action-sidebar-item',
                            action.tone ? `tone-${action.tone}` : 'tone-neutral',
                            action.dividerBefore ? 'has-divider' : '',
                        ].filter(Boolean).join(' ')}
                        data-tooltip={collapsed ? action.label : undefined}
                        title={collapsed ? action.label : action.label}
                        onClick={action.onClick}
                    >
                        <span className="ui-action-sidebar-icon">
                            <i className={`fa-solid ${action.icon}`} />
                        </span>
                        <span className="ui-action-sidebar-label">{action.label}</span>
                    </button>
                ))}
            </div>
        </aside>
    )
}

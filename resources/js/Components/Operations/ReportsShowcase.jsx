import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'

const ALL_CATEGORY_KEY = '__all__'

const CATEGORY_COLOR_KEYS = {
    sales: 'vendas',
    products: 'produtos',
    stock: 'estoque',
    cashflow: 'fluxo',
    receivables: 'receber',
    customers: 'clientes',
}

function categoryColorKey(key) {
    return CATEGORY_COLOR_KEYS[key] || 'todos'
}

function categoryColorVars(key) {
    const colorKey = categoryColorKey(key)
    const prefix = `--report-cat-${colorKey}`

    return {
        '--cat-bg': `var(${prefix}-bg)`,
        '--cat-bg-strong': `var(${prefix}-bg-strong)`,
        '--cat-fg': `var(${prefix}-fg)`,
        '--cat-border': `var(${prefix}-border)`,
    }
}

function ReportCategoryButton({ category, active, onClick }) {
    return (
        <button
            type="button"
            className={`operations-report-category ${active ? 'active' : ''}`}
            style={categoryColorVars(category.key)}
            onClick={onClick}
        >
            <span className="operations-report-category-icon">
                <i className={`fa-solid ${category.icon}`} />
            </span>
            <span className="operations-report-category-copy">
                <strong>{category.label}</strong>
                <small>{category.report_count} relatório{category.report_count === 1 ? '' : 's'}</small>
            </span>
        </button>
    )
}

function ReportOpenCard({ report, showCategory }) {
    return (
        <Link href={report.href} className="operations-report-open-card" style={categoryColorVars(report.categoryKey)}>
            <div className="operations-report-open-top">
                <span className="operations-report-card-icon">
                    <i className={`fa-solid ${report.icon}`} />
                </span>
                <span className="operations-report-open-action">
                    <i className="fa-solid fa-arrow-up-right-from-square" />
                </span>
            </div>

            <div className="operations-report-open-copy">
                {showCategory && report.categoryLabel ? (
                    <span className="operations-report-open-category">{report.categoryLabel}</span>
                ) : null}
                <strong>{report.title}</strong>
            </div>

            <div className="operations-report-open-tags">
                {report.tags.slice(0, 3).map((tag) => (
                    <span key={`${report.key}-${tag}`} className="operations-report-tag">
                        {tag}
                    </span>
                ))}
            </div>
        </Link>
    )
}

export default function ReportsShowcase({ module }) {
    const categories = Array.isArray(module?.catalog?.categories) ? module.catalog.categories : []
    const initialCategory = module?.catalog?.activeCategory || categories[0]?.key || null
    const [activeCategoryKey, setActiveCategoryKey] = useState(initialCategory)
    const searchControl = useConfirmedSearch('')

    useEffect(() => {
        setActiveCategoryKey(module?.catalog?.activeCategory || categories[0]?.key || null)
    }, [module?.catalog?.activeCategory, categories])

    const allReports = useMemo(() => (
        categories.flatMap((category) => (
            (category.reports || []).map((report) => ({ ...report, categoryLabel: category.label, categoryKey: category.key }))
        ))
    ), [categories])

    const totalReportCount = allReports.length
    const currentCategory = categories.find((category) => category.key === activeCategoryKey) || categories[0]
    const isAllSelected = activeCategoryKey === ALL_CATEGORY_KEY

    const normalizedTerm = normalizeTextSearch(searchControl.draftValue)
    const isSearching = normalizedTerm.length > 0

    // Enquanto o usuário digita, a busca vale para todos os relatórios,
    // independente da categoria selecionada — evita a sensação de que um
    // relatório "sumiu" só porque estava em outra categoria.
    const baseReports = useMemo(() => {
        if (isSearching || isAllSelected) {
            return allReports
        }

        return (currentCategory?.reports || []).map((report) => ({ ...report, categoryLabel: currentCategory?.label, categoryKey: currentCategory?.key }))
    }, [isSearching, isAllSelected, allReports, currentCategory])

    const filteredReports = useMemo(() => {
        if (!isSearching) {
            return baseReports
        }

        return baseReports.filter((report) =>
            matchesTextSearchAny([report.title, report.categoryLabel, ...(report.tags || [])], normalizedTerm),
        )
    }, [baseReports, isSearching, normalizedTerm])

    if (!currentCategory) {
        return (
            <section className="operations-report-preview-hero">
                <div>
                    <span className="operations-section-kicker">Relatórios</span>
                    <h2>Nenhum relatório disponível</h2>
                </div>
            </section>
        )
    }

    const heroLabel = isSearching
        ? `Resultados para "${searchControl.draftValue.trim()}"`
        : isAllSelected
            ? 'Todos os relatórios'
            : currentCategory.label

    const heroIcon = !isSearching && !isAllSelected ? currentCategory.icon : 'fa-layer-group'
    const heroColorKey = isSearching || isAllSelected ? null : currentCategory.key

    return (
        <div className="operations-reports-showcase">
            <aside className="operations-reports-sidebar">
                <p className="operations-reports-sidebar-title">Categorias</p>

                <div className="operations-report-category-bar">
                    <button
                        type="button"
                        className={`operations-report-category ${isAllSelected ? 'active' : ''}`}
                        style={categoryColorVars(null)}
                        onClick={() => setActiveCategoryKey(ALL_CATEGORY_KEY)}
                    >
                        <span className="operations-report-category-icon">
                            <i className="fa-solid fa-layer-group" />
                        </span>
                        <span className="operations-report-category-copy">
                            <strong>Todos</strong>
                            <small>{totalReportCount} relatórios</small>
                        </span>
                    </button>

                    {categories.map((category) => (
                        <ReportCategoryButton
                            key={category.key}
                            category={category}
                            active={!isSearching && category.key === activeCategoryKey}
                            onClick={() => setActiveCategoryKey(category.key)}
                        />
                    ))}
                </div>
            </aside>

            <main className="operations-reports-main">
                <section className="operations-report-search-bar">
                    <label className="operations-report-search">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            type="text"
                            value={searchControl.draftValue}
                            onChange={(event) => searchControl.setDraftValue(event.target.value)}
                            placeholder="Buscar relatório em todas as categorias..."
                        />
                        {searchControl.draftValue ? (
                            <button type="button" className="operations-report-search-clear" onClick={() => searchControl.clear()} aria-label="Limpar busca">
                                <i className="fa-solid fa-xmark" />
                            </button>
                        ) : null}
                    </label>
                </section>

                <section className="operations-report-preview-hero compact" style={categoryColorVars(heroColorKey)}>
                    <div className="operations-report-preview-heading">
                        <span className="operations-report-preview-icon">
                            <i className={`fa-solid ${heroIcon}`} />
                        </span>
                        <div>
                            <span className="operations-section-kicker">{isSearching ? 'Busca' : 'Categoria'}</span>
                            <h2>{heroLabel}</h2>
                        </div>
                    </div>
                    <div className="operations-report-preview-badges">
                        <span className="operations-report-preview-count">{filteredReports.length} visões</span>
                    </div>
                </section>

                <section className={`operations-report-open-grid ${filteredReports.length > 0 && filteredReports.length <= 4 ? 'is-compact' : ''}`}>
                    {filteredReports.length ? (
                        filteredReports.map((report) => (
                            <ReportOpenCard key={report.key} report={report} showCategory={isSearching || isAllSelected} />
                        ))
                    ) : (
                        <div className="operations-empty-state">Nenhum relatório encontrado para essa busca</div>
                    )}
                </section>
            </main>
        </div>
    )
}

import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'

function ReportCategoryButton({ category, active, onClick }) {
    return (
        <button
            type="button"
            className={`operations-report-category ${active ? 'active' : ''}`}
            onClick={onClick}
        >
            <span className="operations-report-category-icon">
                <i className={`fa-solid ${category.icon}`} />
            </span>
            <span className="operations-report-category-copy">
                <strong>{category.label}</strong>
                <small>{category.report_count} relatórios</small>
            </span>
        </button>
    )
}

function ReportOpenCard({ report }) {
    return (
        <Link href={report.href} className="operations-report-open-card">
            <div className="operations-report-open-top">
                <span className="operations-report-category-icon">
                    <i className={`fa-solid ${report.icon}`} />
                </span>
                <span className="operations-report-open-action">
                    <i className="fa-solid fa-arrow-up-right-from-square" />
                </span>
            </div>

            <div className="operations-report-open-copy">
                <strong>{report.title}</strong>
            </div>

            <div className="operations-report-open-tags">
                {report.tags.slice(0, 3).map((tag) => (
                    <span key={`${report.key}-${tag}`} className="ui-badge">
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

    const currentCategory = categories.find((category) => category.key === activeCategoryKey) || categories[0]
    const filteredReports = useMemo(() => {
        const normalizedTerm = normalizeTextSearch(searchControl.value)

        if (!currentCategory) {
            return []
        }

        if (!normalizedTerm) {
            return currentCategory.reports
        }

        return currentCategory.reports.filter((report) =>
            matchesTextSearchAny([report.title, ...(report.tags || [])], normalizedTerm),
        )
    }, [currentCategory, searchControl.value])

    if (!currentCategory) {
        return (
            <section className="operations-report-preview-hero">
                <div>
                    <span className="operations-section-kicker">Relatorios</span>
                    <h2>Nenhum relatório disponível</h2>
                </div>
            </section>
        )
    }

    return (
        <div className="operations-reports-showcase">
            <section className="operations-report-toolbar">
                <div className="operations-report-category-bar">
                    {categories.map((category) => (
                        <ReportCategoryButton
                            key={category.key}
                            category={category}
                            active={category.key === currentCategory.key}
                            onClick={() => setActiveCategoryKey(category.key)}
                        />
                    ))}
                </div>

                <label className="operations-report-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                        type="text"
                        value={searchControl.draftValue}
                        onChange={(event) => searchControl.setDraftValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') {
                                return
                            }

                            event.preventDefault()
                            searchControl.apply()
                        }}
                        placeholder="Buscar relatório"
                    />
                    <button type="button" className="report-icon-button wide" onClick={() => searchControl.apply()}>
                        <i className="fa-solid fa-magnifying-glass" />
                        <span>Pesquisar</span>
                    </button>
                </label>
            </section>

            <section className="operations-report-preview-hero compact">
                <div>
                    <span className="operations-section-kicker">Categoria</span>
                    <h2>{currentCategory.label}</h2>
                </div>
                <div className="operations-report-preview-badges">
                    <span className="ui-badge success">{filteredReports.length} visoes</span>
                </div>
            </section>

            <section className="operations-report-open-grid">
                {filteredReports.length ? (
                    filteredReports.map((report) => (
                        <ReportOpenCard key={report.key} report={report} />
                    ))
                ) : (
                    <div className="operations-empty-state">Sem relatórios</div>
                )}
            </section>
        </div>
    )
}

import { useEffect, useState } from 'react'

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
                <small>{category.report_count} relatorios</small>
                <strong>{category.label}</strong>
            </span>
        </button>
    )
}

function ReportOpenCard({ report }) {
    return (
        <a
            href={report.href}
            target="_blank"
            rel="noreferrer"
            className="operations-report-open-card"
        >
            <div className="operations-report-open-top">
                <span className="operations-report-category-icon">
                    <i className={`fa-solid ${report.icon}`} />
                </span>
                <span className="operations-report-open-action">
                    <i className="fa-solid fa-up-right-from-square" />
                </span>
            </div>
            <div className="operations-report-open-copy">
                <strong>{report.title}</strong>
            </div>
            <div className="operations-report-open-tags">
                {report.tags.map((tag) => (
                    <span key={`${report.key}-${tag}`} className="ui-badge">
                        {tag}
                    </span>
                ))}
            </div>
        </a>
    )
}

export default function ReportsShowcase({ module }) {
    const categories = Array.isArray(module?.catalog?.categories) ? module.catalog.categories : []
    const initialCategory = module?.catalog?.activeCategory || categories[0]?.key || null
    const [activeCategoryKey, setActiveCategoryKey] = useState(initialCategory)

    useEffect(() => {
        setActiveCategoryKey(module?.catalog?.activeCategory || categories[0]?.key || null)
    }, [module?.catalog?.activeCategory, categories])

    const currentCategory = categories.find((category) => category.key === activeCategoryKey) || categories[0]

    if (!currentCategory) {
        return (
            <section className="operations-report-preview-hero">
                <div>
                    <span className="operations-section-kicker">Relatorios</span>
                    <h2>Nenhum relatorio disponivel</h2>
                </div>
            </section>
        )
    }

    return (
        <div className="operations-reports-showcase">
            <section className="operations-report-category-bar">
                {categories.map((category) => (
                    <ReportCategoryButton
                        key={category.key}
                        category={category}
                        active={category.key === currentCategory.key}
                        onClick={() => setActiveCategoryKey(category.key)}
                    />
                ))}
            </section>

            <section className="operations-report-preview-hero">
                <div>
                    <span className="operations-section-kicker">Categoria</span>
                    <h2>{currentCategory.label}</h2>
                </div>
                <div className="operations-report-preview-badges">
                    <span className="ui-badge success">{currentCategory.report_count} opcao(oes)</span>
                    <span className="ui-badge warning">Nova guia</span>
                </div>
            </section>

            <section className="operations-report-open-grid">
                {currentCategory.reports.map((report) => (
                    <ReportOpenCard key={report.key} report={report} />
                ))}
            </section>
        </div>
    )
}

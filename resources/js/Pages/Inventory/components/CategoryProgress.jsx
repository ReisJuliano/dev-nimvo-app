export default function CategoryProgress({ categories = [] }) {
    if (!categories.length) {
        return null
    }

    return (
        <div className="nimvo-card ivs-category-card">
            <div className="ivs-category-header">
                <i className="fa-solid fa-shapes" />
                <div>
                    <strong>Progresso por setor</strong>
                    <span>Categorias da loja — orienta o time durante a contagem com a loja aberta</span>
                </div>
            </div>

            <div className="ivs-category-list">
                {categories.map((category) => (
                    <div key={category.category_id ?? 'none'} className="ivs-category-row">
                        <div className="ivs-category-row-top">
                            <span>{category.category_name}</span>
                            <b>{category.counted_items}/{category.total_items}</b>
                        </div>
                        <div className="ivs-progress-track ivs-progress-track--sm">
                            <span
                                className={`ivs-progress-fill ${category.divergent_items > 0 ? 'ivs-progress-fill--warning' : ''}`}
                                style={{ width: `${Math.min(100, category.progress_percent)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

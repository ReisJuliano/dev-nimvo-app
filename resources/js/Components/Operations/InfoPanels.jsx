export default function InfoPanels({ panels }) {
    if (!panels?.length) {
        return null
    }

    return (
        <section className="operations-panel-grid">
            {panels.map((panel) => (
                <article key={panel.title} className="operations-panel-card">
                    <header>
                        <h2>{panel.title}</h2>
                    </header>

                    <div className="operations-panel-list">
                        {panel.items.map((item) => (
                            <div key={`${panel.title}-${item.label}`} className="operations-panel-item">
                                <div>
                                    <strong>{item.label}</strong>
                                    <span>{item.meta}</span>
                                </div>
                                <b>{item.value}</b>
                            </div>
                        ))}
                    </div>
                </article>
            ))}
        </section>
    )
}

const highlights = [
    {
        title: 'PDV',
        description: 'Visual inspirado no sistema original para reduzir a curva de adaptacao.',
    },
    {
        title: 'React',
        description: 'Campos controlados, feedback imediato e interface responsiva.',
    },
    {
        title: 'Inertia',
        description: 'Envio direto para o backend Laravel sem perder a navegacao fluida.',
    },
]

export default function GuestBrandPanel() {
    return (
        <section className="guest-panel">
            <div>
                <div className="guest-brand">
                    <div className="guest-brand-mark">
                        <img
                            src="/assets/img/logo.png"
                            alt="Nimvo"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none'
                                event.currentTarget.parentElement.innerHTML =
                                    '<i class="fas fa-store" style="font-size:28px;color:white"></i>'
                            }}
                        />
                    </div>

                    <div>
                        <div className="guest-brand-tag">
                            <i className="fas fa-sparkles" />
                            Sistema Inteligente
                        </div>
                        <h1 className="guest-brand-title">Nimvo para gestao diaria com mais clareza.</h1>
                    </div>
                </div>

                <div className="guest-brand-copy">
                    <p>
                        Acesso rapido para equipe, operacao e administracao em uma interface alinhada ao visual do
                        PDV, agora conectada ao fluxo React + Inertia deste projeto.
                    </p>
                </div>

                <div className="guest-highlights">
                    {highlights.map((item) => (
                        <div key={item.title} className="guest-highlight">
                            <strong>{item.title}</strong>
                            <span>{item.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

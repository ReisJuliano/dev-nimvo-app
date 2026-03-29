export default function DashboardHero({ userName }) {
    return (
        <section className="dashboard-hero">
            <span className="dashboard-kicker">
                <i className="fas fa-wave-square" />
                Painel Principal
            </span>

            <h2>Bem-vindo, {userName}.</h2>
            <p>Acesse os modulos disponiveis para continuar o trabalho.</p>
        </section>
    )
}

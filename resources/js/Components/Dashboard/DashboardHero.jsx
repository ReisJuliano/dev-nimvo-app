export default function DashboardHero({ userName }) {
    return (
        <section className="dashboard-hero">
            <span className="dashboard-kicker">
                <i className="fas fa-wave-square" />
                Painel Principal
            </span>

            <h2>Bem-vindo, {userName}.</h2>
            <p>
                Seu acesso foi concluido com sucesso. O sistema agora segue um fluxo mais organizado, com login,
                validacao, redirecionamento e layout separados para facilitar futuras manutencoes.
            </p>
        </section>
    )
}

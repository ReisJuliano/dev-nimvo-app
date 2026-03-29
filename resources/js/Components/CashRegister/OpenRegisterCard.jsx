export default function OpenRegisterCard({ onSubmit, loading }) {
    return (
        <section className="cash-register-card open">
            <div className="cash-register-section-header">
                <div>
                    <span className="cash-register-section-kicker">Abertura</span>
                    <h2>Caixa fechado</h2>
                    <p>Informe o valor inicial do caixa.</p>
                </div>
            </div>

            <form className="cash-register-form" onSubmit={onSubmit}>
                <label>
                    Valor de abertura
                    <input name="opening_amount" type="number" step="0.01" min="0" defaultValue="0" />
                </label>
                <label>
                    Observacao
                    <textarea name="opening_notes" rows="3" />
                </label>
                <button className="cash-register-primary-button" disabled={loading}>
                    <i className="fa-solid fa-lock-open" />
                    {loading ? 'Abrindo...' : 'Abrir caixa'}
                </button>
            </form>
        </section>
    )
}

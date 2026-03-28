export default function OpenRegisterCard({ onSubmit, loading }) {
    return (
        <section className="cash-register-card open">
            <div>
                <h2>Caixa fechado</h2>
                <p>Informe o valor inicial para liberar o operador no PDV atual.</p>
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
                    {loading ? 'Abrindo...' : 'Abrir caixa'}
                </button>
            </form>
        </section>
    )
}

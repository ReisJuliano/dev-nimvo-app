import { formatDateTime, formatMoney } from '@/lib/format'

export default function ActiveRegisterPanel({ report, onMovement, onClose }) {
    const {
        cashRegister,
        payments,
        movements,
        total_sales,
        sales_count,
        expected_cash,
        total_withdrawals,
        total_supplies,
        cash_sales,
    } = report

    return (
        <div className="cash-register-grid">
            <section className="cash-register-card status">
                <div className="cash-register-status-hero">
                    <div>
                        <span>Caixa aberto</span>
                        <h2>{formatMoney(total_sales)}</h2>
                        <p>{sales_count} venda(s) associadas a este caixa</p>
                    </div>
                    <div>
                        <strong>Operador</strong>
                        <span>{cashRegister.user_name}</span>
                        <small>Aberto em {formatDateTime(cashRegister.opened_at)}</small>
                    </div>
                </div>

                <div className="cash-register-summary-grid">
                    <article>
                        <span>Abertura</span>
                        <strong>{formatMoney(cashRegister.opening_amount)}</strong>
                    </article>
                    <article>
                        <span>Dinheiro vendido</span>
                        <strong>{formatMoney(cash_sales)}</strong>
                    </article>
                    <article>
                        <span>Suprimentos</span>
                        <strong>{formatMoney(total_supplies)}</strong>
                    </article>
                    <article>
                        <span>Sangrias</span>
                        <strong>{formatMoney(total_withdrawals)}</strong>
                    </article>
                </div>

                <div className="cash-register-payments">
                    {payments.length ? (
                        payments.map((payment) => (
                            <article key={payment.payment_method}>
                                <span>{payment.label}</span>
                                <strong>{formatMoney(payment.total)}</strong>
                                <small>{payment.qtd} lancamento(s)</small>
                            </article>
                        ))
                    ) : (
                        <div className="cash-register-empty">Nenhuma venda registrada neste caixa.</div>
                    )}
                </div>
            </section>

            <section className="cash-register-card">
                <div className="cash-register-section-header">
                    <div>
                        <h2>Movimentacoes</h2>
                        <p>Registre retirada e reforco de caixa conforme a operacao.</p>
                    </div>
                </div>

                <div className="cash-register-actions-grid">
                    <form onSubmit={(event) => onMovement(event, 'withdrawal')}>
                        <strong>Sangria</strong>
                        <input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" />
                        <input name="reason" placeholder="Motivo" />
                        <button>Registrar retirada</button>
                    </form>

                    <form onSubmit={(event) => onMovement(event, 'supply')}>
                        <strong>Suprimento</strong>
                        <input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" />
                        <input name="reason" placeholder="Motivo" />
                        <button>Registrar entrada</button>
                    </form>
                </div>

                <div className="cash-register-movements-list">
                    {movements.length ? (
                        movements.map((movement) => (
                            <div key={movement.id} className="cash-register-movement-row">
                                <div>
                                    <strong>{movement.type === 'withdrawal' ? 'Sangria' : 'Suprimento'}</strong>
                                    <span>{movement.reason || 'Sem observacao'}</span>
                                </div>
                                <div>
                                    <strong>{formatMoney(movement.amount)}</strong>
                                    <small>{formatDateTime(movement.created_at)}</small>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="cash-register-empty">Nenhuma movimentacao registrada.</div>
                    )}
                </div>
            </section>

            <section className="cash-register-card">
                <h2>Fechamento</h2>
                <p>Dinheiro esperado em caixa: {formatMoney(expected_cash)}</p>

                <form className="cash-register-form" onSubmit={onClose}>
                    <label>
                        Valor contado
                        <input name="closing_amount" type="number" step="0.01" min="0" required />
                    </label>
                    <label>
                        Observacao
                        <textarea name="closing_notes" rows="3" />
                    </label>
                    <button className="cash-register-danger-button">Fechar caixa</button>
                </form>
            </section>
        </div>
    )
}

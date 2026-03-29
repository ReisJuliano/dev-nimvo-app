import { formatDateTime, formatMoney } from '@/lib/format'

export default function ActiveRegisterPanel({ report, onMovement, onClose, onStartCloseConference, requireConference }) {
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
                        <span className="cash-register-hero-chip">Caixa em operacao</span>
                        <h2>{formatMoney(total_sales)}</h2>
                        <p>{sales_count} venda(s) registradas</p>
                    </div>
                    <div className="cash-register-hero-meta">
                        <span className="cash-register-hero-label">Operador</span>
                        <strong>{cashRegister.user_name}</strong>
                        <small>Aberto em {formatDateTime(cashRegister.opened_at)}</small>
                    </div>
                </div>

                <div className="cash-register-summary-grid">
                    <article className="tone-primary">
                        <span>Abertura</span>
                        <strong>{formatMoney(cashRegister.opening_amount)}</strong>
                    </article>
                    <article className="tone-info">
                        <span>Dinheiro vendido</span>
                        <strong>{formatMoney(cash_sales)}</strong>
                    </article>
                    <article className="tone-success">
                        <span>Suprimentos</span>
                        <strong>{formatMoney(total_supplies)}</strong>
                    </article>
                    <article className="tone-danger">
                        <span>Sangrias</span>
                        <strong>{formatMoney(total_withdrawals)}</strong>
                    </article>
                </div>

                <div className="cash-register-subsection">
                    <div className="cash-register-section-header compact">
                        <div>
                            <span className="cash-register-section-kicker">Resumo financeiro</span>
                            <h2>Formas de pagamento</h2>
                        </div>
                    </div>
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
                        <span className="cash-register-section-kicker">Operacao manual</span>
                        <h2>Movimentacoes</h2>
                        <p>Registre sangrias e suprimentos.</p>
                    </div>
                </div>

                <div className="cash-register-actions-grid">
                    <form className="cash-register-action-form tone-danger" onSubmit={(event) => onMovement(event, 'withdrawal')}>
                        <span className="cash-register-form-chip">Saida</span>
                        <strong>Sangria</strong>
                        <input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" />
                        <input name="reason" placeholder="Motivo" />
                        <button>
                            <i className="fa-solid fa-arrow-up-right-from-square" />
                            Registrar retirada
                        </button>
                    </form>

                    <form className="cash-register-action-form tone-success" onSubmit={(event) => onMovement(event, 'supply')}>
                        <span className="cash-register-form-chip">Entrada</span>
                        <strong>Suprimento</strong>
                        <input name="amount" type="number" step="0.01" min="0.01" placeholder="Valor" />
                        <input name="reason" placeholder="Motivo" />
                        <button>
                            <i className="fa-solid fa-arrow-down-left-and-arrow-up-right-to-center" />
                            Registrar entrada
                        </button>
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
                <div className="cash-register-section-header">
                    <div>
                        <span className="cash-register-section-kicker">Conferencia final</span>
                        <h2>Fechamento</h2>
                        <p>Base de caixa em dinheiro: {formatMoney(expected_cash)}</p>
                    </div>
                </div>

                {requireConference ? (
                    <div className="cash-register-form">
                        <div className="cash-register-inline-alert">
                            <strong>Conferencia guiada habilitada</strong>
                            <span>Revise dinheiro, Pix, cartoes, crediario, sangrias e suprimentos antes de concluir.</span>
                        </div>
                        <button className="cash-register-danger-button" type="button" onClick={onStartCloseConference}>
                            <i className="fa-solid fa-clipboard-check" />
                            Abrir conferencia de fechamento
                        </button>
                    </div>
                ) : (
                    <form className="cash-register-form" onSubmit={onClose}>
                        <label>
                            Valor contado
                            <input name="closing_amount" type="number" step="0.01" min="0" required />
                        </label>
                        <label>
                            Observacao
                            <textarea name="closing_notes" rows="3" />
                        </label>
                        <button className="cash-register-danger-button">
                            <i className="fa-solid fa-lock" />
                            Fechar caixa
                        </button>
                    </form>
                )}
            </section>
        </div>
    )
}

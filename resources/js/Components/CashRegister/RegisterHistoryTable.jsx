import { formatDateTime, formatMoney } from '@/lib/format'

export default function RegisterHistoryTable({ history, onViewReport }) {
    return (
        <section className="cash-register-card">
            <div className="cash-register-section-header">
                <div>
                    <span className="cash-register-section-kicker">Historico</span>
                    <h2>Historico de caixas</h2>
                    <p>Registros de abertura e fechamento.</p>
                </div>
                <span className="cash-register-count-chip">{history.length} registro(s)</span>
            </div>

            {history.length ? (
                <div className="cash-register-history-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Abertura</th>
                                <th>Fechamento</th>
                                <th>Operador</th>
                                <th>Valores</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((register) => (
                                <tr key={register.id}>
                                    <td>{formatDateTime(register.opened_at)}</td>
                                    <td>{formatDateTime(register.closed_at)}</td>
                                    <td>{register.user_name}</td>
                                    <td>
                                        {formatMoney(register.opening_amount)} / {formatMoney(register.closing_amount)}
                                    </td>
                                    <td>
                                        <button
                                            className="ui-tooltip"
                                            data-tooltip="Abrir conferencia detalhada"
                                            onClick={() => onViewReport(register.id)}
                                        >
                                            <i className="fa-solid fa-file-lines" />
                                            Ver relatorio
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="cash-register-empty">Nenhum caixa fechado ainda.</div>
            )}
        </section>
    )
}

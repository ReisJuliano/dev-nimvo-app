import { formatDateTime, formatMoney } from '@/lib/format'
import './closing-report-modal.css'

export default function ClosingReportModal({ report, onClose }) {
    if (!report) {
        return null
    }

    return (
        <div className="closing-report-modal-backdrop" onClick={onClose}>
            <div className="closing-report-modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="closing-report-modal-header">
                    <div>
                        <span className="closing-report-modal-kicker">
                            <i className="fa-solid fa-vault" />
                            Fechamento do caixa
                        </span>
                        <h2>Resumo do fechamento</h2>
                        <p>
                            Aberto em {formatDateTime(report.cashRegister.opened_at)} e fechado em{' '}
                            {formatDateTime(report.cashRegister.closed_at)}
                        </p>
                    </div>
                    <button className="ui-button-ghost" type="button" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Fechar
                    </button>
                </div>

                <div className="closing-report-modal-summary">
                    <article>
                        <small>Dinheiro informado</small>
                        <strong>{formatMoney(report.cashRegister.closing_amount)}</strong>
                    </article>
                    <article className={Math.abs(report.difference || 0) > 0.009 ? 'alert' : ''}>
                        <small>Diferenca em dinheiro</small>
                        <strong>{formatMoney(report.difference)}</strong>
                    </article>
                </div>

                <div className="closing-report-modal-section">
                    <div className="closing-report-modal-section-title">
                        <i className="fa-solid fa-scale-balanced" />
                        <h3>Conferencia final</h3>
                    </div>

                    <div className="closing-report-modal-grid">
                        {report.closing_breakdown?.length ? (
                            report.closing_breakdown.map((row) => (
                                <article key={row.payment_method} className="closing-report-modal-item">
                                    <div className="closing-report-modal-item-header">
                                        <strong>{row.label}</strong>
                                        <span>{row.recorded_at ? formatDateTime(row.recorded_at) : 'Sem data'}</span>
                                    </div>

                                    <div className="closing-report-modal-item-values">
                                        <div>
                                            <small>Esperado</small>
                                            <strong>{formatMoney(row.expected)}</strong>
                                        </div>
                                        <div>
                                            <small>Informado</small>
                                            <strong>{row.informed === null ? 'Nao informado' : formatMoney(row.informed)}</strong>
                                        </div>
                                        <div className={Math.abs(row.difference || 0) > 0.009 ? 'alert' : ''}>
                                            <small>Diferenca</small>
                                            <strong>{row.difference === null ? 'Nao conferido' : formatMoney(row.difference)}</strong>
                                        </div>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="closing-report-modal-empty">Nenhuma conferencia detalhada foi salva neste fechamento.</div>
                        )}
                    </div>
                </div>

                {report.cashRegister.closing_notes ? (
                    <div className="closing-report-modal-section">
                        <div className="closing-report-modal-section-title">
                            <i className="fa-solid fa-note-sticky" />
                            <h3>Observacao do fechamento</h3>
                        </div>

                        <div className="closing-report-modal-note">{report.cashRegister.closing_notes}</div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

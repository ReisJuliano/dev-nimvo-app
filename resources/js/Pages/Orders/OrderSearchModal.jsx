import { formatDateTime, formatMoney } from '@/lib/format'
import OrdersModal from './OrdersModal'
import { getOrderStatusMeta } from './orderUtils'

export default function OrderSearchModal({ term, setTerm, inputRef, results, onClose, onOpenDraft }) {
    return (
        <OrdersModal
            title="Pesquisar atendimento"
            subtitle="Localize rapidamente um atendimento ativo e abra o detalhe completo."
            size="lg"
            onClose={onClose}
        >
            <div className="orders-modal-stack">
                <label className="orders-form-field">
                    <span>Buscar por numero, cliente ou referencia</span>
                    <input
                        ref={inputRef}
                        className="ui-input"
                        type="search"
                        value={term}
                        placeholder="Ex.: Joao, referencia 12, atendimento 5"
                        onChange={(event) => setTerm(event.target.value)}
                    />
                </label>

                <div className="orders-search-results">
                    {results.length ? (
                        results.map((draft) => {
                            const statusMeta = getOrderStatusMeta(draft.status)

                            return (
                                <button key={draft.id} type="button" className="orders-search-result" onClick={() => onOpenDraft(draft)}>
                                    <div>
                                        <span>{draft.label}</span>
                                        <strong>{draft.customer?.name || 'Cliente nao identificado'}</strong>
                                        <small>{draft.updated_at ? formatDateTime(draft.updated_at) : 'Sem atualizacao'}</small>
                                    </div>
                                    <div className="orders-search-result-side">
                                        <span className={`ui-badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                                        <strong>{formatMoney(draft.total)}</strong>
                                    </div>
                                </button>
                            )
                        })
                    ) : (
                        <div className="orders-inline-empty wide">
                            <i className="fa-solid fa-magnifying-glass" />
                            <div>
                                <strong>Nenhum atendimento encontrado</strong>
                                <p>Tente outro termo ou volte para abrir uma nova.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </OrdersModal>
    )
}

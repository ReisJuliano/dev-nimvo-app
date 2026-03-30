import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'
import { formatElapsedTime, getDraftNumberLabel, getOrderTypeLabel } from './orderUtils'

export default function OrderDetailModal({
    draft,
    customers,
    feedback,
    selectedCustomer,
    selectedItem,
    selectedItemId,
    setSelectedItemId,
    pricing,
    currentDraftStatus,
    currentDraftSaveText,
    clock,
    printingDraft,
    sendingDraft,
    onClose,
    onOpenProductsModal,
    onOpenQuantityModal,
    onOpenTransferModal,
    onOpenDiscountModal,
    onOpenCheckoutModal,
    onPrintDraft,
    onSendToCashier,
    onQuantityChange,
    onRemoveItem,
    onCustomerChange,
}) {
    if (!draft) {
        return null
    }

    const sentToCashier = draft.status === 'sent_to_cashier'

    return (
        <OrdersModal
            title={draft.label}
            subtitle={currentDraftSaveText}
            size="xl"
            badge={<span className={`ui-badge ${currentDraftStatus?.badge || 'warning'}`}>{currentDraftStatus?.label || 'Em aberto'}</span>}
            onClose={onClose}
        >
            <div className="orders-detail">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type} orders-modal-inline-alert`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Nao foi possivel concluir a acao' : 'Atualizacao realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <section className="orders-detail-hero">
                    <div>
                        <span className="orders-page-kicker">Popup da comanda</span>
                        <div className="orders-detail-title-row">
                            <h3>{draft.label}</h3>
                            <span className="orders-detail-secondary">{selectedCustomer?.name || 'Cliente nao identificado'}</span>
                        </div>
                        <p>
                            {draft.reference ? `Referencia ${draft.reference}. ` : `Numero ${getDraftNumberLabel(draft)}. `}
                            Aberta ha {formatElapsedTime(draft.updatedAt, clock)}.
                        </p>
                    </div>

                    <div className="orders-detail-total-card">
                        <span>Total atual</span>
                        <strong>{formatMoney(pricing.total)}</strong>
                        <small>{draft.items.length} item(ns) em atendimento</small>
                    </div>
                </section>

                <section className="orders-detail-toolbar">
                    <button type="button" className="ui-button" onClick={onOpenProductsModal}>
                        <i className="fa-solid fa-box-open" />
                        Adicionar produto
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={onOpenQuantityModal} disabled={!selectedItem}>
                        <i className="fa-solid fa-arrows-up-down" />
                        Alterar quantidade
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={onOpenTransferModal}>
                        <i className="fa-solid fa-right-left" />
                        Transferir comanda
                    </button>
                    <button type="button" className="ui-button-secondary" onClick={onOpenDiscountModal} disabled={!draft.items.length}>
                        <i className="fa-solid fa-badge-percent" />
                        Aplicar desconto
                    </button>
                    <button type="button" className="ui-button" onClick={onOpenCheckoutModal} disabled={!draft.items.length}>
                        <i className="fa-solid fa-check" />
                        Finalizar pedido
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={onPrintDraft} disabled={printingDraft}>
                        <i className="fa-solid fa-print" />
                        {printingDraft ? 'Imprimindo...' : 'Imprimir'}
                    </button>
                    <button
                        type="button"
                        className="ui-button-ghost"
                        onClick={onSendToCashier}
                        disabled={sendingDraft || !draft.items.length || sentToCashier}
                    >
                        <i className="fa-solid fa-cash-register" />
                        {sendingDraft ? 'Enviando...' : sentToCashier ? 'Ja no caixa' : 'Enviar ao caixa'}
                    </button>
                </section>

                <div className="orders-detail-layout">
                    <div className="orders-detail-main">
                        <section className="orders-detail-panel">
                            <div className="orders-section-heading">
                                <div>
                                    <span className="orders-page-kicker">Dados da comanda</span>
                                    <h4>Resumo rapido</h4>
                                </div>
                                <button type="button" className="ui-button-ghost" onClick={onOpenTransferModal}>
                                    <i className="fa-solid fa-pen" />
                                    Editar dados
                                </button>
                            </div>

                            <div className="orders-detail-meta-grid">
                                <div className="orders-meta-card">
                                    <span>Tipo</span>
                                    <strong>{getOrderTypeLabel(draft.type)}</strong>
                                </div>
                                <div className="orders-meta-card">
                                    <span>Numero</span>
                                    <strong>{getDraftNumberLabel(draft)}</strong>
                                </div>
                                <div className="orders-meta-card">
                                    <span>Cliente</span>
                                    <strong>{selectedCustomer?.name || 'Nao identificado'}</strong>
                                </div>
                                <div className="orders-meta-card">
                                    <span>Status</span>
                                    <strong>{currentDraftStatus?.label || 'Em aberto'}</strong>
                                </div>
                            </div>

                            <div className="orders-note-box">
                                <span>Observacao</span>
                                <p>{draft.notes.trim() || 'Nenhuma observacao registrada para esta comanda.'}</p>
                            </div>
                        </section>

                        <section className="orders-detail-panel">
                            <div className="orders-section-heading">
                                <div>
                                    <span className="orders-page-kicker">Itens da comanda</span>
                                    <h4>Lista de produtos</h4>
                                </div>
                                <small>{selectedItem ? `Item em foco: ${selectedItem.name}` : 'Selecione um item para acoes rapidas.'}</small>
                            </div>

                            {pricing.items.length ? (
                                <div className="orders-item-list">
                                    {pricing.items.map((item) => (
                                        <article
                                            key={item.id}
                                            className={`orders-item-row ${selectedItemId === item.id ? 'active' : ''}`}
                                            onClick={() => setSelectedItemId(item.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setSelectedItemId(item.id)
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="orders-item-copy">
                                                <div className="orders-item-copy-top">
                                                    <strong>{item.name}</strong>
                                                    <span>{formatMoney(item.sale_price)}</span>
                                                </div>
                                                <div className="orders-item-meta">
                                                    {item.code ? <span>Cod. {item.code}</span> : null}
                                                    {item.barcode ? <span>EAN {item.barcode}</span> : null}
                                                    {item.unit ? <span>Un. {item.unit}</span> : null}
                                                    <span>Estoque {formatNumber(item.stock_quantity)}</span>
                                                </div>
                                            </div>

                                            <div className="orders-item-controls" onClick={(event) => event.stopPropagation()}>
                                                <label>
                                                    <span>Qtd</span>
                                                    <input
                                                        className="ui-input"
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        value={item.qty}
                                                        onChange={(event) => onQuantityChange(item.id, event.target.value)}
                                                    />
                                                </label>
                                                <div className="orders-item-total">
                                                    <span>Total</span>
                                                    <strong>{formatMoney(item.lineTotal)}</strong>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="orders-inline-danger"
                                                    onClick={() => {
                                                        setSelectedItemId(item.id)
                                                        onRemoveItem(item.id)
                                                    }}
                                                >
                                                    <i className="fa-solid fa-trash-can" />
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="orders-inline-empty">
                                    <i className="fa-solid fa-box-open" />
                                    <div>
                                        <strong>Sem produtos na comanda</strong>
                                        <p>Abra o popup de produtos para comecar a montar o pedido.</p>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    <aside className="orders-detail-side">
                        <section className="orders-detail-panel">
                            <div className="orders-section-heading">
                                <div>
                                    <span className="orders-page-kicker">Totais</span>
                                    <h4>Fechamento rapido</h4>
                                </div>
                            </div>

                            <div className="orders-summary-box">
                                <div>
                                    <span>Subtotal</span>
                                    <strong>{formatMoney(pricing.subtotal)}</strong>
                                </div>
                                <div>
                                    <span>Desconto</span>
                                    <strong>{formatMoney(pricing.discount)}</strong>
                                </div>
                                <div className="total">
                                    <span>Total</span>
                                    <strong>{formatMoney(pricing.total)}</strong>
                                </div>
                            </div>

                            <div className="orders-note-box compact">
                                <span>Desconto ativo</span>
                                <p>{pricing.summary.title}</p>
                                <small>{pricing.summary.description}</small>
                            </div>
                        </section>

                        <section className="orders-detail-panel">
                            <div className="orders-section-heading">
                                <div>
                                    <span className="orders-page-kicker">Cliente e foco</span>
                                    <h4>Contexto atual</h4>
                                </div>
                            </div>

                            <div className="orders-side-summary">
                                <div className="orders-side-chip">
                                    <span>Cliente</span>
                                    <strong>{selectedCustomer?.name || 'Nao identificado'}</strong>
                                    <small>{selectedCustomer?.phone || 'Sem telefone informado'}</small>
                                </div>

                                <label className="orders-side-chip orders-side-chip-form">
                                    <span>Vincular cliente</span>
                                    <select
                                        className="ui-select"
                                        value={draft.customerId}
                                        onChange={(event) => onCustomerChange(event.target.value)}
                                    >
                                        <option value="">Nao identificado</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                    <small>Voce pode informar ou trocar o cliente mesmo depois da comanda criada.</small>
                                </label>

                                <div className="orders-side-chip">
                                    <span>Item selecionado</span>
                                    <strong>{selectedItem?.name || 'Nenhum item em foco'}</strong>
                                    <small>
                                        {selectedItem
                                            ? `${formatNumber(selectedItem.qty)} x ${formatMoney(selectedItem.sale_price)}`
                                            : 'Clique em um item da lista para agir rapido.'}
                                    </small>
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </OrdersModal>
    )
}

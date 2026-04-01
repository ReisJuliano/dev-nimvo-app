import OrdersModal from './OrdersModal'
import { getOrderTypeLabel } from './orderUtils'

export default function OrderDraftFormModal({
    form,
    setForm,
    creatingDraft,
    customerSuggestions,
    customerInputRef,
    onCustomerInput,
    onPickCustomer,
    onClose,
    onSubmit,
    onSubmitAndAddProducts,
}) {
    return (
        <OrdersModal
            title="Novo atendimento"
            subtitle="Crie um atendimento e abra o fluxo principal ja em foco."
            size="lg"
            onClose={onClose}
        >
            <form className="orders-modal-stack" onSubmit={onSubmit}>
                <div className="orders-type-switch">
                    {['comanda', 'mesa', 'pedido'].map((type) => (
                        <button
                            key={type}
                            type="button"
                            className={`orders-type-option ${form.type === type ? 'active' : ''}`}
                            onClick={() => setForm((current) => ({ ...current, type }))}
                        >
                            <strong>{getOrderTypeLabel(type)}</strong>
                            <small>{type === 'mesa' ? 'Atendimento por referencia' : type === 'pedido' ? 'Entrega ou retirada' : 'Fluxo rapido'}</small>
                        </button>
                    ))}
                </div>

                <div className="orders-form-grid">
                    <label className="orders-form-field span-2">
                        <span>Nome do cliente</span>
                        <input
                            ref={customerInputRef}
                            className="ui-input"
                            value={form.customerName}
                            placeholder="Digite para localizar ou criar um cliente"
                            onChange={(event) => onCustomerInput(event.target.value)}
                        />
                    </label>

                    <label className="orders-form-field">
                        <span>Referencia</span>
                        <input
                            className="ui-input"
                            value={form.reference}
                            placeholder="Ex.: 12, varanda, retirada"
                            onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                        />
                    </label>

                    <label className="orders-form-field span-2">
                        <span>Observacao</span>
                        <textarea
                            className="ui-textarea"
                            rows="4"
                            value={form.notes}
                            placeholder="Recados para preparo, entrega ou cobranca"
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        />
                    </label>
                </div>

                {customerSuggestions.length ? (
                    <div className="orders-customer-suggestions">
                        {customerSuggestions.map((customer) => (
                            <button
                                key={customer.id}
                                type="button"
                                className={`orders-customer-suggestion ${String(customer.id) === form.customerId ? 'active' : ''}`}
                                onClick={() => onPickCustomer(customer)}
                            >
                                <strong>{customer.name}</strong>
                                <small>{customer.phone || 'Sem telefone informado'}</small>
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="orders-modal-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Cancelar
                    </button>
                    <button type="button" className="ui-button-secondary" onClick={onSubmitAndAddProducts} disabled={creatingDraft}>
                        <i className="fa-solid fa-box-open" />
                        Criar e adicionar produtos
                    </button>
                    <button type="submit" className="ui-button" disabled={creatingDraft}>
                        <i className="fa-solid fa-plus" />
                        {creatingDraft ? 'Criando...' : 'Criar atendimento'}
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}

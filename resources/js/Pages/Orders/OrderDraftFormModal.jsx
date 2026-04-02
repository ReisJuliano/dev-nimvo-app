import OrdersModal from './OrdersModal'
import { getOrderTypeLabel } from './orderUtils'

const TYPE_META = {
    comanda: {
        icon: 'fa-receipt',
        hint: 'Balcao',
        description: 'Consumo rapido',
    },
    mesa: {
        icon: 'fa-table-cells-large',
        hint: 'Mesa',
        description: 'Atendimento por ponto',
    },
    pedido: {
        icon: 'fa-bag-shopping',
        hint: 'Entrega',
        description: 'Retirada ou delivery',
    },
}

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
}) {
    const activeTypeMeta = TYPE_META[form.type] || TYPE_META.comanda
    const quickStats = [
        { icon: activeTypeMeta.icon, label: 'Tipo', value: getOrderTypeLabel(form.type) },
        { icon: 'fa-user', label: 'Cliente', value: form.customerName.trim() || 'Avulso' },
        { icon: 'fa-hashtag', label: 'Ref.', value: form.reference.trim() || 'Livre' },
        { icon: 'fa-circle-dot', label: 'Status', value: 'Aberta' },
    ]

    return (
        <OrdersModal
            title="Nova comanda"
            subtitle="Abrir atendimento."
            size="xl"
            className="orders-modal-draft-terminal"
            bodyClassName="orders-modal-draft-terminal-body"
            badge={
                <span className="orders-modal-badge orders-modal-badge-status">
                    <i className={`fa-solid ${activeTypeMeta.icon}`} />
                    <span>{getOrderTypeLabel(form.type)}</span>
                </span>
            }
            onClose={onClose}
        >
            <form className="orders-draft-terminal-form" onSubmit={onSubmit}>
                <div className="orders-draft-terminal-shell">
                    <div className="orders-draft-terminal-main">
                        <section className="orders-terminal-panel orders-draft-terminal-summary-panel">
                            <div className="orders-draft-terminal-stats">
                                {quickStats.map((card) => (
                                    <article key={card.label} className="orders-draft-terminal-stat-card">
                                        <div className="orders-draft-terminal-stat-icon">
                                            <i className={`fa-solid ${card.icon}`} />
                                        </div>
                                        <div className="orders-draft-terminal-stat-copy">
                                            <span>{card.label}</span>
                                            <strong>{card.value}</strong>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="orders-terminal-panel">
                            <div className="orders-terminal-panel-heading compact">
                                <div>
                                    <span className="orders-terminal-panel-kicker">
                                        <i className="fa-solid fa-sliders" />
                                        Tipo
                                    </span>
                                    <h4>Escolha</h4>
                                </div>
                                <span className="orders-terminal-inline-chip">
                                    <i className="fa-solid fa-bolt" />
                                    {activeTypeMeta.description}
                                </span>
                            </div>

                            <div className="orders-draft-terminal-type-grid">
                                {['comanda', 'mesa', 'pedido'].map((type) => {
                                    const meta = TYPE_META[type]

                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            className={`orders-draft-terminal-type-card ${form.type === type ? 'active' : ''}`}
                                            onClick={() => setForm((current) => ({ ...current, type }))}
                                            title={getOrderTypeLabel(type)}
                                        >
                                            <div className="orders-draft-terminal-type-icon">
                                                <i className={`fa-solid ${meta.icon}`} />
                                            </div>
                                            <strong>{getOrderTypeLabel(type)}</strong>
                                            <small>{meta.description}</small>
                                            <span>{meta.hint}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="orders-terminal-panel">
                            <div className="orders-terminal-panel-heading compact">
                                <div>
                                    <span className="orders-terminal-panel-kicker">
                                        <i className="fa-solid fa-pen-to-square" />
                                        Dados
                                    </span>
                                    <h4>Preencha</h4>
                                </div>
                                <span className="orders-terminal-inline-chip soft">
                                    <i className="fa-solid fa-pen" />
                                    Editavel depois
                                </span>
                            </div>

                            <div className="orders-draft-terminal-fields">
                                <label className="orders-draft-terminal-field span-2">
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        Cliente
                                    </span>
                                    <input
                                        ref={customerInputRef}
                                        className="ui-input"
                                        value={form.customerName}
                                        placeholder="Buscar cliente"
                                        onChange={(event) => onCustomerInput(event.target.value)}
                                    />
                                </label>

                                <label className="orders-draft-terminal-field">
                                    <span>
                                        <i className="fa-solid fa-hashtag" />
                                        Ref.
                                    </span>
                                    <input
                                        className="ui-input"
                                        value={form.reference}
                                        placeholder="Ex.: 12 ou varanda"
                                        onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                                    />
                                </label>

                                <div className="orders-draft-terminal-field orders-draft-terminal-field-readonly">
                                    <span>
                                        <i className="fa-solid fa-bolt" />
                                        Modo
                                    </span>
                                    <strong>{activeTypeMeta.description}</strong>
                                </div>

                                <label className="orders-draft-terminal-field span-2">
                                    <span>
                                        <i className="fa-solid fa-note-sticky" />
                                        Obs.
                                    </span>
                                    <textarea
                                        className="ui-textarea"
                                        rows="3"
                                        value={form.notes}
                                        placeholder="Recado interno"
                                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                    />
                                </label>
                            </div>
                        </section>

                        {customerSuggestions.length ? (
                            <section className="orders-terminal-panel">
                                <div className="orders-terminal-panel-heading compact">
                                    <div>
                                        <span className="orders-terminal-panel-kicker">
                                            <i className="fa-solid fa-address-book" />
                                            Clientes
                                        </span>
                                        <h4>Sugestoes</h4>
                                    </div>
                                    <span className="orders-terminal-inline-chip">
                                        <i className="fa-solid fa-users" />
                                        {customerSuggestions.length}
                                    </span>
                                </div>

                                <div className="orders-draft-terminal-suggestions">
                                    {customerSuggestions.map((customer) => (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            className={`orders-draft-terminal-suggestion ${String(customer.id) === form.customerId ? 'active' : ''}`}
                                            onClick={() => onPickCustomer(customer)}
                                        >
                                            <div className="orders-draft-terminal-suggestion-main">
                                                <div className="orders-draft-terminal-suggestion-icon">
                                                    <i className="fa-solid fa-user" />
                                                </div>
                                                <div>
                                                    <strong>{customer.name}</strong>
                                                    <small>{customer.phone || 'Sem telefone informado'}</small>
                                                </div>
                                            </div>
                                            <span>
                                                <i className="fa-solid fa-check" />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>

                    <aside className="orders-terminal-sidebar orders-draft-terminal-sidebar">
                        <button type="button" className="orders-terminal-sidebar-action" onClick={onClose}>
                            <i className="fa-solid fa-xmark" />
                            <span>Fechar</span>
                        </button>

                        <button type="submit" className="orders-terminal-sidebar-action" disabled={creatingDraft}>
                            <i className="fa-solid fa-box-open" />
                            <span>{creatingDraft ? 'Criando' : 'Criar'}</span>
                        </button>
                    </aside>
                </div>
            </form>
        </OrdersModal>
    )
}

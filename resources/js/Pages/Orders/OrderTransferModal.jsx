import OrdersModal from './OrdersModal'
import { getOrderTypeLabel } from './orderUtils'

const TYPE_OPTIONS = [
    { value: 'comanda', icon: 'fa-receipt', hint: 'Fluxo rapido' },
    { value: 'mesa', icon: 'fa-table-cells-large', hint: 'Por referencia' },
    { value: 'pedido', icon: 'fa-bag-shopping', hint: 'Entrega ou retirada' },
]

export default function OrderTransferModal({ form, setForm, customers, onClose, onSubmit }) {
    const selectedCustomer = customers.find((customer) => String(customer.id) === String(form.customerId))
    const metaCards = [
        { icon: 'fa-layer-group', label: 'Tipo', value: getOrderTypeLabel(form.type) },
        { icon: 'fa-hashtag', label: 'Referencia', value: form.reference.trim() || 'Livre' },
        { icon: 'fa-user', label: 'Cliente', value: selectedCustomer?.name || 'Nao identificado' },
    ]

    return (
        <OrdersModal
            title="Editar pedido"
            subtitle="Ajuste tipo, referencia, cliente e observacoes no mesmo padrao visual do PDV."
            size="xl"
            className="orders-modal-edit-terminal"
            bodyClassName="orders-modal-edit-terminal-body"
            badge={<span className="orders-modal-badge orders-modal-badge-status">{getOrderTypeLabel(form.type)}</span>}
            onClose={onClose}
        >
            <form className="orders-edit-terminal-form" onSubmit={onSubmit}>
                <div className="orders-edit-terminal-shell">
                    <div className="orders-edit-terminal-main">
                        <section className="orders-terminal-hero orders-edit-terminal-hero">
                            <div className="orders-terminal-hero-copy">
                                <div className="orders-terminal-hero-kicker">
                                    <i className="fa-solid fa-pen-to-square" />
                                    <span>Edicao ativa</span>
                                </div>

                                <div className="orders-terminal-title-row">
                                    <h3>{getOrderTypeLabel(form.type)}</h3>
                                    <span className="orders-terminal-inline-chip">
                                        <i className="fa-solid fa-rotate" />
                                        Ajuste rapido
                                    </span>
                                </div>

                                <p>Atualize os dados principais sem sair do fluxo das comandas.</p>

                                <div className="orders-terminal-hero-meta">
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        {selectedCustomer?.name || 'Cliente nao identificado'}
                                    </span>
                                    <span>
                                        <i className="fa-solid fa-note-sticky" />
                                        {form.notes.trim() ? 'Com observacao' : 'Sem observacao'}
                                    </span>
                                </div>
                            </div>

                            <div className="orders-terminal-total-card">
                                <span>Referencia atual</span>
                                <strong>{form.reference.trim() || 'Livre'}</strong>
                                <small>Use uma referencia curta para facilitar a busca do pedido.</small>
                            </div>
                        </section>

                        <section className="orders-terminal-metrics orders-edit-terminal-stats">
                            {metaCards.map((card) => (
                                <article key={card.label} className="orders-terminal-stat-card">
                                    <span>
                                        <i className={`fa-solid ${card.icon}`} />
                                        {card.label}
                                    </span>
                                    <strong>{card.value}</strong>
                                </article>
                            ))}
                        </section>

                        <section className="orders-terminal-panel">
                            <div className="orders-terminal-panel-heading">
                                <div>
                                    <span className="orders-terminal-panel-kicker">
                                        <i className="fa-solid fa-sliders" />
                                        Tipo do pedido
                                    </span>
                                    <h4>Escolha o contexto</h4>
                                </div>
                                <small>O fluxo continua o mesmo, mudando apenas a classificacao operacional.</small>
                            </div>

                            <div className="orders-edit-terminal-type-grid">
                                {TYPE_OPTIONS.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        className={`orders-edit-terminal-type-card ${form.type === type.value ? 'active' : ''}`}
                                        onClick={() => setForm((current) => ({ ...current, type: type.value }))}
                                    >
                                        <span>
                                            <i className={`fa-solid ${type.icon}`} />
                                            {type.hint}
                                        </span>
                                        <strong>{getOrderTypeLabel(type.value)}</strong>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="orders-terminal-panel">
                            <div className="orders-terminal-panel-heading">
                                <div>
                                    <span className="orders-terminal-panel-kicker">
                                        <i className="fa-solid fa-clipboard-list" />
                                        Dados editaveis
                                    </span>
                                    <h4>Campos do pedido</h4>
                                </div>
                                <small>Tudo aqui pode ser salvo sem sair do detalhe principal.</small>
                            </div>

                            <div className="orders-edit-terminal-fields">
                                <label className="orders-edit-terminal-field">
                                    <span>
                                        <i className="fa-solid fa-hashtag" />
                                        Numero / referencia
                                    </span>
                                    <input
                                        className="ui-input"
                                        value={form.reference}
                                        placeholder="Ex.: 15, varanda, retirada"
                                        onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                                    />
                                </label>

                                <label className="orders-edit-terminal-field">
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        Cliente
                                    </span>
                                    <select
                                        className="ui-select"
                                        value={form.customerId}
                                        onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                                    >
                                        <option value="">Nao identificado</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="orders-edit-terminal-field span-2">
                                    <span>
                                        <i className="fa-solid fa-note-sticky" />
                                        Observacao
                                    </span>
                                    <textarea
                                        className="ui-textarea"
                                        rows="5"
                                        value={form.notes}
                                        placeholder="Atualize as observacoes se precisar"
                                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                    />
                                </label>
                            </div>
                        </section>
                    </div>

                    <aside className="orders-terminal-sidebar orders-edit-terminal-sidebar">
                        <button
                            type="button"
                            className="orders-edit-terminal-sidebar-icon"
                            onClick={onClose}
                            aria-label="Cancelar edicao"
                            title="Cancelar"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>

                        <button
                            type="submit"
                            className="orders-edit-terminal-sidebar-icon confirm"
                            aria-label="Salvar alteracoes"
                            title="Salvar"
                        >
                            <i className="fa-solid fa-check" />
                        </button>
                    </aside>
                </div>
            </form>
        </OrdersModal>
    )
}

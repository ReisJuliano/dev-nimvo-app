import OrdersModal from './OrdersModal'
import { getOrderTypeLabel } from './orderUtils'

const TYPE_META = {
    comanda: {
        icon: 'fa-receipt',
        hint: 'Fluxo rapido',
        description: 'Atendimento tradicional para consumo e fechamento direto no caixa.',
    },
    mesa: {
        icon: 'fa-table-cells-large',
        hint: 'Por referencia',
        description: 'Organiza itens por mesa, ambiente ou outro ponto de atendimento.',
    },
    pedido: {
        icon: 'fa-bag-shopping',
        hint: 'Entrega ou retirada',
        description: 'Separado para retirada no balcao, entrega ou pedido externo.',
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
    onSubmitAndAddProducts,
}) {
    const activeTypeMeta = TYPE_META[form.type] || TYPE_META.comanda
    const quickStats = [
        { icon: 'fa-layer-group', label: 'Tipo', value: getOrderTypeLabel(form.type) },
        { icon: 'fa-user', label: 'Cliente', value: form.customerName.trim() || 'Nao identificado' },
        { icon: 'fa-hashtag', label: 'Referencia', value: form.reference.trim() || 'Livre' },
    ]

    return (
        <OrdersModal
            title="Nova comanda"
            subtitle="Abra um novo atendimento no mesmo padrao visual do PDV."
            size="xl"
            className="orders-modal-draft-terminal"
            bodyClassName="orders-modal-draft-terminal-body"
            badge={<span className="orders-modal-badge orders-modal-badge-status">{getOrderTypeLabel(form.type)}</span>}
            onClose={onClose}
        >
            <form className="orders-draft-terminal-form" onSubmit={onSubmit}>
                <div className="orders-draft-terminal-shell">
                    <div className="orders-draft-terminal-main">
                        <section className="orders-terminal-hero">
                            <div className="orders-terminal-hero-copy">
                                <div className="orders-terminal-hero-kicker">
                                    <i className={`fa-solid ${activeTypeMeta.icon}`} />
                                    <span>Novo atendimento</span>
                                </div>

                                <div className="orders-terminal-title-row">
                                    <h3>{getOrderTypeLabel(form.type)}</h3>
                                    <span className="orders-terminal-inline-chip">
                                        <i className="fa-solid fa-bolt" />
                                        {activeTypeMeta.hint}
                                    </span>
                                </div>

                                <p>{activeTypeMeta.description}</p>

                                <div className="orders-terminal-hero-meta">
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        {form.customerName.trim() || 'Cliente opcional'}
                                    </span>
                                    <span>
                                        <i className="fa-solid fa-note-sticky" />
                                        {form.notes.trim() ? 'Com observacao' : 'Sem observacao'}
                                    </span>
                                </div>
                            </div>

                            <div className="orders-terminal-total-card">
                                <span>Status inicial</span>
                                <strong>Em aberto</strong>
                                <small>Depois de criar, a comanda ja fica pronta para receber itens.</small>
                            </div>
                        </section>

                        <section className="orders-terminal-metrics orders-draft-terminal-stats">
                            {quickStats.map((card) => (
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
                                        Tipo de atendimento
                                    </span>
                                    <h4>Escolha o fluxo da comanda</h4>
                                </div>
                                <small>Todos seguem a mesma operacao, mudando apenas o contexto do atendimento.</small>
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
                                        >
                                            <span>
                                                <i className={`fa-solid ${meta.icon}`} />
                                                {meta.hint}
                                            </span>
                                            <strong>{getOrderTypeLabel(type)}</strong>
                                            <small>{meta.description}</small>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="orders-terminal-panel">
                            <div className="orders-terminal-panel-heading">
                                <div>
                                    <span className="orders-terminal-panel-kicker">
                                        <i className="fa-solid fa-pen-to-square" />
                                        Dados da comanda
                                    </span>
                                    <h4>Preencha os campos principais</h4>
                                </div>
                                <small>Cliente, referencia e observacao podem ser ajustados depois.</small>
                            </div>

                            <div className="orders-draft-terminal-fields">
                                <label className="orders-draft-terminal-field span-2">
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        Nome do cliente
                                    </span>
                                    <input
                                        ref={customerInputRef}
                                        className="ui-input"
                                        value={form.customerName}
                                        placeholder="Digite para localizar ou criar um cliente"
                                        onChange={(event) => onCustomerInput(event.target.value)}
                                    />
                                </label>

                                <label className="orders-draft-terminal-field">
                                    <span>
                                        <i className="fa-solid fa-hashtag" />
                                        Referencia
                                    </span>
                                    <input
                                        className="ui-input"
                                        value={form.reference}
                                        placeholder="Ex.: 12, varanda, retirada"
                                        onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                                    />
                                </label>

                                <div className="orders-draft-terminal-field orders-draft-terminal-field-hint">
                                    <span>
                                        <i className="fa-solid fa-circle-info" />
                                        Dica
                                    </span>
                                    <p>Use uma referencia curta para facilitar a busca e o envio ao caixa.</p>
                                </div>

                                <label className="orders-draft-terminal-field span-2">
                                    <span>
                                        <i className="fa-solid fa-note-sticky" />
                                        Observacao
                                    </span>
                                    <textarea
                                        className="ui-textarea"
                                        rows="4"
                                        value={form.notes}
                                        placeholder="Recados para preparo, entrega ou cobranca"
                                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                    />
                                </label>
                            </div>
                        </section>

                        {customerSuggestions.length ? (
                            <section className="orders-terminal-panel">
                                <div className="orders-terminal-panel-heading">
                                    <div>
                                        <span className="orders-terminal-panel-kicker">
                                            <i className="fa-solid fa-address-book" />
                                            Clientes sugeridos
                                        </span>
                                        <h4>Selecione um cadastro existente</h4>
                                    </div>
                                    <small>{customerSuggestions.length} opcao(oes) encontradas.</small>
                                </div>

                                <div className="orders-draft-terminal-suggestions">
                                    {customerSuggestions.map((customer) => (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            className={`orders-draft-terminal-suggestion ${String(customer.id) === form.customerId ? 'active' : ''}`}
                                            onClick={() => onPickCustomer(customer)}
                                        >
                                            <div>
                                                <strong>{customer.name}</strong>
                                                <small>{customer.phone || 'Sem telefone informado'}</small>
                                            </div>
                                            <span>
                                                <i className="fa-solid fa-check" />
                                                Usar
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
                            <span>Cancelar</span>
                        </button>

                        <button type="button" className="orders-terminal-sidebar-action" onClick={onSubmitAndAddProducts} disabled={creatingDraft}>
                            <i className="fa-solid fa-box-open" />
                            <span>Salvar + Produtos</span>
                        </button>

                        <button type="submit" className="orders-terminal-sidebar-finalize" disabled={creatingDraft}>
                            <i className="fa-solid fa-plus" />
                            <span>{creatingDraft ? 'Criando' : 'Criar comanda'}</span>
                        </button>
                    </aside>
                </div>
            </form>
        </OrdersModal>
    )
}

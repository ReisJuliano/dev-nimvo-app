import ActionButton from '@/Components/UI/ActionButton'
import { formatMoney, formatNumber } from '@/lib/format'

function CustomerHint({ customer }) {
    if (!customer) {
        return null
    }

    return (
        <div className="conditional-customer-tiles">
            <div>
                <span>Limite</span>
                <strong>{formatMoney(customer.credit_limit)}</strong>
            </div>
            <div>
                <span>Livre</span>
                <strong>{formatMoney(customer.available_limit)}</strong>
            </div>
            <div>
                <span>Doc</span>
                <strong>{customer.document || '-'}</strong>
            </div>
            <div>
                <span>Atrasos</span>
                <strong>{customer.overdue_count || 0}</strong>
            </div>
        </div>
    )
}

function ErrorLine({ message }) {
    if (!message) {
        return null
    }

    return <span className="conditional-error">{message}</span>
}

function ItemRow({ item, index, products, onChange, onRemove, disableRemove }) {
    const product = products.find((entry) => String(entry.id) === String(item.product_id))

    return (
        <div className="conditional-item-card">
            <div className="products-form-section" style={{ marginBottom: '0.5rem' }}>
                <h3>Produto {index + 1}</h3>
                <div className="conditional-inline-actions">
                    <span className="ui-badge warning">Est. {formatNumber(product?.stock_quantity || 0)}</span>
                    <span className="ui-badge success">Cond. {formatNumber(product?.conditional_quantity || 0)}</span>
                    <button
                        type="button"
                        className="ui-button-danger"
                        disabled={disableRemove}
                        onClick={onRemove}
                        aria-label="Remover item"
                    >
                        <i className="fa-solid fa-trash" /> Remover
                    </button>
                </div>
            </div>

            <label className="products-sidebar-field">
                <span>SKU</span>
                <select
                    className="products-input"
                    value={item.product_id}
                    onChange={(event) => onChange(index, 'product_id', event.target.value)}
                >
                    <option value="">Selecione</option>
                    {products.map((productOption) => (
                        <option key={productOption.id} value={productOption.id}>
                            {productOption.code} · {productOption.name}
                        </option>
                    ))}
                </select>
            </label>

            <div className="conditional-form-grid cols-2" style={{ marginTop: '0.75rem' }}>
                <label className="products-sidebar-field">
                    <span>Qtd</span>
                    <input
                        className="products-input"
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => onChange(index, 'quantity', event.target.value)}
                    />
                </label>
                <label className="products-sidebar-field">
                    <span>Valor</span>
                    <input
                        className="products-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => onChange(index, 'unit_price', event.target.value)}
                    />
                </label>
            </div>
        </div>
    )
}

export default function CreateConditionalSaleCard({
    form,
    customers,
    products,
    selectedCustomer,
    totalPreview,
    onSubmit,
    onAddItem,
    onRemoveItem,
    onItemChange,
    embedded = false,
}) {
    const formBody = (
        <form className="conditional-form-grid" onSubmit={onSubmit}>
                    <label className="products-sidebar-field">
                        <span>Cliente</span>
                        <select
                            className="products-input"
                            value={form.data.customer_id}
                            onChange={(event) => form.setData('customer_id', event.target.value)}
                        >
                            <option value="">Selecione</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                </option>
                            ))}
                        </select>
                        <ErrorLine message={form.errors.customer_id} />
                    </label>

                    <CustomerHint customer={selectedCustomer} />

                    <div className="conditional-form-grid cols-2">
                        <label className="products-sidebar-field">
                            <span>Retirada</span>
                            <input
                                className="products-input"
                                type="datetime-local"
                                value={form.data.withdrawn_at}
                                onChange={(event) => form.setData('withdrawn_at', event.target.value)}
                            />
                            <ErrorLine message={form.errors.withdrawn_at} />
                        </label>
                        <label className="products-sidebar-field">
                            <span>Prazo</span>
                            <input
                                className="products-input"
                                type="date"
                                value={form.data.due_at}
                                onChange={(event) => form.setData('due_at', event.target.value)}
                            />
                            <ErrorLine message={form.errors.due_at} />
                        </label>
                    </div>

                    <label className="products-sidebar-field">
                        <span>Observacoes</span>
                        <textarea
                            className="products-input"
                            rows={3}
                            value={form.data.notes}
                            onChange={(event) => form.setData('notes', event.target.value)}
                        />
                        <ErrorLine message={form.errors.notes} />
                    </label>

                    <div className="products-form-section">
                        <h3>Itens</h3>
                        <button type="button" className="ui-button-ghost" onClick={onAddItem}>
                            <i className="fa-solid fa-plus" /> Item
                        </button>
                    </div>

                    <div className="conditional-form-grid">
                        {form.data.items.map((item, index) => (
                            <ItemRow
                                key={`create-item-${index}`}
                                disableRemove={form.data.items.length === 1}
                                index={index}
                                item={item}
                                products={products}
                                onChange={onItemChange}
                                onRemove={() => onRemoveItem(index)}
                            />
                        ))}
                    </div>
                    <ErrorLine message={form.errors.items} />

                    <ActionButton icon="fa-shirt" type="submit" disabled={form.processing}>
                        {form.processing ? 'Salvando...' : 'Criar condicional'}
                    </ActionButton>
                </form>
    )

    if (embedded) {
        return (
            <div className="conditional-create-embedded">
                <div className="conditional-create-meta">
                    <span className="ui-badge warning">Resumo</span>
                    <span className="conditional-create-total">Total previsto <strong>{formatMoney(totalPreview)}</strong></span>
                </div>
                {formBody}
            </div>
        )
    }

    return (
        <section className="products-table-card">
            <div className="products-table-header">
                <div>
                    <h2>Nova retirada</h2>
                    <p>Total previsto {formatMoney(totalPreview)}</p>
                </div>
                <span className="ui-badge warning">Abertura</span>
            </div>

            <div className="products-table-scroll" style={{ padding: '1rem' }}>
                {formBody}
            </div>
        </section>
    )
}

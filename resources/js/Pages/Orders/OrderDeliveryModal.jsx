import { useState } from 'react'
import OrdersModal from './OrdersModal'

export default function OrderDeliveryModal({ draft, selectedCustomer, submitting, onClose, onSubmit }) {
    const [form, setForm] = useState({
        channel: 'delivery',
        reference: draft?.reference || '',
        recipient_name: selectedCustomer?.name || '',
        phone: selectedCustomer?.phone || '',
        address: '',
        neighborhood: '',
        delivery_fee: '0',
        notes: '',
    })

    if (!draft) {
        return null
    }

    return (
        <OrdersModal
            title="Entrega"
            size="lg"
            className="orders-modal-action-compact"
            bodyClassName="orders-modal-action-compact-body"
            onClose={onClose}
        >
            <form
                className="orders-action-compact-form"
                onSubmit={(event) => {
                    event.preventDefault()
                    onSubmit(form)
                }}
            >
                <div className="orders-action-toggle-grid cols-2">
                    <button
                        type="button"
                        className={`orders-action-toggle ${form.channel === 'delivery' ? 'active' : ''}`}
                        onClick={() => setForm((current) => ({ ...current, channel: 'delivery' }))}
                        aria-label="Delivery"
                        title="Delivery"
                    >
                        <i className="fa-solid fa-motorcycle" />
                        <span>Delivery</span>
                    </button>
                    <button
                        type="button"
                        className={`orders-action-toggle ${form.channel === 'retirada' ? 'active' : ''}`}
                        onClick={() => setForm((current) => ({ ...current, channel: 'retirada', address: '', neighborhood: '', delivery_fee: '0' }))}
                        aria-label="Retirada"
                        title="Retirada"
                    >
                        <i className="fa-solid fa-bag-shopping" />
                        <span>Retirada</span>
                    </button>
                </div>

                <div className="orders-action-field-grid">
                    <label className="orders-action-field">
                        <i className="fa-solid fa-hashtag" />
                        <input
                            className="ui-input"
                            value={form.reference}
                            placeholder="Referencia"
                            onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                            aria-label="Referencia"
                        />
                    </label>
                    <label className="orders-action-field">
                        <i className="fa-solid fa-user" />
                        <input
                            className="ui-input"
                            value={form.recipient_name}
                            placeholder="Cliente"
                            onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))}
                            aria-label="Cliente"
                        />
                    </label>
                    <label className="orders-action-field">
                        <i className="fa-solid fa-phone" />
                        <input
                            className="ui-input"
                            value={form.phone}
                            placeholder="Telefone"
                            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                            aria-label="Telefone"
                        />
                    </label>

                    {form.channel === 'delivery' ? (
                        <>
                            <label className="orders-action-field wide">
                                <i className="fa-solid fa-location-dot" />
                                <input
                                    className="ui-input"
                                    value={form.address}
                                    placeholder="Endereco"
                                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                                    required
                                    aria-label="Endereco"
                                />
                            </label>

                            <label className="orders-action-field">
                                <i className="fa-solid fa-map" />
                                <input
                                    className="ui-input"
                                    value={form.neighborhood}
                                    placeholder="Bairro"
                                    onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))}
                                    aria-label="Bairro"
                                />
                            </label>

                            <label className="orders-action-field">
                                <i className="fa-solid fa-money-bill-wave" />
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.delivery_fee}
                                    placeholder="Taxa"
                                    onChange={(event) => setForm((current) => ({ ...current, delivery_fee: event.target.value }))}
                                    aria-label="Taxa de entrega"
                                />
                            </label>
                        </>
                    ) : null}
                </div>

                <div className="orders-action-buttons">
                    <button type="button" className="orders-action-button muted" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        <span>Voltar</span>
                    </button>
                    <button type="submit" className="orders-action-button primary" disabled={submitting}>
                        <i className={`fa-solid ${form.channel === 'delivery' ? 'fa-motorcycle' : 'fa-bag-shopping'}`} />
                        <span>{submitting ? 'Salvando' : 'Criar'}</span>
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}


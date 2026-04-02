import { useState } from 'react'
import { formatMoney } from '@/lib/format'
import OrdersModal from './OrdersModal'

export default function OrderDeliveryModal({ draft, selectedCustomer, submitting, onClose, onSubmit }) {
    const [form, setForm] = useState({
        channel: 'delivery',
        reference: draft?.reference || '',
        recipient_name: selectedCustomer?.name || '',
        phone: selectedCustomer?.phone || '',
        courier_name: '',
        address: '',
        neighborhood: '',
        delivery_fee: '0',
        notes: '',
    })

    if (!draft) {
        return null
    }

    const isPickup = form.channel === 'retirada'
    const draftLabel = form.reference || draft.reference || `Pedido #${draft.id}`
    const customerLabel = form.recipient_name || selectedCustomer?.name || 'Cliente nao identificado'
    const itemCount = Array.isArray(draft.items) ? draft.items.length : 0
    const deliveryFee = isPickup ? 0 : Number(form.delivery_fee || 0)
    const projectedTotal = Number(draft.total || 0) + deliveryFee
    const channelMeta = isPickup
        ? {
              icon: 'fa-bag-shopping',
              label: 'Retirada',
              description: 'Separe o pedido para retirada no balcao com identificacao clara do cliente.',
              kicker: 'Fluxo de retirada',
          }
        : {
              icon: 'fa-motorcycle',
              label: 'Delivery',
              description: 'Confirme destino, taxa e contato antes de enviar o pedido para a fila externa.',
              kicker: 'Fluxo de entrega',
          }

    return (
        <OrdersModal
            title={channelMeta.label}
            subtitle={channelMeta.description}
            size="lg"
            className="orders-modal-action-compact orders-modal-delivery-compact"
            bodyClassName="orders-modal-action-compact-body orders-modal-delivery-compact-body"
            badge={
                <span className="orders-modal-badge orders-modal-delivery-badge">
                    <i className={`fa-solid ${channelMeta.icon}`} />
                    <span>{draftLabel}</span>
                </span>
            }
            onClose={onClose}
        >
            <form
                className="orders-action-compact-form"
                onSubmit={(event) => {
                    event.preventDefault()
                    onSubmit({
                        ...form,
                        courier_name: isPickup ? '' : form.courier_name,
                        address: isPickup ? 'Retirada no balcao' : form.address,
                        neighborhood: isPickup ? '' : form.neighborhood,
                        delivery_fee: isPickup ? '0' : form.delivery_fee,
                    })
                }}
            >
                <div className="orders-delivery-hero">
                    <div className="orders-delivery-hero-copy">
                        <span className="orders-delivery-hero-kicker">
                            <i className={`fa-solid ${channelMeta.icon}`} />
                            {channelMeta.kicker}
                        </span>
                        <strong>{draftLabel}</strong>
                        <p>{channelMeta.description}</p>
                    </div>

                    <div className="orders-delivery-hero-metrics">
                        <article>
                            <span>Cliente</span>
                            <strong>{customerLabel}</strong>
                        </article>
                        <article>
                            <span>Itens</span>
                            <strong>{itemCount}</strong>
                        </article>
                        <article>
                            <span>Total previsto</span>
                            <strong>{formatMoney(projectedTotal)}</strong>
                        </article>
                    </div>
                </div>

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
                        <small>Enviar com endereco, taxa e contato definidos.</small>
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
                        <small>Registrar como retirada no balcao sem taxa de entrega.</small>
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
                            <label className="orders-action-field">
                                <i className="fa-solid fa-id-badge" />
                                <input
                                    className="ui-input"
                                    value={form.courier_name}
                                    placeholder="Entregador"
                                    onChange={(event) => setForm((current) => ({ ...current, courier_name: event.target.value }))}
                                    aria-label="Entregador"
                                />
                            </label>
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
                    ) : (
                        <div className="orders-delivery-inline-note wide">
                            <i className="fa-solid fa-store" />
                            <div>
                                <strong>Retirada no balcao</strong>
                                <p>O sistema vai registrar um endereco interno padrao para manter o fluxo consistente.</p>
                            </div>
                        </div>
                    )}

                    <label className="orders-action-field wide textarea">
                        <i className="fa-solid fa-file-lines" />
                        <textarea
                            className="ui-textarea"
                            value={form.notes}
                            placeholder="Observacoes para entrega, retirada ou conferencia"
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                            aria-label="Observacoes"
                            rows={3}
                        />
                    </label>
                </div>

                <div className="orders-action-buttons">
                    <button type="button" className="orders-action-button muted" onClick={onClose}>
                        <i className="fa-solid fa-arrow-left" />
                        <span>Voltar</span>
                    </button>
                    <button type="submit" className="orders-action-button primary" disabled={submitting}>
                        <i className={`fa-solid ${form.channel === 'delivery' ? 'fa-motorcycle' : 'fa-bag-shopping'}`} />
                        <span>{submitting ? 'Salvando' : form.channel === 'delivery' ? 'Criar entrega' : 'Registrar retirada'}</span>
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}


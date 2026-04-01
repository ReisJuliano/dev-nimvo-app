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
        courier_name: '',
        notes: '',
    })

    if (!draft) {
        return null
    }

    return (
        <OrdersModal
            title="Enviar para entrega"
            subtitle="Crie um acompanhamento de entrega a partir deste atendimento."
            size="lg"
            onClose={onClose}
        >
            <form
                className="orders-modal-stack"
                onSubmit={(event) => {
                    event.preventDefault()
                    onSubmit(form)
                }}
            >
                <div className="orders-form-grid">
                    <label className="orders-form-field">
                        <span>Canal</span>
                        <select
                            className="ui-select"
                            value={form.channel}
                            onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}
                        >
                            <option value="delivery">Delivery</option>
                            <option value="retirada">Retirada</option>
                        </select>
                    </label>
                    <label className="orders-form-field">
                        <span>Referencia</span>
                        <input
                            className="ui-input"
                            value={form.reference}
                            onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                            placeholder="Ex.: Referencia 10 / Atendimento 123"
                        />
                    </label>
                    <label className="orders-form-field">
                        <span>Destinatario</span>
                        <input
                            className="ui-input"
                            value={form.recipient_name}
                            onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))}
                        />
                    </label>
                    <label className="orders-form-field">
                        <span>Telefone</span>
                        <input
                            className="ui-input"
                            value={form.phone}
                            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        />
                    </label>
                    <label className="orders-form-field span-2">
                        <span>Endereco</span>
                        <input
                            className="ui-input"
                            value={form.address}
                            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                            required
                        />
                    </label>
                    <label className="orders-form-field">
                        <span>Bairro</span>
                        <input
                            className="ui-input"
                            value={form.neighborhood}
                            onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))}
                        />
                    </label>
                    <label className="orders-form-field">
                        <span>Taxa</span>
                        <input
                            className="ui-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.delivery_fee}
                            onChange={(event) => setForm((current) => ({ ...current, delivery_fee: event.target.value }))}
                        />
                    </label>
                    <label className="orders-form-field span-2">
                        <span>Observacoes</span>
                        <textarea
                            className="ui-textarea"
                            rows="3"
                            value={form.notes}
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        />
                    </label>
                </div>

                <div className="orders-modal-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Cancelar
                    </button>
                    <button type="submit" className="ui-button" disabled={submitting}>
                        <i className="fa-solid fa-motorcycle" />
                        {submitting ? 'Enviando...' : 'Criar entrega'}
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}


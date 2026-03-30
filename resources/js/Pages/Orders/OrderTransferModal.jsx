import OrdersModal from './OrdersModal'

export default function OrderTransferModal({ form, setForm, customers, onClose, onSubmit }) {
    return (
        <OrdersModal
            title="Transferir Comanda"
            subtitle="Reposicione a comanda para outra mesa, referencia ou cliente sem sair do popup."
            size="lg"
            onClose={onClose}
        >
            <form className="orders-modal-stack" onSubmit={onSubmit}>
                <div className="orders-form-grid">
                    <label className="orders-form-field">
                        <span>Tipo</span>
                        <select
                            className="ui-select"
                            value={form.type}
                            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                        >
                            <option value="comanda">Comanda</option>
                            <option value="mesa">Mesa</option>
                            <option value="pedido">Pedido</option>
                        </select>
                    </label>

                    <label className="orders-form-field">
                        <span>Numero / referencia</span>
                        <input
                            className="ui-input"
                            value={form.reference}
                            placeholder="Ex.: 15, varanda, retirada"
                            onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                        />
                    </label>

                    <label className="orders-form-field span-2">
                        <span>Cliente</span>
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

                    <label className="orders-form-field span-2">
                        <span>Observacao</span>
                        <textarea
                            className="ui-textarea"
                            rows="4"
                            value={form.notes}
                            placeholder="Atualize os recados da comanda se precisar"
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        />
                    </label>
                </div>

                <div className="orders-modal-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Cancelar
                    </button>
                    <button type="submit" className="ui-button">
                        <i className="fa-solid fa-right-left" />
                        Salvar transferencia
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}

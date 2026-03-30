import OrdersModal from './OrdersModal'

export default function OrderQuantityModal({ item, quantityDraft, setQuantityDraft, inputRef, onClose, onSubmit }) {
    if (!item) {
        return null
    }

    return (
        <OrdersModal
            title="Alterar Quantidade"
            subtitle={`Ajuste o volume do item ${item.name}.`}
            size="sm"
            onClose={onClose}
        >
            <form className="orders-modal-stack" onSubmit={onSubmit}>
                <label className="orders-form-field">
                    <span>Quantidade</span>
                    <input
                        ref={inputRef}
                        className="ui-input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={quantityDraft}
                        onChange={(event) => setQuantityDraft(event.target.value)}
                    />
                </label>

                <div className="orders-modal-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Cancelar
                    </button>
                    <button type="submit" className="ui-button">
                        <i className="fa-solid fa-check" />
                        Confirmar
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}

import { useEffect, useMemo, useState } from 'react'
import { formatMoney, formatNumber } from '@/lib/format'

export default function CartPanel({ cart, onQuantityChange, onRemove }) {
    const [selectedItemId, setSelectedItemId] = useState(null)

    useEffect(() => {
        if (!cart.length) {
            setSelectedItemId(null)
            return
        }

        if (!cart.some((item) => item.id === selectedItemId)) {
            setSelectedItemId(cart[0].id)
        }
    }, [cart, selectedItemId])

    const selectedItem = useMemo(
        () => cart.find((item) => item.id === selectedItemId) ?? null,
        [cart, selectedItemId],
    )

    return (
        <section className="pos-card">
            <div className="pos-card-header">
                <div>
                    <h2>Carrinho</h2>
                    <p>Itens separados para fechamento</p>
                </div>
            </div>

            {cart.length ? (
                <div className="pos-cart-list">
                    {selectedItem ? (
                        <div className="pos-cart-detail-card">
                            <div>
                                <span>Item selecionado</span>
                                <strong>{selectedItem.name}</strong>
                            </div>

                            <div className="pos-cart-detail-grid">
                                <div>
                                    <small>Estoque atual</small>
                                    <strong>{formatNumber(Number(selectedItem.stock_quantity ?? 0))}</strong>
                                </div>
                                {selectedItem.code ? (
                                    <div>
                                        <small>Codigo</small>
                                        <strong>{selectedItem.code}</strong>
                                    </div>
                                ) : null}
                                {selectedItem.barcode ? (
                                    <div>
                                        <small>EAN</small>
                                        <strong>{selectedItem.barcode}</strong>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    {cart.map((item) => (
                        <article key={item.id} className={`pos-cart-row ${selectedItemId === item.id ? 'active' : ''}`}>
                            <button
                                type="button"
                                className="pos-cart-summary"
                                onClick={() => setSelectedItemId(item.id)}
                            >
                                <div className="pos-cart-copy">
                                    <strong>{item.name}</strong>
                                    <div className="pos-inline-metadata">
                                        <span className="pos-meta-pill">Unit. {formatMoney(item.sale_price)}</span>
                                        {item.code ? <span className="pos-meta-pill">Cod. {item.code}</span> : null}
                                        {item.barcode ? <span className="pos-meta-pill">EAN {item.barcode}</span> : null}
                                    </div>
                                </div>
                                <span className="pos-cart-summary-action">
                                    {selectedItemId === item.id ? 'Estoque' : 'Ver estoque'}
                                </span>
                            </button>

                            <div className="pos-cart-actions">
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    value={item.qty}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => onQuantityChange(item.id, event.target.value)}
                                />
                                <div className="pos-cart-metric">
                                    <small>Qtd</small>
                                    <strong>{formatNumber(item.qty)}</strong>
                                </div>
                                <div className="pos-cart-metric total">
                                    <small>Total</small>
                                    <strong>{formatMoney(item.sale_price * item.qty)}</strong>
                                </div>
                                <button
                                    className="ui-tooltip"
                                    data-tooltip="Remover item"
                                    onClick={() => onRemove(item.id)}
                                >
                                    <i className="fa-solid fa-trash-can" />
                                    Remover
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="pos-empty-state">Adicione produtos para montar a venda.</div>
            )}
        </section>
    )
}

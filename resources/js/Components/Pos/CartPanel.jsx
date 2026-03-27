import { formatMoney, formatNumber } from '@/lib/format'

export default function CartPanel({ cart, onQuantityChange, onRemove }) {
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
                    {cart.map((item) => (
                        <article key={item.id} className="pos-cart-row">
                            <div>
                                <strong>{item.name}</strong>
                                <span>{formatMoney(item.sale_price)} por unidade</span>
                            </div>

                            <div className="pos-cart-actions">
                                <input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    value={item.qty}
                                    onChange={(event) => onQuantityChange(item.id, event.target.value)}
                                />
                                <span>{formatNumber(item.qty)}</span>
                                <strong>{formatMoney(item.sale_price * item.qty)}</strong>
                                <button onClick={() => onRemove(item.id)}>Remover</button>
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

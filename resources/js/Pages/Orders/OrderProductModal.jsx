import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'

function formatQuickQuantityValue(value) {
    const normalizedValue = Number(value || 0)

    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
        return '1'
    }

    if (Number.isInteger(normalizedValue)) {
        return String(normalizedValue)
    }

    return normalizedValue.toFixed(3).replace(/\.?0+$/, '')
}

export default function OrderProductModal({
    draft,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    searchInputRef,
    productQuickQty,
    setProductQuickQty,
    loadingProducts,
    products,
    onResetProductFilters,
    onAddProduct,
    onClose,
}) {
    if (!draft) {
        return null
    }

    const quickQuantityValue = Number.parseFloat(productQuickQty)
    const quickQuantityLabel = productQuickQty?.trim() || '1'
    const hasSearch = searchTerm.trim() !== ''

    function handleQuickQuantityStep(delta) {
        const currentQuantity = Number.isFinite(quickQuantityValue) && quickQuantityValue > 0 ? quickQuantityValue : 1
        const nextQuantity = Math.max(0.001, currentQuantity + delta)
        setProductQuickQty(formatQuickQuantityValue(nextQuantity))
    }

    return (
        <OrdersModal
            title="Adicionar produto"
            size="lg"
            className="orders-modal-product-compact"
            bodyClassName="orders-modal-product-compact-body"
            footerClassName="orders-modal-product-compact-footer"
            badge={<span className="orders-modal-badge">{draft.reference ? `Pedido ${draft.reference}` : `Pedido #${draft.id}`}</span>}
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="ui-button-ghost" onClick={onResetProductFilters}>
                        <i className="fa-solid fa-rotate-left" />
                        Limpar
                    </button>
                    <button type="button" className="ui-button" onClick={onClose}>
                        <i className="fa-solid fa-check" />
                        Confirmar
                    </button>
                </>
            )}
        >
            <div className="orders-product-compact-shell">
                <div className="orders-product-compact-topline">
                    <label className="orders-product-compact-field">
                        <span>Categoria</span>
                        <select className="ui-select orders-product-compact-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                            <option value="">Todas</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="orders-product-compact-field">
                        <span>Quantidade</span>
                        <div className="orders-product-compact-stepper">
                            <button
                                type="button"
                                className="orders-product-compact-stepper-btn"
                                onClick={() => handleQuickQuantityStep(-1)}
                                aria-label="Diminuir quantidade"
                            >
                                <i className="fa-solid fa-minus" />
                            </button>

                            <input
                                className="ui-input orders-product-compact-stepper-input"
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={productQuickQty}
                                onChange={(event) => setProductQuickQty(event.target.value)}
                            />

                            <button
                                type="button"
                                className="orders-product-compact-stepper-btn"
                                onClick={() => handleQuickQuantityStep(1)}
                                aria-label="Aumentar quantidade"
                            >
                                <i className="fa-solid fa-plus" />
                            </button>
                        </div>
                    </label>
                </div>

                <label className="orders-product-compact-field">
                    <span>Busca</span>
                    <div className="orders-product-compact-search">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            ref={searchInputRef}
                            className="ui-input orders-product-compact-search-input"
                            type="search"
                            value={searchTerm}
                            placeholder="Nome, codigo ou EAN"
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                </label>

                <div className="orders-product-compact-results">
                    {!hasSearch ? (
                        <div className="orders-product-compact-empty">
                            <i className="fa-solid fa-magnifying-glass" />
                            <span>Digite para buscar produtos</span>
                        </div>
                    ) : loadingProducts ? (
                        <div className="orders-product-compact-list">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="ui-skeleton orders-product-compact-skeleton" />
                            ))}
                        </div>
                    ) : products.length ? (
                        <div className="orders-product-compact-list">
                            {products.map((product) => {
                                const meta = [
                                    product.category_name || null,
                                    product.code ? `Cod. ${product.code}` : null,
                                    product.barcode ? `EAN ${product.barcode}` : null,
                                    `Estoque ${formatNumber(product.stock_quantity)}`,
                                ].filter(Boolean).join(' | ')

                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        className="orders-product-compact-item"
                                        onClick={() => onAddProduct(product)}
                                    >
                                        <div className="orders-product-compact-item-copy">
                                            <strong>{product.name}</strong>
                                            <small>{meta}</small>
                                        </div>

                                        <div className="orders-product-compact-item-side">
                                            <span className="orders-product-compact-item-price">{formatMoney(product.sale_price)}</span>
                                            <span className="orders-product-compact-item-add">+ Add</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="orders-product-compact-empty">
                            <i className="fa-solid fa-box-open" />
                            <span>Nenhum produto encontrado</span>
                        </div>
                    )}
                </div>

                <div className="orders-product-compact-summary">
                    <article>
                        <span>Itens</span>
                        <strong>{formatNumber(draft.items.length)}</strong>
                    </article>

                    <article>
                        <span>Total parcial</span>
                        <strong>{formatMoney(draft.total)}</strong>
                    </article>
                </div>

                <div className="orders-product-compact-hint">
                    <i className="fa-solid fa-bolt" />
                    <span>{quickQuantityLabel} unidade(s) por clique no botao + Add</span>
                </div>
            </div>
        </OrdersModal>
    )
}

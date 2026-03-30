import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'

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

    return (
        <OrdersModal
            title="Adicionar produto"
            subtitle={`Comanda ${draft.reference || `#${draft.id}`} pronta para receber novos itens.`}
            size="xl"
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="ui-button-ghost" onClick={onResetProductFilters}>
                        <i className="fa-solid fa-eraser" />
                        Limpar busca
                    </button>
                    <button type="button" className="ui-button" onClick={onClose}>
                        <i className="fa-solid fa-check" />
                        Confirmar
                    </button>
                </>
            )}
        >
            <div className="orders-modal-stack">
                <div className="orders-form-grid compact">
                    <label className="orders-form-field">
                        <span>Categoria</span>
                        <select className="ui-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                            <option value="">Todas</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="orders-form-field span-2">
                        <span>Busca com autocomplete</span>
                        <input
                            ref={searchInputRef}
                            className="ui-input"
                            type="search"
                            value={searchTerm}
                            placeholder="Nome, codigo ou EAN"
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>

                    <label className="orders-form-field">
                        <span>Quantidade rapida</span>
                        <input
                            className="ui-input"
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={productQuickQty}
                            onChange={(event) => setProductQuickQty(event.target.value)}
                        />
                    </label>
                </div>

                <div className="orders-modal-summary-strip">
                    <div>
                        <span>Comanda atual</span>
                        <strong>{draft.label}</strong>
                    </div>
                    <div>
                        <span>Itens</span>
                        <strong>{formatNumber(draft.items.length)}</strong>
                    </div>
                    <div>
                        <span>Total parcial</span>
                        <strong>{formatMoney(draft.total)}</strong>
                    </div>
                </div>

                <div className="orders-product-grid">
                    {!searchTerm.trim() ? (
                        <div className="orders-inline-empty wide">
                            <i className="fa-solid fa-magnifying-glass" />
                            <div>
                                <strong>Digite para buscar produtos</strong>
                                <p>Os resultados aparecem em cards. Clique em qualquer um para adicionar direto na comanda.</p>
                            </div>
                        </div>
                    ) : loadingProducts ? (
                        Array.from({ length: 6 }).map((_, index) => <div key={index} className="ui-skeleton orders-product-skeleton" />)
                    ) : products.length ? (
                        products.map((product) => (
                            <button key={product.id} type="button" className="orders-product-card" onClick={() => onAddProduct(product)}>
                                <div className="orders-product-card-top">
                                    <strong>{product.name}</strong>
                                    <span>{formatMoney(product.sale_price)}</span>
                                </div>

                                <div className="orders-product-card-meta">
                                    {product.code ? <span>Cod. {product.code}</span> : null}
                                    {product.barcode ? <span>EAN {product.barcode}</span> : null}
                                    <span>Estoque {formatNumber(product.stock_quantity)}</span>
                                </div>

                                {product.description ? <p>{product.description}</p> : <p>Produto pronto para adicionar com a quantidade rapida acima.</p>}

                                <div className="orders-product-card-footer">
                                    <span>{productQuickQty || '1'} unidade(s)</span>
                                    <strong>Clique para adicionar</strong>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="orders-inline-empty wide">
                            <i className="fa-solid fa-box-open" />
                            <div>
                                <strong>Nenhum produto encontrado</strong>
                                <p>Refine o termo ou troque a categoria para localizar outro item.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </OrdersModal>
    )
}

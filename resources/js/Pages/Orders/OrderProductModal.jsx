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

    const quickQuantityLabel = productQuickQty?.trim() || '1'
    const hasSearch = searchTerm.trim() !== ''
    const selectedCategoryLabel = selectedCategory
        ? categories.find((category) => String(category.id) === String(selectedCategory))?.name || 'Categoria ativa'
        : 'Todas as categorias'

    return (
        <OrdersModal
            title="Buscar produtos"
            subtitle={`Digite na busca, ajuste a quantidade e use + Add para lancar itens em ${draft.label}.`}
            size="xl"
            className="orders-modal-product-picker"
            bodyClassName="orders-modal-product-picker-body"
            footerClassName="orders-modal-product-picker-footer"
            badge={<span className="orders-modal-badge">{formatNumber(draft.items.length)} itens</span>}
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="ui-button-ghost" onClick={onResetProductFilters}>
                        <i className="fa-solid fa-rotate-left" />
                        Limpar
                    </button>
                    <button type="button" className="ui-button" onClick={onClose}>
                        <i className="fa-solid fa-check" />
                        Pronto
                    </button>
                </>
            )}
        >
            <div className="orders-product-picker-shell">
                <div className="orders-product-picker-main">
                    <div className="orders-product-picker-toolbar">
                        <label className="orders-product-picker-search">
                            <span>Busca de produto</span>
                            <div className="orders-product-picker-search-field">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    ref={searchInputRef}
                                    className="ui-input"
                                    type="search"
                                    value={searchTerm}
                                    placeholder="Nome, codigo ou EAN"
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                />
                                {searchTerm || selectedCategory ? (
                                    <button
                                        type="button"
                                        className="orders-product-picker-search-clear"
                                        onClick={onResetProductFilters}
                                    >
                                        Limpar
                                    </button>
                                ) : null}
                            </div>
                        </label>

                        <div className="orders-product-picker-control-row">
                            <label className="orders-product-picker-control">
                                <span>
                                    <i className="fa-solid fa-layer-group" />
                                    Categoria
                                </span>
                                <select className="ui-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                                    <option value="">Todas</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="orders-product-picker-control qty">
                                <span>
                                    <i className="fa-solid fa-hashtag" />
                                    Qtd. rapida
                                </span>
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
                    </div>

                    <div className="orders-product-picker-results-header">
                        <div>
                            <strong>Catalogo para lancamento rapido</strong>
                            <p>
                                {!hasSearch
                                    ? 'Digite para carregar os produtos em cards compactos.'
                                    : loadingProducts
                                        ? 'Atualizando resultados do catalogo...'
                                        : `${formatNumber(products.length)} resultado(s) para adicionar agora.`}
                            </p>
                        </div>

                        <div className="orders-product-picker-inline-hint">
                            <i className="fa-solid fa-bolt" />
                            <span>{quickQuantityLabel} un. por clique</span>
                        </div>
                    </div>

                    <div className="orders-product-picker-grid">
                        {!hasSearch ? (
                            <div className="orders-inline-empty wide orders-product-picker-empty">
                                <i className="fa-solid fa-magnifying-glass" />
                                <div>
                                    <strong>Comece pela busca</strong>
                                    <p>Digite nome, codigo ou EAN para preencher os cards e usar + Add sem etapas extras.</p>
                                </div>
                            </div>
                        ) : loadingProducts ? (
                            Array.from({ length: 8 }).map((_, index) => (
                                <div key={index} className="ui-skeleton orders-product-skeleton orders-product-picker-skeleton" />
                            ))
                        ) : products.length ? (
                            products.map((product) => {
                                const productDescription = typeof product.description === 'string' && product.description.trim()
                                    ? product.description.trim()
                                    : 'Produto pronto para lancamento rapido no atendimento.'

                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        className="orders-product-picker-card"
                                        onClick={() => onAddProduct(product)}
                                    >
                                        <div className="orders-product-picker-card-head">
                                            <div className="orders-product-picker-card-title">
                                                <span>{product.category_name || 'Sem categoria'}</span>
                                                <strong>{product.name}</strong>
                                            </div>

                                            <span className="orders-product-picker-card-add">+ Add</span>
                                        </div>

                                        <div className="orders-product-picker-card-price">
                                            <strong>{formatMoney(product.sale_price)}</strong>
                                            <span>{quickQuantityLabel} un. por clique</span>
                                        </div>

                                        <div className="orders-product-picker-card-meta">
                                            {product.code ? <span>Cod. {product.code}</span> : null}
                                            {product.barcode ? <span>EAN {product.barcode}</span> : null}
                                            <span>Estoque {formatNumber(product.stock_quantity)}</span>
                                        </div>

                                        <p>{productDescription}</p>

                                        <div className="orders-product-picker-card-foot">
                                            <span>
                                                <i className="fa-solid fa-boxes-stacked" />
                                                Estoque ao vivo
                                            </span>
                                            <span>
                                                <i className="fa-solid fa-arrow-up-right-from-square" />
                                                Toque para adicionar
                                            </span>
                                        </div>
                                    </button>
                                )
                            })
                        ) : (
                            <div className="orders-inline-empty wide orders-product-picker-empty">
                                <i className="fa-solid fa-box-open" />
                                <div>
                                    <strong>Nenhum produto encontrado</strong>
                                    <p>Refine o termo ou troque a categoria para localizar outro item do catalogo.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="orders-product-picker-sidebar">
                    <div className="orders-product-picker-summary">
                        <div className="orders-product-picker-summary-head">
                            <span>
                                <i className="fa-solid fa-receipt" />
                                Resumo visivel
                            </span>
                            <strong>{draft.label}</strong>
                            <small>{draft.reference ? `Referencia ${draft.reference}` : `Atendimento #${draft.id}`}</small>
                        </div>

                        <div className="orders-product-picker-summary-metrics">
                            <article>
                                <span>
                                    <i className="fa-solid fa-bag-shopping" />
                                    Itens
                                </span>
                                <strong>{formatNumber(draft.items.length)}</strong>
                                <small>Atualiza a cada + Add</small>
                            </article>

                            <article className="highlight">
                                <span>
                                    <i className="fa-solid fa-wallet" />
                                    Total
                                </span>
                                <strong>{formatMoney(draft.total)}</strong>
                                <small>Resumo parcial do atendimento</small>
                            </article>
                        </div>

                        <div className="orders-product-picker-active-filters">
                            <span>
                                <i className="fa-solid fa-layer-group" />
                                {selectedCategoryLabel}
                            </span>
                            <span>
                                <i className="fa-solid fa-hashtag" />
                                Qtd. {quickQuantityLabel}
                            </span>
                        </div>

                        <div className="orders-product-picker-summary-note">
                            <i className="fa-solid fa-circle-info" />
                            <p>Os itens entram no atendimento assim que voce toca em + Add. Revise itens e total aqui antes de fechar o modal.</p>
                        </div>
                    </div>
                </aside>
            </div>
        </OrdersModal>
    )
}

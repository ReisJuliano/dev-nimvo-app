import { formatMoney, formatNumber } from '@/lib/format'

function resolveWindowLabel(context, fallbackLabel) {
    if (!context) {
        return fallbackLabel
    }

    if (context.mode === 'all_time') {
        return 'Historico geral'
    }

    if (context.window_days) {
        return `Ultimos ${context.window_days} dias`
    }

    return fallbackLabel
}

function resolveProductCode(product) {
    return product.barcode || product.code || 'Sem codigo'
}

function resolveTopSellerInsight(product) {
    return `${formatNumber(product.quantity_sold, { maximumFractionDigits: 0 })} un. em ${formatNumber(product.sales_count)} venda(s)`
}

function resolveAssociationInsight(product) {
    return `Sai junto em ${formatNumber(product.association_rate, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })}% das vendas relacionadas`
}

function resolveAssociationMeta(product) {
    return `${formatNumber(product.paired_sales_count)} venda(s) com esse combo`
}

function resolveCustomerHistoryInsight(product) {
    return `${formatNumber(product.customer_quantity_sold, { maximumFractionDigits: 0 })} un. em ${formatNumber(product.customer_sales_count)} compra(s)`
}

function resolveCustomerHistoryMeta(product) {
    return product.last_customer_sale_at ? 'Ultima compra registrada' : 'Historico do cliente'
}

export default function RecommendationRail({
    topSellers,
    topSellersContext,
    customerRecommendations,
    customerContext,
    associations,
    associationContext,
    loading,
    onAddProduct,
}) {
    const showAssociations = Boolean(associationContext?.anchor_product_name)
    const showCustomerHistory = Boolean(customerContext?.customer_name)

    if (!showAssociations && !showCustomerHistory && !topSellers.length && !loading) {
        return (
            <section className="pos-recommendation-rail" aria-label="Recomendacoes de produtos">
                <RecommendationLane
                    title="Mais vendidos"
                    subtitle={`Os cards vao aparecer aqui conforme o historico de vendas ganhar volume em ${resolveWindowLabel(topSellersContext, 'historico recente')}.`}
                    icon="trend"
                    tone="top"
                    products={[]}
                    loading={false}
                    onAddProduct={onAddProduct}
                    renderInsight={resolveTopSellerInsight}
                    renderMeta={(product) => resolveProductCode(product)}
                    emptyMessage="Ainda nao ha historico suficiente para montar os acessos rapidos."
                />
            </section>
        )
    }

    return (
        <section className="pos-recommendation-rail" aria-label="Recomendacoes de produtos">
            {showCustomerHistory ? (
                loading && customerRecommendations.length === 0 ? (
                    <RecommendationLane
                        title={`Historico de ${customerContext.customer_name}`}
                        subtitle={`Itens que esse cliente mais compra em ${resolveWindowLabel(customerContext, 'historico recente')}.`}
                        icon="customer"
                        tone="customer"
                        products={[]}
                        loading
                        onAddProduct={onAddProduct}
                        renderInsight={resolveCustomerHistoryInsight}
                        renderMeta={resolveCustomerHistoryMeta}
                        emptyMessage=""
                    />
                ) : customerRecommendations.length ? (
                    <RecommendationLane
                        title={`Historico de ${customerContext.customer_name}`}
                        subtitle={`Itens que esse cliente mais compra em ${resolveWindowLabel(customerContext, 'historico recente')}.`}
                        icon="customer"
                        tone="customer"
                        products={customerRecommendations}
                        loading={loading && customerRecommendations.length === 0}
                        onAddProduct={onAddProduct}
                        renderInsight={resolveCustomerHistoryInsight}
                        renderMeta={resolveCustomerHistoryMeta}
                    />
                ) : (
                    <div className="pos-recommendation-empty-card customer">
                        <span className="pos-recommendation-empty-icon customer">
                            <RecommendationIcon name="customer" />
                        </span>
                        <div>
                            <strong>Sem historico suficiente desse cliente</strong>
                            <p>
                                Assim que <span>{customerContext.customer_name}</span> acumular compras finalizadas,
                                os acessos rapidos vao destacar os itens recorrentes aqui.
                            </p>
                        </div>
                    </div>
                )
            ) : null}

            <RecommendationLane
                title="Mais vendidos"
                subtitle={`Acesso rapido com base em ${resolveWindowLabel(topSellersContext, 'historico recente')}.`}
                icon="trend"
                tone="top"
                products={topSellers}
                loading={loading && topSellers.length === 0}
                onAddProduct={onAddProduct}
                renderInsight={resolveTopSellerInsight}
                renderMeta={(product) => resolveProductCode(product)}
                emptyMessage="Ainda nao ha historico suficiente para destacar os mais vendidos."
            />

            {showAssociations ? (
                loading && associations.length === 0 ? (
                    <RecommendationLane
                        title={`Comprados com ${associationContext.anchor_product_name}`}
                        subtitle={`Sugestoes dinamicas a partir de ${resolveWindowLabel(associationContext, 'historico recente')}.`}
                        icon="link"
                        tone="association"
                        products={[]}
                        loading
                        onAddProduct={onAddProduct}
                        renderInsight={resolveAssociationInsight}
                        renderMeta={resolveAssociationMeta}
                        emptyMessage=""
                    />
                ) : associations.length ? (
                    <RecommendationLane
                        title={`Comprados com ${associationContext.anchor_product_name}`}
                        subtitle={`Sugestoes dinamicas a partir de ${resolveWindowLabel(associationContext, 'historico recente')}.`}
                        icon="link"
                        tone="association"
                        products={associations}
                        loading={loading && associations.length === 0}
                        onAddProduct={onAddProduct}
                        renderInsight={resolveAssociationInsight}
                        renderMeta={resolveAssociationMeta}
                    />
                ) : (
                    <div className="pos-recommendation-empty-card">
                        <span className="pos-recommendation-empty-icon">
                            <RecommendationIcon name="link" />
                        </span>
                        <div>
                            <strong>Sem combinacoes fortes ainda</strong>
                            <p>
                                O item <span>{associationContext.anchor_product_name}</span> ainda nao tem historico
                                suficiente para sugerir um combo confiavel.
                            </p>
                        </div>
                    </div>
                )
            ) : null}
        </section>
    )
}

function RecommendationLane({
    title,
    subtitle,
    icon,
    tone,
    products,
    loading,
    onAddProduct,
    renderInsight,
    renderMeta,
    emptyMessage,
}) {
    return (
        <div className={`pos-recommendation-lane ${tone}`}>
            <div className="pos-recommendation-header">
                <div className="pos-recommendation-copy">
                    <span className={`pos-recommendation-badge ${tone}`}>
                        <RecommendationIcon name={icon} />
                        {title}
                    </span>
                    <p>{subtitle}</p>
                </div>
                <small>{loading ? 'Atualizando' : 'Toque para adicionar'}</small>
            </div>

            <div className="pos-recommendation-scroll" role="list">
                {loading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <div key={`recommendation-skeleton-${index}`} className="pos-recommendation-card is-placeholder" aria-hidden="true" />
                    ))
                    : products.length
                        ? products.map((product) => (
                            <button
                                key={`${tone}-${product.id}`}
                                type="button"
                                className={`pos-recommendation-card ${tone}`}
                                onClick={() => onAddProduct(product)}
                            >
                                <div className="pos-recommendation-card-head">
                                    <span className={`pos-recommendation-chip ${tone}`}>
                                        <RecommendationIcon name={tone === 'association' ? 'spark' : tone === 'customer' ? 'customer' : 'trend'} />
                                        {tone === 'association'
                                            ? `${formatNumber(product.association_rate, { maximumFractionDigits: 1 })}%`
                                            : tone === 'customer'
                                                ? `${formatNumber(product.customer_sales_count, { maximumFractionDigits: 0 })} compra(s)`
                                                : `${formatNumber(product.quantity_sold, { maximumFractionDigits: 0 })} un.`}
                                    </span>
                                    <span className="pos-recommendation-code">{resolveProductCode(product)}</span>
                                </div>

                                <strong>{product.name}</strong>
                                <p>{renderInsight(product)}</p>

                                <div className="pos-recommendation-card-footer">
                                    <div className="pos-recommendation-price-block">
                                        <small>{renderMeta(product)}</small>
                                        <span>{formatMoney(product.sale_price)}</span>
                                    </div>

                                    <span className="pos-recommendation-add">
                                        <RecommendationIcon name="plus" />
                                        Adicionar
                                    </span>
                                </div>
                            </button>
                        ))
                        : (
                            <div className="pos-recommendation-empty-inline">
                                <RecommendationIcon name={icon} />
                                <span>{emptyMessage}</span>
                            </div>
                        )}
            </div>
        </div>
    )
}

function RecommendationIcon({ name }) {
    switch (name) {
        case 'trend':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 16.5 9.5 11l3.5 3.5L20 7.5" />
                    <path d="M14 7.5h6v6" />
                </svg>
            )
        case 'link':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.5 13.5 13.5 10.5" />
                    <path d="M8.75 16.25 6.5 18.5a3 3 0 0 1-4.25-4.25L4.5 12" />
                    <path d="m15.25 7.75 2.25-2.25a3 3 0 1 1 4.25 4.25L19.5 12" />
                </svg>
            )
        case 'spark':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
                    <path d="m18.5 15 .8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z" />
                </svg>
            )
        case 'customer':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    <path d="M5 20a7 7 0 0 1 14 0" />
                </svg>
            )
        case 'plus':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                </svg>
            )
        default:
            return null
    }
}

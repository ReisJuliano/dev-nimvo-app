import { Head } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import './shop.css'

const emptyCustomer = {
    name: '',
    phone: '',
    notes: '',
}

function buildCartIndex(products, cart) {
    return cart
        .map((item) => {
            const product = products.find((entry) => entry.id === item.id)

            if (!product) {
                return null
            }

            return {
                ...item,
                product,
            }
        })
        .filter(Boolean)
}

function buildWhatsAppUrl(phone, lines) {
    const normalizedPhone = String(phone || '').replace(/\D+/g, '')

    if (!normalizedPhone) {
        return null
    }

    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(lines.join('\n'))}`
}

export default function ShopIndex({ store, catalog, whatsApp, collections, products }) {
    const [search, setSearch] = useState('')
    const [activeCollection, setActiveCollection] = useState(catalog.featured_collection || '')
    const [cart, setCart] = useState([])
    const [customer, setCustomer] = useState(emptyCustomer)
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [lastOrder, setLastOrder] = useState(null)
    const showPrices = catalog.show_prices !== false
    useErrorFeedbackPopup(feedback)

    const filteredProducts = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()

        return products.filter((product) => {
            const matchesCollection =
                activeCollection === '' || String(product.collection || '') === String(activeCollection)
            const matchesSearch =
                normalizedSearch === '' ||
                [
                    product.name,
                    product.code,
                    product.style_reference,
                    product.collection,
                    product.color,
                    product.size,
                    product.category_name,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(normalizedSearch))

            return matchesCollection && matchesSearch
        })
    }, [activeCollection, products, search])

    const cartItems = useMemo(() => buildCartIndex(products, cart), [cart, products])
    const cartCount = useMemo(
        () => cartItems.reduce((total, item) => total + Number(item.qty || 0), 0),
        [cartItems],
    )
    const cartTotal = useMemo(
        () => cartItems.reduce((total, item) => total + Number(item.qty || 0) * Number(item.product.sale_price || 0), 0),
        [cartItems],
    )
    const directWhatsAppUrl = useMemo(() => {
        if (!store.whatsAppEnabled || !cartItems.length) {
            return null
        }

        const lines = [
            whatsApp.greeting || 'Oi! Quero montar um pedido.',
            '',
            ...cartItems.map((item) => {
                const grade = [item.product.color, item.product.size].filter(Boolean).join(' / ')
                const suffix = grade ? ` (${grade})` : ''

                return `- ${item.product.name}${suffix} x${item.qty}`
            }),
            customer.name ? `Cliente: ${customer.name}` : null,
        ].filter(Boolean)

        return buildWhatsAppUrl(whatsApp.phone, lines)
    }, [cartItems, customer.name, store.whatsAppEnabled, whatsApp.greeting, whatsApp.phone])

    function addToCart(product) {
        if (!product.in_stock) {
            return
        }

        setFeedback(null)
        setCart((current) => {
            const existing = current.find((item) => item.id === product.id)

            if (existing) {
                return current.map((item) =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
                )
            }

            return [...current, { id: product.id, qty: 1 }]
        })
    }

    function changeQuantity(productId, nextQty) {
        if (nextQty <= 0) {
            setCart((current) => current.filter((item) => item.id !== productId))

            return
        }

        setCart((current) =>
            current.map((item) => (item.id === productId ? { ...item, qty: nextQty } : item)),
        )
    }

    async function handleCheckout(event) {
        event.preventDefault()

        if (!cartItems.length) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um item ao carrinho.' })
            return
        }

        setSubmitting(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/shop/api/checkout', {
                method: 'post',
                data: {
                    customer: {
                        name: customer.name,
                        phone: customer.phone || null,
                    },
                    notes: customer.notes || null,
                    items: cartItems.map((item) => ({
                        id: item.product.id,
                        qty: Number(item.qty),
                    })),
                },
            })

            setLastOrder({
                reference: response.reference,
                whatsAppUrl: response.whatsapp_url,
            })
            setCart([])
            setCustomer(emptyCustomer)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Head title={`${store.name} Shop`} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@600;700&display=swap"
                rel="stylesheet"
            />
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
            />

            <div className="shop-page">
                <section className="shop-hero">
                    <div className="shop-hero-copy">
                        <span className="shop-eyebrow">Same domain, own shop</span>
                        <h1>{store.name}</h1>
                        <p>{catalog.subtitle || 'Colecoes selecionadas, pecas publicadas e pedido online no mesmo dominio da loja.'}</p>

                        <div className="shop-hero-actions">
                            <a href="#colecoes" className="shop-primary-link">
                                Explorar o shop
                            </a>
                            {directWhatsAppUrl ? (
                                <a href={directWhatsAppUrl} target="_blank" rel="noreferrer" className="shop-secondary-link">
                                    Falar no WhatsApp
                                </a>
                            ) : null}
                        </div>
                    </div>

                    <div className="shop-hero-aside">
                        <article>
                            <span>Produtos publicados</span>
                            <strong>{formatNumber(products.length)}</strong>
                            <small>Vitrine ativa</small>
                        </article>
                        <article>
                            <span>Colecoes</span>
                            <strong>{formatNumber(collections.length)}</strong>
                            <small>Recortes da loja</small>
                        </article>
                        <article>
                            <span>Atendimento</span>
                            <strong>{whatsApp.business_hours || 'Online'}</strong>
                            <small>Mesmo dominio, fluxo real</small>
                        </article>
                    </div>
                </section>

                <section className="shop-filter-bar" id="colecoes">
                    <div className="shop-search">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            type="search"
                            placeholder="Buscar por nome, referencia, colecao, cor ou tamanho"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <div className="shop-collections">
                        <button
                            type="button"
                            className={`shop-collection-chip ${activeCollection === '' ? 'active' : ''}`}
                            onClick={() => setActiveCollection('')}
                        >
                            Tudo
                        </button>
                        {collections.map((collection) => (
                            <button
                                key={collection}
                                type="button"
                                className={`shop-collection-chip ${activeCollection === collection ? 'active' : ''}`}
                                onClick={() => setActiveCollection(collection)}
                            >
                                {collection}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="shop-layout">
                    <div className="shop-products">
                        {filteredProducts.length ? (
                            filteredProducts.map((product) => (
                                <article key={product.id} className="shop-product-card">
                                    <div className="shop-product-surface">
                                        <div className="shop-product-topline">
                                            <span>{product.collection || product.category_name || 'Colecao principal'}</span>
                                            {product.promotion ? (
                                                <span className="shop-product-promo">
                                                    {product.promotion.highlight_text || product.promotion.name}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="shop-product-body">
                                            <div>
                                                <h2>{product.name}</h2>
                                                <p>{product.description || 'Peca publicada na vitrine online da loja.'}</p>
                                            </div>

                                            <div className="shop-product-meta">
                                                <span>{product.style_reference || product.code}</span>
                                                <span>{[product.color, product.size].filter(Boolean).join(' / ') || 'Grade unica'}</span>
                                            </div>
                                        </div>

                                        <div className="shop-product-footer">
                                            <div>
                                                {showPrices ? (
                                                    <strong>{formatMoney(product.sale_price)}</strong>
                                                ) : (
                                                    <strong>Consulte valores</strong>
                                                )}
                                                <small>{product.in_stock ? 'Pronto para pedido' : 'Sem estoque no momento'}</small>
                                            </div>

                                            <button
                                                type="button"
                                                className="shop-add-button"
                                                disabled={!product.in_stock}
                                                onClick={() => addToCart(product)}
                                            >
                                                {product.in_stock ? 'Adicionar' : 'Indisponivel'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <section className="shop-empty-state">
                                <strong>Nenhum item encontrado</strong>
                                <p>Ajuste a busca ou troque a colecao para ver as pecas publicadas no shop.</p>
                            </section>
                        )}
                    </div>

                    <aside className="shop-cart-card">
                        <div className="shop-cart-header">
                            <div>
                                <span>Carrinho</span>
                                <h2>{formatNumber(cartCount)} item(ns)</h2>
                            </div>
                            <small>{store.shopPath}</small>
                        </div>

                        {feedback ? (
                            <div className={`shop-feedback ${feedback.type}`}>{feedback.text}</div>
                        ) : null}

                        {lastOrder ? (
                            <div className="shop-success-card">
                                <span>Pedido recebido</span>
                                <strong>{lastOrder.reference}</strong>
                                <p>O shop salvou o pedido no tenant e ele ja pode ser tratado em pedidos online.</p>
                                {lastOrder.whatsAppUrl ? (
                                    <a href={lastOrder.whatsAppUrl} target="_blank" rel="noreferrer" className="shop-secondary-link">
                                        Continuar no WhatsApp
                                    </a>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="shop-cart-items">
                            {cartItems.length ? (
                                cartItems.map((item) => (
                                    <article key={item.product.id} className="shop-cart-item">
                                        <div>
                                            <strong>{item.product.name}</strong>
                                            <small>
                                                {[item.product.color, item.product.size].filter(Boolean).join(' / ') || item.product.code}
                                            </small>
                                        </div>
                                        <div className="shop-qty-controls">
                                            <button type="button" onClick={() => changeQuantity(item.product.id, item.qty - 1)}>
                                                -
                                            </button>
                                            <span>{formatNumber(item.qty)}</span>
                                            <button type="button" onClick={() => changeQuantity(item.product.id, item.qty + 1)}>
                                                +
                                            </button>
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <div className="shop-empty-cart">
                                    Selecione as pecas no grid ao lado para montar o pedido do shop.
                                </div>
                            )}
                        </div>

                        <form className="shop-checkout-form" onSubmit={handleCheckout}>
                            <label>
                                <span>Nome</span>
                                <input
                                    value={customer.name}
                                    onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Quem esta comprando?"
                                    required
                                />
                            </label>
                            <label>
                                <span>Telefone</span>
                                <input
                                    value={customer.phone}
                                    onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))}
                                    placeholder="(11) 99999-9999"
                                />
                            </label>
                            <label>
                                <span>Observacoes</span>
                                <textarea
                                    rows="4"
                                    value={customer.notes}
                                    onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))}
                                    placeholder="Ex.: entregar em horario comercial"
                                />
                            </label>

                            <div className="shop-total-box">
                                <span>Resumo</span>
                                {showPrices ? (
                                    <strong>{formatMoney(cartTotal)}</strong>
                                ) : (
                                    <strong>Valor confirmado no atendimento</strong>
                                )}
                            </div>

                            <div className="shop-checkout-actions">
                                {store.checkoutEnabled ? (
                                    <button type="submit" className="shop-primary-button" disabled={submitting || !cartItems.length}>
                                        {submitting ? 'Enviando...' : 'Enviar pedido do shop'}
                                    </button>
                                ) : null}

                                {directWhatsAppUrl ? (
                                    <a href={directWhatsAppUrl} target="_blank" rel="noreferrer" className="shop-secondary-link">
                                        Levar ao WhatsApp
                                    </a>
                                ) : null}
                            </div>
                        </form>
                    </aside>
                </section>
            </div>
        </>
    )
}

import { Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './stock-entry-simple.css'

const emptyReceiveForm = {
    product_id: '',
    quantity: '',
    cost_price: '',
    notes: '',
}

export default function StockEntryIndex({ moduleTitle = 'Estoque', payload }) {
    const [products, setProducts] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [form, setForm] = useState(emptyReceiveForm)
    const [query, setQuery] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [saving, setSaving] = useState(false)

    const selectedProduct = products.find((product) => String(product.id) === String(form.product_id)) || null

    const productOptions = useMemo(() => {
        const normalized = normalizeTextSearch(query)

        if (!normalized) {
            return products.slice(0, 10)
        }

        return products
            .filter((product) => matchesTextSearchAny([product.name, product.code, product.barcode], normalized))
            .slice(0, 10)
    }, [products, query])

    const lowStockProducts = useMemo(() => (
        products
            .filter((product) => Number(product.stock_quantity || 0) <= Number(product.min_stock || 0))
            .sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0))
    ), [products])

    function updateForm(field, value) {
        setForm((current) => ({ ...current, [field]: value }))
        setFeedback(null)
    }

    function selectProduct(product) {
        setForm((current) => ({
            ...current,
            product_id: String(product.id),
            cost_price: product.cost_price ? String(product.cost_price) : current.cost_price,
        }))
        setQuery(product.name)
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (!form.product_id) {
            setFeedback({ type: 'error', text: 'Escolha o produto que chegou.' })
            return
        }

        if (Number(form.quantity || 0) <= 0) {
            setFeedback({ type: 'error', text: 'Informe a quantidade recebida.' })
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/api/stock/quick-receive', {
                method: 'post',
                data: {
                    product_id: Number(form.product_id),
                    quantity: Number(form.quantity),
                    cost_price: form.cost_price === '' ? null : Number(form.cost_price),
                    notes: form.notes.trim() || null,
                },
            })

            setProducts((current) => current.map((product) => (
                String(product.id) === String(response.product.id) ? { ...product, ...response.product } : product
            )))
            setForm(emptyReceiveForm)
            setQuery('')
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || 'Nao foi possivel atualizar o estoque.' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="stock-simple-page">
                <section className="stock-simple-hero">
                    <div>
                        <h1>Estoque</h1>
                        <p>Controle o que entrou, saiu e esta acabando.</p>
                    </div>
                </section>

                <section className="stock-action-grid">
                    <a className="stock-action-card active" href="#recebi-mercadoria">
                        <i className="fa-solid fa-dolly" />
                        <span>Recebi mercadoria</span>
                    </a>
                    <Link className="stock-action-card" href="/movimentacao-estoque">
                        <i className="fa-solid fa-sliders" />
                        <span>Ajustar estoque</span>
                    </Link>
                    <a className="stock-action-card" href="#produtos-acabando">
                        <i className="fa-solid fa-triangle-exclamation" />
                        <span>Ver produtos acabando</span>
                    </a>
                    <Link className="stock-action-card" href="/movimentacao-estoque">
                        <i className="fa-solid fa-clock-rotate-left" />
                        <span>Historico do estoque</span>
                    </Link>
                </section>

                <section id="recebi-mercadoria" className="stock-simple-panel">
                    <header>
                        <div>
                            <h2>Recebi mercadoria</h2>
                            <p>Registre o que chegou na loja, sem nota fiscal nesta tela.</p>
                        </div>
                    </header>

                    <form className="stock-receive-form" onSubmit={handleSubmit}>
                        <label>
                            <span>Produto</span>
                            <input
                                className="ui-input"
                                placeholder="Buscar por nome, codigo ou codigo de barras"
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value)
                                    updateForm('product_id', '')
                                }}
                            />
                        </label>

                        {query || !selectedProduct ? (
                            <div className="stock-product-list">
                                {productOptions.length ? productOptions.map((product) => (
                                    <button key={product.id} type="button" onClick={() => selectProduct(product)}>
                                        <strong>{product.name}</strong>
                                        <span>Estoque {formatNumber(product.stock_quantity || 0)} {product.unit || 'UN'}</span>
                                    </button>
                                )) : <span className="stock-empty-text">Cadastre seu primeiro produto ou venda cadastrando na hora.</span>}
                            </div>
                        ) : null}

                        <div className="stock-receive-grid">
                            <label>
                                <span>Quantidade recebida</span>
                                <input className="ui-input" type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => updateForm('quantity', event.target.value)} />
                            </label>
                            <label>
                                <span>Custo</span>
                                <input className="ui-input" type="number" min="0" step="0.01" value={form.cost_price} onChange={(event) => updateForm('cost_price', event.target.value)} placeholder="Opcional" />
                            </label>
                            <label>
                                <span>Observacao</span>
                                <input className="ui-input" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Opcional" />
                            </label>
                        </div>

                        {selectedProduct ? (
                            <div className="stock-selected-product">
                                <span>{selectedProduct.name}</span>
                                <strong>Atual: {formatNumber(selectedProduct.stock_quantity || 0)} {selectedProduct.unit || 'UN'}</strong>
                                <small>Custo atual {formatMoney(selectedProduct.cost_price || 0)}</small>
                            </div>
                        ) : null}

                        {feedback ? <div className={`stock-feedback ${feedback.type}`}>{feedback.text}</div> : null}

                        <div className="stock-form-actions">
                            <button className="ui-button" type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </section>

                <section id="produtos-acabando" className="stock-simple-panel">
                    <header>
                        <div>
                            <h2>Produtos acabando</h2>
                            <p>Tudo certo por enquanto se a lista estiver vazia.</p>
                        </div>
                    </header>

                    {lowStockProducts.length ? (
                        <div className="stock-low-list">
                            {lowStockProducts.map((product) => (
                                <article key={product.id} className="stock-low-item">
                                    <div>
                                        <strong>{product.name}</strong>
                                        <span>Atual {formatNumber(product.stock_quantity || 0)} / minimo {formatNumber(product.min_stock || 0)}</span>
                                    </div>
                                    <button type="button" className="ui-button-ghost" onClick={() => selectProduct(product)}>
                                        Recebi mais
                                    </button>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="stock-empty-text">Tudo certo por enquanto.</p>
                    )}
                </section>
            </div>
        </AppLayout>
    )
}

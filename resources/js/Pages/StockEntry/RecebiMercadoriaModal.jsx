import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'

const emptyForm = {
    product_id: '',
    quantity: '',
    cost_price: '',
    notes: '',
}

export default function RecebiMercadoriaModal({
    open,
    products = [],
    initialProduct = null,
    onClose,
    onSaved,
}) {
    const [form, setForm] = useState(emptyForm)
    const [query, setQuery] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return

        setForm({
            ...emptyForm,
            product_id: initialProduct?.id ? String(initialProduct.id) : '',
            cost_price: initialProduct?.cost_price ? String(initialProduct.cost_price) : '',
        })
        setQuery(initialProduct?.name || '')
        setFeedback(null)
    }, [initialProduct, open])

    const selectedProduct = useMemo(() => (
        products.find((product) => String(product.id) === String(form.product_id)) || null
    ), [form.product_id, products])

    const productOptions = useMemo(() => {
        const normalized = normalizeTextSearch(query)

        if (!normalized) {
            return products.slice(0, 8)
        }

        return products
            .filter((product) => matchesTextSearchAny([product.name, product.code, product.barcode], normalized))
            .slice(0, 8)
    }, [products, query])

    if (!open) return null

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

            onSaved?.(response.product, response.message)
            setFeedback({ type: 'success', text: response.message || 'Entrada registrada.' })
            setTimeout(() => onClose?.(), 450)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || 'Não foi possível atualizar o estoque.' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="stock-modal-backdrop"
            onClick={(event) => {
                if (event.target === event.currentTarget && !saving) onClose?.()
            }}
        >
            <div className="stock-receive-modal" role="dialog" aria-modal="true" aria-labelledby="stock-receive-title">
                <header className="stock-modal-header">
                    <div>
                        <h2 id="stock-receive-title">Recebi mercadoria</h2>
                        <p>Registre uma entrada simples, sem nota fiscal.</p>
                    </div>
                    <button type="button" className="stock-modal-close ui-tooltip" data-tooltip="Fechar" onClick={onClose} disabled={saving}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </header>

                <form className="stock-receive-form" onSubmit={handleSubmit}>
                    <label className="stock-receive-field span-2">
                        <span>Qual produto chegou?</span>
                        <input
                            autoFocus
                            placeholder="Busque por nome ou código"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value)
                                updateForm('product_id', '')
                            }}
                        />
                    </label>

                    {!selectedProduct ? (
                        <div className="stock-product-picker span-2">
                            {productOptions.length ? productOptions.map((product) => (
                                <button key={product.id} type="button" onClick={() => selectProduct(product)}>
                                    <span>
                                        <strong>{product.name}</strong>
                                        <small>Estoque {formatNumber(product.stock_quantity || 0)} {product.unit || 'UN'}</small>
                                    </span>
                                    <i className="fa-solid fa-chevron-right" />
                                </button>
                            )) : (
                                <div className="stock-picker-empty">Nenhum produto encontrado.</div>
                            )}
                        </div>
                    ) : null}

                    {selectedProduct ? (
                        <div className="stock-selected-product span-2">
                            <div>
                                <span>{selectedProduct.name}</span>
                                <strong>Atual: {formatNumber(selectedProduct.stock_quantity || 0)} {selectedProduct.unit || 'UN'}</strong>
                                <small>Custo atual {formatMoney(selectedProduct.cost_price || 0)}</small>
                            </div>
                            <button
                                type="button"
                                className="stock-selected-remove ui-tooltip"
                                data-tooltip="Trocar produto"
                                aria-label="Trocar produto"
                                onClick={() => {
                                    updateForm('product_id', '')
                                    setQuery('')
                                }}
                            >
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>
                    ) : null}

                    <label className="stock-receive-field">
                        <span>Quantidade recebida</span>
                        <input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => updateForm('quantity', event.target.value)} />
                    </label>

                    <label className="stock-receive-field">
                        <span>Custo unitário</span>
                        <input type="number" min="0" step="0.01" value={form.cost_price} onChange={(event) => updateForm('cost_price', event.target.value)} placeholder="Opcional" />
                    </label>

                    <label className="stock-receive-field span-2">
                        <span>Observação</span>
                        <input value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Opcional" />
                    </label>

                    {feedback ? <div className={`stock-feedback span-2 ${feedback.type}`}>{feedback.text}</div> : null}

                    <footer className="stock-modal-actions span-2">
                        <button type="button" className="ui-button-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={saving}>
                            {saving ? 'Registrando...' : 'Registrar entrada'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    )
}

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'

export default function BulkAddProductsPanel({ campaignId, existingProductIds, onAdded }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [draftRows, setDraftRows] = useState([])
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    useEffect(() => {
        const term = query.trim()

        if (term === '') {
            setResults([])
            return
        }

        const timeout = setTimeout(async () => {
            setSearching(true)
            try {
                const response = await apiRequest('/api/promotions/products/search', { params: { q: term } })
                setResults(response.products || [])
            } catch {
                setResults([])
            } finally {
                setSearching(false)
            }
        }, 300)

        return () => clearTimeout(timeout)
    }, [query])

    function addToDraft(product) {
        if (draftRows.some((row) => row.product_id === product.id) || existingProductIds.includes(product.id)) {
            return
        }

        setDraftRows((current) => [...current, {
            product_id: product.id,
            name: product.name,
            code: product.code,
            sale_price: Number(product.sale_price || 0),
            discount_value: '',
        }])
    }

    function updateDraftPrice(productId, value) {
        setDraftRows((current) => current.map((row) => (row.product_id === productId ? { ...row, discount_value: value } : row)))
    }

    function removeDraft(productId) {
        setDraftRows((current) => current.filter((row) => row.product_id !== productId))
    }

    async function saveDraft() {
        const items = draftRows
            .filter((row) => row.discount_value !== '' && Number(row.discount_value) > 0)
            .map((row) => ({ product_id: row.product_id, discount_value: Number(row.discount_value), name: row.name }))

        if (!items.length) {
            setFeedback({ type: 'warning', text: 'Informe o preço promocional de ao menos um produto.' })
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/api/promotion-campaigns/${campaignId}/bulk-items`, { method: 'post', data: { items } })
            setDraftRows([])
            setFeedback({ type: 'success', text: response.message })
            onAdded?.()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="promo-bulk-panel">
            <div className="promo-bulk-search">
                <i className="fa-solid fa-magnifying-glass" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar produto por nome, código ou código de barras..."
                    autoComplete="off"
                />
            </div>

            {query.trim() !== '' ? (
                <div className="promo-bulk-results">
                    {searching ? (
                        <p className="promo-bulk-hint">Buscando...</p>
                    ) : results.length ? (
                        results.map((product) => {
                            const alreadyAdded = draftRows.some((row) => row.product_id === product.id) || existingProductIds.includes(product.id)
                            return (
                                <button
                                    key={product.id}
                                    type="button"
                                    className="promo-bulk-result-row"
                                    disabled={alreadyAdded}
                                    onClick={() => addToDraft(product)}
                                >
                                    <div>
                                        <strong>{product.name}</strong>
                                        <small>{product.code || product.barcode || '-'} · {formatMoney(product.sale_price || 0)}</small>
                                    </div>
                                    {alreadyAdded ? <span className="promo-bulk-added-tag">Já adicionado</span> : <i className="fa-solid fa-plus" />}
                                </button>
                            )
                        })
                    ) : (
                        <p className="promo-bulk-hint">Nenhum produto encontrado.</p>
                    )}
                </div>
            ) : null}

            {draftRows.length ? (
                <div className="promo-bulk-draft">
                    <p className="nimvo-section-label">Ofertas a adicionar ({draftRows.length})</p>
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th style={{ width: 110 }}>De</th>
                                <th style={{ width: 140 }}>Por (promocional)</th>
                                <th style={{ width: 40 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {draftRows.map((row) => (
                                <tr key={row.product_id}>
                                    <td>{row.name}</td>
                                    <td>{formatMoney(row.sale_price)}</td>
                                    <td>
                                        <input
                                            className="ui-input"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={row.sale_price || undefined}
                                            value={row.discount_value}
                                            onChange={(event) => updateDraftPrice(row.product_id, event.target.value)}
                                            placeholder="R$ 0,00"
                                        />
                                    </td>
                                    <td>
                                        <button type="button" className="ui-icon-button" onClick={() => removeDraft(row.product_id)}>
                                            <i className="fa-solid fa-xmark" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {feedback ? (
                        <div className={`ui-alert ${feedback.type === 'error' ? 'error' : feedback.type === 'warning' ? 'warning' : 'success'}`}>
                            <p>{feedback.text}</p>
                        </div>
                    ) : null}

                    <div className="promo-form-actions">
                        <button type="button" className="ui-button" disabled={saving} onClick={saveDraft}>
                            <i className="fa-solid fa-check" />
                            {saving ? 'Salvando...' : `Salvar ${draftRows.length} oferta(s)`}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

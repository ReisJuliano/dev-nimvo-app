import { useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { showErrorPopup } from '@/lib/errorPopup'
import { formatMoney } from '@/lib/format'
import '../Sales/return-wizard.css'

export default function PurchaseReturnWizard({ canIssueFiscal = false }) {
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [purchase, setPurchase] = useState(null)
    const [items, setItems] = useState([])
    const [quantities, setQuantities] = useState({})
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [issuingFiscal, setIssuingFiscal] = useState(false)

    async function handleSearch(event) {
        event.preventDefault()
        if (!code.trim()) return

        setLoading(true)
        setPurchase(null)
        setItems([])
        setResult(null)
        setQuantities({})

        try {
            const lookup = await apiRequest('/api/purchases/returns/lookup', { params: { code: code.trim() } })
            const response = await apiRequest(`/api/purchases/${lookup.purchase.id}/returnable-items`)
            setPurchase(lookup.purchase)
            setItems(response.items)
        } catch (error) {
            showErrorPopup(error.message || 'Compra não encontrada.')
        } finally {
            setLoading(false)
        }
    }

    function updateQuantity(purchaseItemId, value) {
        setQuantities((current) => ({ ...current, [purchaseItemId]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (!purchase) return

        const payloadItems = Object.entries(quantities)
            .map(([purchase_item_id, quantity]) => ({ purchase_item_id: Number(purchase_item_id), quantity: Number(quantity) }))
            .filter((item) => item.quantity > 0)

        if (payloadItems.length === 0) {
            showErrorPopup('Informe a quantidade de ao menos um item para devolver.')
            return
        }

        setSubmitting(true)

        try {
            const response = await apiRequest(`/api/purchases/${purchase.id}/returns`, {
                method: 'post',
                data: { items: payloadItems, reason },
            })

            setResult(response.purchase_return)
            setQuantities({})
            setReason('')

            const refreshed = await apiRequest(`/api/purchases/${purchase.id}/returnable-items`)
            setItems(refreshed.items)
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível registrar a devolução.')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleIssueFiscal() {
        if (!result) return

        setIssuingFiscal(true)

        try {
            const response = await apiRequest(`/api/purchase-returns/${result.id}/issue-fiscal`, { method: 'post' })
            setResult((current) => ({ ...current, fiscal_document_id: response.fiscal_document_id }))
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível emitir a NF-e de devolução.')
        } finally {
            setIssuingFiscal(false)
        }
    }

    const eligibleForFiscal = items.some((item) => item.eligible_for_fiscal_return)

    return (
        <AppLayout title="Devolução de compra">
            <div className="return-wizard-page">
                <h1>Devolução de compra (ao fornecedor)</h1>

                <form className="return-wizard-search" onSubmit={handleSearch}>
                    <label>
                        <span>Código da compra</span>
                        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex.: COMPRA-20260711-0001" />
                    </label>
                    <button type="submit" className="return-wizard-button" disabled={loading}>
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {purchase ? (
                    <form className="return-wizard-form" onSubmit={handleSubmit}>
                        <div className="return-wizard-summary">
                            <div><span>Compra</span><strong>{purchase.code}</strong></div>
                            <div><span>Fornecedor</span><strong>{purchase.supplier_name || '-'}</strong></div>
                            <div><span>Total</span><strong>{formatMoney(purchase.total)}</strong></div>
                        </div>

                        {!purchase.stock_applied ? (
                            <p className="return-wizard-hint return-wizard-hint--warning">
                                Esta compra ainda não teve entrada aplicada no estoque — não é possível devolver itens dela.
                            </p>
                        ) : !eligibleForFiscal ? (
                            <p className="return-wizard-hint">
                                Esta compra não veio de uma NF-e de entrada importada, então a devolução será só comercial (estoque e crédito), sem emissão de NF-e de devolução.
                            </p>
                        ) : (
                            <p className="return-wizard-hint">
                                Depois de registrar a devolução você pode emitir a NF-e de devolução referenciando a nota do fornecedor.
                            </p>
                        )}

                        <table className="return-wizard-items-table">
                            <thead>
                                <tr><th>Produto</th><th>Comprado</th><th>Disponível p/ devolver</th><th>Devolver agora</th></tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.purchase_item_id}>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity}</td>
                                        <td>{item.available_quantity}</td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.available_quantity}
                                                step="0.001"
                                                disabled={!purchase.stock_applied || item.available_quantity <= 0}
                                                value={quantities[item.purchase_item_id] || ''}
                                                onChange={(event) => updateQuantity(item.purchase_item_id, event.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <label className="return-wizard-field--full">
                            <span>Motivo da devolução</span>
                            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} required minLength={5} />
                        </label>

                        <button type="submit" className="return-wizard-button" disabled={submitting || !purchase.stock_applied}>
                            {submitting ? 'Registrando...' : 'Registrar devolução'}
                        </button>
                    </form>
                ) : null}

                {result ? (
                    <div className="return-wizard-result">
                        <p>Devolução registrada com sucesso.</p>
                        {canIssueFiscal && eligibleForFiscal && !result.fiscal_document_id ? (
                            <button type="button" className="return-wizard-button" disabled={issuingFiscal} onClick={handleIssueFiscal}>
                                {issuingFiscal ? 'Emitindo...' : 'Emitir NF-e de devolução'}
                            </button>
                        ) : null}
                        {result.fiscal_document_id ? (
                            <p className="return-wizard-hint">NF-e de devolução enviada para processamento (documento #{result.fiscal_document_id}).</p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </AppLayout>
    )
}

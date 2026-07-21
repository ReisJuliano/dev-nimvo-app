import { useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { showErrorPopup } from '@/lib/errorPopup'
import { formatMoney } from '@/lib/format'
import './return-wizard.css'

export default function SaleReturnWizard({ canIssueFiscal = false }) {
    const [saleNumber, setSaleNumber] = useState('')
    const [loading, setLoading] = useState(false)
    const [sale, setSale] = useState(null)
    const [returnable, setReturnable] = useState(null)
    const [quantities, setQuantities] = useState({})
    const [reason, setReason] = useState('')
    const [refundMethod, setRefundMethod] = useState('none')
    const [refundAmount, setRefundAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [issuingFiscal, setIssuingFiscal] = useState(false)

    async function handleSearch(event) {
        event.preventDefault()
        if (!saleNumber.trim()) return

        setLoading(true)
        setSale(null)
        setReturnable(null)
        setResult(null)
        setQuantities({})

        try {
            const lookup = await apiRequest('/api/fiscal/notas/sales/lookup', { params: { sale_number: saleNumber.trim() } })
            const items = await apiRequest(`/api/sales/${lookup.sale.id}/returnable-items`)
            setSale(lookup.sale)
            setReturnable(items)
        } catch (error) {
            showErrorPopup(error.message || 'Venda não encontrada.')
        } finally {
            setLoading(false)
        }
    }

    function updateQuantity(saleItemId, value) {
        setQuantities((current) => ({ ...current, [saleItemId]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (!sale || !returnable) return

        const items = Object.entries(quantities)
            .map(([sale_item_id, quantity]) => ({ sale_item_id: Number(sale_item_id), quantity: Number(quantity) }))
            .filter((item) => item.quantity > 0)

        if (items.length === 0) {
            showErrorPopup('Informe a quantidade de ao menos um item para devolver.')
            return
        }

        setSubmitting(true)

        try {
            const response = await apiRequest(`/api/sales/${sale.id}/returns`, {
                method: 'post',
                data: {
                    items,
                    reason,
                    refund_method: refundMethod,
                    refund_amount: refundAmount || 0,
                },
            })

            setResult(response.sale_return)
            setQuantities({})
            setReason('')
            setRefundAmount('')

            const items2 = await apiRequest(`/api/sales/${sale.id}/returnable-items`)
            setReturnable(items2)
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
            const response = await apiRequest(`/api/sale-returns/${result.id}/issue-fiscal`, { method: 'post' })
            setResult((current) => ({ ...current, fiscal_document_id: response.fiscal_document_id }))
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível emitir a NF-e de devolução.')
        } finally {
            setIssuingFiscal(false)
        }
    }

    return (
        <AppLayout title="Devolução de venda">
            <div className="return-wizard-page">
                <h1>Devolução de venda</h1>

                <form className="return-wizard-search" onSubmit={handleSearch}>
                    <label>
                        <span>Número da venda</span>
                        <input value={saleNumber} onChange={(event) => setSaleNumber(event.target.value)} placeholder="Ex.: VND-20260711-0001" />
                    </label>
                    <button type="submit" className="return-wizard-button" disabled={loading}>
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {sale && returnable ? (
                    <form className="return-wizard-form" onSubmit={handleSubmit}>
                        <div className="return-wizard-summary">
                            <div><span>Venda</span><strong>{sale.sale_number}</strong></div>
                            <div><span>Total</span><strong>{formatMoney(sale.total)}</strong></div>
                            <div>
                                <span>Nota fiscal</span>
                                <strong>{returnable.has_authorized_document ? 'Autorizada' : 'Sem nota fiscal autorizada'}</strong>
                            </div>
                        </div>

                        {!returnable.has_authorized_document ? (
                            <p className="return-wizard-hint">
                                Esta venda não tem NF-e/NFC-e autorizada. A devolução será só comercial (estoque e reembolso), sem emissão de nota.
                            </p>
                        ) : (
                            <p className="return-wizard-hint">
                                Esta venda tem nota fiscal autorizada. Depois de registrar a devolução você pode emitir a NF-e de devolução (modelo 55).
                            </p>
                        )}

                        <table className="return-wizard-items-table">
                            <thead>
                                <tr><th>Produto</th><th>Vendido</th><th>Disponível p/ devolver</th><th>Devolver agora</th></tr>
                            </thead>
                            <tbody>
                                {returnable.items.map((item) => (
                                    <tr key={item.sale_item_id}>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity}</td>
                                        <td>{item.available_quantity}</td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.available_quantity}
                                                step="0.001"
                                                disabled={item.available_quantity <= 0}
                                                value={quantities[item.sale_item_id] || ''}
                                                onChange={(event) => updateQuantity(item.sale_item_id, event.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="return-wizard-grid">
                            <label className="return-wizard-field--full">
                                <span>Motivo da devolução</span>
                                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} required minLength={5} />
                            </label>
                            <label>
                                <span>Forma de reembolso</span>
                                <select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
                                    <option value="none">Nenhum</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="store_credit">Crédito na loja</option>
                                </select>
                            </label>
                            <label>
                                <span>Valor do reembolso</span>
                                <input type="number" min="0" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} />
                            </label>
                        </div>

                        <button type="submit" className="return-wizard-button" disabled={submitting}>
                            {submitting ? 'Registrando...' : 'Registrar devolução'}
                        </button>
                    </form>
                ) : null}

                {result ? (
                    <div className="return-wizard-result">
                        <p>Devolução registrada com sucesso.</p>
                        {canIssueFiscal && returnable?.has_authorized_document && !result.fiscal_document_id ? (
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

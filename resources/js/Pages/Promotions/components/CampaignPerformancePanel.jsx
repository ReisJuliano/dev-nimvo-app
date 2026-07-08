import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'

function defaultRange() {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)

    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function CampaignPerformancePanel({ campaignId }) {
    const [range, setRange] = useState(defaultRange)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const response = await apiRequest(`/api/promotion-campaigns/${campaignId}/performance`, { params: range })
            setData(response)
        } catch {
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId])

    const summary = data?.summary

    return (
        <div className="promo-performance">
            <div className="promo-performance-filters">
                <label>
                    <span>De</span>
                    <input className="ui-input" type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
                </label>
                <label>
                    <span>Até</span>
                    <input className="ui-input" type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
                </label>
                <button type="button" className="ui-button" disabled={loading} onClick={load}>
                    {loading ? 'Carregando...' : 'Atualizar'}
                </button>
            </div>

            {summary ? (
                <div className="promo-performance-kpis">
                    <article><span>Faturamento gerado</span><strong>{formatMoney(summary.revenue)}</strong></article>
                    <article><span>Desconto concedido</span><strong>{formatMoney(summary.discount_granted)}</strong></article>
                    <article><span>Margem</span><strong>{formatMoney(summary.margin)}</strong></article>
                    <article><span>Itens vendidos</span><strong>{formatNumber(summary.quantity_sold)}</strong></article>
                </div>
            ) : null}

            <table className="ui-table">
                <thead>
                    <tr>
                        <th>Promoção</th>
                        <th>Qtd. vendida</th>
                        <th>Faturamento</th>
                        <th>Desconto</th>
                        <th>Margem</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.rows?.length ? data.rows.map((row) => (
                        <tr key={row.promotion_id}>
                            <td>{row.promotion_name}</td>
                            <td>{formatNumber(row.quantity_sold)}</td>
                            <td>{formatMoney(row.revenue)}</td>
                            <td>{formatMoney(row.discount_granted)}</td>
                            <td>{formatMoney(row.margin)}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan={5}>{loading ? 'Carregando...' : 'Nenhuma venda com essas ofertas no período.'}</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

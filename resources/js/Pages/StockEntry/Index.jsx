import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ActionButton from '@/Components/UI/ActionButton'
import ActionDrawer from '@/Components/UI/ActionDrawer'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './stock-entry-simple.css'

function getStockState(product) {
    const stock = Number(product.stock_quantity || 0)
    const min   = Number(product.min_stock || 0)
    if (stock <= 0) return 'zero'
    if (stock <= min) return 'low'
    return 'ok'
}

function stockStateTone(state) {
    if (state === 'zero') return 'danger'
    if (state === 'low') return 'warning'
    return 'success'
}

function stockStateLabel(state) {
    if (state === 'zero') return 'Sem estoque'
    if (state === 'low') return 'Estoque baixo'
    return 'Normal'
}

const TYPE_LABELS = {
    manual_inbound:    'Entrada manual',
    manual_adjustment: 'Ajuste de estoque',
    sale:              'Saída por venda',
    purchase_return:   'Devolução',
    sale_cancellation: 'Cancel. de venda',
    loss:              'Perda registrada',
    initial:           'Estoque inicial',
}

const TYPE_TONES = {
    manual_inbound:    'green',
    manual_adjustment: 'amber',
    sale:              'red',
    purchase_return:   'blue',
    sale_cancellation: 'gray',
    loss:              'red',
    initial:           'blue',
}

export default function StockEntryIndex({ payload }) {
    const [products, setProducts] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [query, setQuery] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)

    // Painel de movimentação
    const [movements, setMovements] = useState([])
    const [movLoading, setMovLoading] = useState(false)
    const [movSearched, setMovSearched] = useState(false)
    const [movFilter, setMovFilter] = useState('')
    const [movFrom, setMovFrom] = useState('')
    const [movTo, setMovTo] = useState('')

    // Ajuste de estoque (inline, dentro do painel do produto)
    const [adjusting, setAdjusting] = useState(false)
    const [adjustQty, setAdjustQty] = useState('')
    const [adjustReason, setAdjustReason] = useState('Ajuste manual de estoque')
    const [adjustNotes, setAdjustNotes] = useState('')
    const [adjustSaving, setAdjustSaving] = useState(false)
    const [adjustFeedback, setAdjustFeedback] = useState(null)

    // Registrar perda (inline, dentro do painel do produto)
    const [registeringLoss, setRegisteringLoss] = useState(false)
    const [lossQty, setLossQty] = useState('')
    const [lossReason, setLossReason] = useState('vencido')
    const [lossSaving, setLossSaving] = useState(false)
    const [lossFeedback, setLossFeedback] = useState(null)

    // Painel "Vencendo em breve"
    const [showExpiring, setShowExpiring] = useState(false)
    const [expiringLots, setExpiringLots] = useState([])
    const [expiringLoading, setExpiringLoading] = useState(false)

    const filteredProducts = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return products
        return products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
    }, [products, query])

    async function loadMovements(product, type = '', from = '', to = '') {
        setMovLoading(true)
        setMovSearched(true)
        try {
            const params = {}
            if (type) params.type = type
            if (from) params.from = from
            if (to)   params.to   = to
            const res = await apiRequest(`/api/stock/products/${product.id}/movements`, { params })
            setMovements(res.movements || [])
        } catch {
            setMovements([])
        } finally {
            setMovLoading(false)
        }
    }

    function openProduct(product) {
        setSelectedProduct(product)
        setMovements([])
        setMovSearched(false)
        setMovFilter('')
        setMovFrom('')
        setMovTo('')
        cancelAdjust()
    }

    function closePanel() {
        setSelectedProduct(null)
        setMovements([])
        setMovSearched(false)
        cancelAdjust()
    }

    function applyMovFilter() {
        if (selectedProduct) loadMovements(selectedProduct, movFilter, movFrom, movTo)
    }

    function startAdjust() {
        setAdjusting(true)
        setAdjustQty(String(selectedProduct?.stock_quantity || 0))
        setAdjustReason('Ajuste manual de estoque')
        setAdjustNotes('')
        setAdjustFeedback(null)
    }

    function cancelAdjust() {
        setAdjusting(false)
        setAdjustQty('')
        setAdjustReason('Ajuste manual de estoque')
        setAdjustNotes('')
        setAdjustFeedback(null)
    }

    function startLoss() {
        setRegisteringLoss(true)
        setLossQty('')
        setLossReason('vencido')
        setLossFeedback(null)
    }

    function cancelLoss() {
        setRegisteringLoss(false)
        setLossQty('')
        setLossFeedback(null)
    }

    async function submitLoss(event, expiryLot = null) {
        event.preventDefault()
        const targetProduct = expiryLot ? { id: expiryLot.product_id, name: expiryLot.product_name } : selectedProduct
        const quantity = expiryLot ? expiryLot.quantity : Number(lossQty)

        if (!targetProduct || !quantity) return

        setLossSaving(true)
        setLossFeedback(null)
        try {
            const res = await apiRequest('/api/stock/register-loss', {
                method: 'post',
                data: {
                    product_id: targetProduct.id,
                    quantity,
                    reason: lossReason,
                    expiry_id: expiryLot?.id || null,
                },
            })
            if (res.product) {
                setProducts((prev) => prev.map((p) => String(p.id) === String(res.product.id) ? { ...p, ...res.product } : p))
                setSelectedProduct((prev) => prev && String(prev.id) === String(res.product.id) ? { ...prev, ...res.product } : prev)
            }
            setLossFeedback({ type: 'success', text: res.message })
            setRegisteringLoss(false)
            if (expiryLot) {
                await loadExpiring()
            } else if (selectedProduct) {
                loadMovements(selectedProduct)
            }
        } catch (err) {
            setLossFeedback({ type: 'error', text: err.message })
        } finally {
            setLossSaving(false)
        }
    }

    async function loadExpiring() {
        setExpiringLoading(true)
        try {
            const res = await apiRequest('/api/stock/expiring')
            setExpiringLots(res.lots || [])
        } catch {
            setExpiringLots([])
        } finally {
            setExpiringLoading(false)
        }
    }

    function toggleExpiring() {
        setShowExpiring((current) => {
            const next = !current
            if (next) loadExpiring()
            return next
        })
    }

    async function submitAdjust(event) {
        event.preventDefault()
        if (!selectedProduct || adjustQty === '') return

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Confirmar ajuste',
            message: `Atualizar "${selectedProduct.name}" de ${formatNumber(selectedProduct.stock_quantity || 0)} para ${formatNumber(Number(adjustQty))} ${selectedProduct.unit || 'UN'}?`,
            confirmLabel: 'Confirmar',
            cancelLabel: 'Cancelar',
        })
        if (!confirmed) return

        setAdjustSaving(true)
        setAdjustFeedback(null)
        try {
            const res = await apiRequest('/api/stock/quick-adjust', {
                method: 'post',
                data: {
                    product_id: selectedProduct.id,
                    counted_quantity: Number(adjustQty),
                    reason: adjustReason.trim() || null,
                    notes: adjustNotes.trim() || null,
                },
            })
            const updated = res.product
            setProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p))
            setSelectedProduct((prev) => prev ? { ...prev, ...updated } : prev)
            setAdjustFeedback({ type: 'success', text: res.message })
            setAdjusting(false)
            loadMovements({ id: updated.id })
        } catch (err) {
            setAdjustFeedback({ type: 'error', text: err.message })
        } finally {
            setAdjustSaving(false)
        }
    }

    // Fechar painel com Escape
    useEffect(() => {
        function onKey(e) { if (e.key === 'Escape') closePanel() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    const productRows = filteredProducts.map((product) => ({
        ...product,
        _state: getStockState(product),
    }))

    return (
        <AppLayout title="Estoque">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Estoque de produtos"
                        search={{
                            placeholder: 'Buscar por nome, código ou código de barras...',
                            value: query,
                            onChange: setQuery,
                        }}
                        actions={(
                            <ActionButton icon="fa-calendar-days" tone="secondary" onClick={toggleExpiring}>
                                {showExpiring ? 'Ocultar vencendo' : 'Vencendo em breve'}
                            </ActionButton>
                        )}
                    />

                    {showExpiring ? (
                        <section className="ui-list-page-table-card se-expiring-card">
                            <DataTable
                                columns={[
                                    { key: 'product_name', label: 'Produto' },
                                    { key: 'category_name', label: 'Categoria', render: (lot) => lot.category_name || 'Sem categoria' },
                                    { key: 'expires_at', label: 'Vence em', render: (lot) => formatDateTime(lot.expires_at) },
                                    { key: 'quantity', label: 'Quantidade', render: (lot) => formatNumber(lot.quantity) },
                                    { key: 'cost_at_risk', label: 'Custo em risco', render: (lot) => formatMoney(lot.cost_at_risk) },
                                ]}
                                rows={expiringLots}
                                rowKey="id"
                                emptyMessage={expiringLoading ? 'Carregando...' : 'Nenhum lote vencendo no período configurado.'}
                                emptyIcon="fa-calendar-days"
                                actions={(lot) => [
                                    {
                                        key: 'register-loss',
                                        icon: 'fa-triangle-exclamation',
                                        label: 'Registrar perda',
                                        tone: 'danger',
                                        disabled: lossSaving,
                                        onClick: (row, event) => submitLoss(event, row),
                                    },
                                ]}
                            />
                        </section>
                    ) : null}

                    {!products.length ? (
                        <div className="se-empty-state">
                            <div className="se-empty-icon"><i className="fa-solid fa-box-open" /></div>
                            <strong>Nenhum produto cadastrado</strong>
                            <p>Cadastre produtos primeiro.</p>
                            <Link className="ui-button" href="/produtos">Cadastrar produto</Link>
                        </div>
                    ) : (
                        <section className="ui-list-page-table-card">
                            <DataTable
                                columns={[
                                    {
                                        key: 'name',
                                        label: 'Produto',
                                        render: (product) => (
                                            <div className="se-product-cell">
                                                <div className={`se-product-dot se-product-dot--${product._state}`} />
                                                <div>
                                                    <strong>{product.name}</strong>
                                                    {product.code || product.barcode ? (
                                                        <small>{product.code || product.barcode}</small>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'stock_quantity',
                                        label: 'Em estoque',
                                        render: (product) => (
                                            <StatusBadge
                                                compact
                                                tone={stockStateTone(product._state)}
                                                label={`${formatNumber(product.stock_quantity || 0)} ${product.unit || 'UN'}`}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'min_stock',
                                        label: 'Mínimo',
                                        render: (product) => `${formatNumber(product.min_stock || 0)} ${product.unit || 'UN'}`,
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (product) => <StatusBadge compact tone={stockStateTone(product._state)} label={stockStateLabel(product._state)} />,
                                    },
                                ]}
                                rows={productRows}
                                rowKey="id"
                                selectedRowKey={selectedProduct?.id ?? null}
                                onRowClick={(product) => (selectedProduct?.id === product.id ? closePanel() : openProduct(product))}
                                emptyMessage="Nenhum produto encontrado. Tente outro nome ou código."
                                emptyIcon="fa-magnifying-glass"
                            />
                        </section>
                    )}
                </div>
            </div>

            <ActionDrawer
                open={Boolean(selectedProduct)}
                title={selectedProduct?.name}
                description={selectedProduct ? `${formatNumber(selectedProduct.stock_quantity || 0)} ${selectedProduct.unit || 'UN'} em estoque` : null}
                icon="fa-warehouse"
                size="lg"
                onClose={closePanel}
            >
                {selectedProduct ? (
                    <>
                        {!adjusting && !registeringLoss ? (
                            <div className="se-quick-actions">
                                <ActionButton icon="fa-scale-balanced" tone="secondary" onClick={startAdjust}>
                                    Ajustar
                                </ActionButton>
                                <ActionButton icon="fa-triangle-exclamation" tone="secondary" onClick={startLoss}>
                                    Registrar perda
                                </ActionButton>
                            </div>
                        ) : null}

                        {adjustFeedback && !adjusting ? (
                            <div className={`se-feedback se-feedback--${adjustFeedback.type}`}>
                                <i className={`fa-solid ${adjustFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                {adjustFeedback.text}
                            </div>
                        ) : null}

                        {/* Ajuste de estoque inline */}
                        {adjusting ? (
                            <form className="se-mov-adjust-form" onSubmit={submitAdjust}>
                                <div className="se-form-section">
                                    <label className="se-form-label">Novo estoque (total real) *</label>
                                    <input
                                        className="ui-input"
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={adjustQty}
                                        onChange={(e) => setAdjustQty(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder={`Quantidade em ${selectedProduct.unit || 'UN'}`}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="se-form-section">
                                    <label className="se-form-label">Motivo do ajuste</label>
                                    <input
                                        className="ui-input"
                                        value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}
                                        placeholder="Ex: Inventário, quebra, furto..."
                                    />
                                </div>

                                {adjustQty !== '' ? (
                                    (() => {
                                        const delta = Number(adjustQty) - Number(selectedProduct.stock_quantity || 0)
                                        return (
                                            <div className={`se-adjust-preview ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}`}>
                                                <i className={`fa-solid ${delta > 0 ? 'fa-arrow-trend-up' : delta < 0 ? 'fa-arrow-trend-down' : 'fa-equals'}`} />
                                                {delta === 0
                                                    ? 'Sem alteração no estoque'
                                                    : `Diferença: ${delta > 0 ? '+' : ''}${formatNumber(delta)} ${selectedProduct.unit || 'UN'}`
                                                }
                                            </div>
                                        )
                                    })()
                                ) : null}

                                <div className="se-form-section">
                                    <label className="se-form-label">Observação (opcional)</label>
                                    <textarea
                                        className="ui-textarea"
                                        rows="2"
                                        value={adjustNotes}
                                        onChange={(e) => setAdjustNotes(e.target.value)}
                                    />
                                </div>

                                {adjustFeedback ? (
                                    <div className={`se-feedback se-feedback--${adjustFeedback.type}`}>
                                        <i className={`fa-solid ${adjustFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                        {adjustFeedback.text}
                                    </div>
                                ) : null}

                                <div className="se-form-actions">
                                    <ActionButton icon="fa-rotate-left" tone="secondary" type="button" onClick={cancelAdjust}>
                                        Cancelar
                                    </ActionButton>
                                    <ActionButton icon="fa-check" type="submit" disabled={adjustSaving}>
                                        {adjustSaving ? 'Salvando...' : 'Confirmar ajuste'}
                                    </ActionButton>
                                </div>
                            </form>
                        ) : null}

                        {/* Registrar perda inline */}
                        {registeringLoss ? (
                            <form className="se-mov-adjust-form" onSubmit={(event) => submitLoss(event, null)}>
                                <div className="se-form-section">
                                    <label className="se-form-label">Quantidade perdida *</label>
                                    <input
                                        className="ui-input"
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        value={lossQty}
                                        onChange={(e) => setLossQty(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder={`Quantidade em ${selectedProduct.unit || 'UN'}`}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="se-form-section">
                                    <label className="se-form-label">Motivo</label>
                                    <select className="ui-select" value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
                                        <option value="vencido">Vencido</option>
                                        <option value="avaria">Avaria</option>
                                        <option value="quebra">Quebra</option>
                                        <option value="outro">Outro</option>
                                    </select>
                                </div>

                                {lossFeedback ? (
                                    <div className={`se-feedback se-feedback--${lossFeedback.type}`}>
                                        <i className={`fa-solid ${lossFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                        {lossFeedback.text}
                                    </div>
                                ) : null}

                                <div className="se-form-actions">
                                    <ActionButton icon="fa-rotate-left" tone="secondary" type="button" onClick={cancelLoss}>
                                        Cancelar
                                    </ActionButton>
                                    <ActionButton icon="fa-check" type="submit" disabled={lossSaving}>
                                        {lossSaving ? 'Salvando...' : 'Confirmar perda'}
                                    </ActionButton>
                                </div>
                            </form>
                        ) : null}

                        {/* Filtros */}
                        <div className="se-mov-filters">
                            <select
                                className="ui-select se-mov-filter-select"
                                value={movFilter}
                                onChange={(e) => setMovFilter(e.target.value)}
                            >
                                <option value="">Todas as operações</option>
                                <option value="manual_inbound">Entradas</option>
                                <option value="manual_adjustment">Ajustes</option>
                                <option value="sale">Saídas (venda)</option>
                                <option value="sale_cancellation">Cancelamentos</option>
                                <option value="loss">Perdas</option>
                            </select>
                            <input
                                type="date"
                                className="ui-input se-mov-filter-date"
                                value={movFrom}
                                onChange={(e) => setMovFrom(e.target.value)}
                                title="De"
                            />
                            <input
                                type="date"
                                className="ui-input se-mov-filter-date"
                                value={movTo}
                                onChange={(e) => setMovTo(e.target.value)}
                                title="Até"
                            />
                            <ActionButton icon="fa-magnifying-glass" iconOnly tone="secondary" onClick={applyMovFilter} />
                        </div>

                        {/* Lista de movimentações */}
                        <div className="se-mov-list">
                            {!movSearched ? (
                                <div className="se-mov-empty">
                                    <i className="fa-solid fa-magnifying-glass" />
                                    <span>Filtre e pesquise para ver as movimentações</span>
                                </div>
                            ) : movLoading ? (
                                <div className="se-mov-loading">
                                    <i className="fa-solid fa-spinner fa-spin" />
                                    Carregando...
                                </div>
                            ) : movements.length ? movements.map((mov) => {
                                const tone = TYPE_TONES[mov.type] || 'gray'
                                const isPositive = Number(mov.quantity_delta) >= 0
                                return (
                                    <div key={mov.id} className="se-mov-row">
                                        <div className={`se-mov-type-dot se-mov-type-dot--${tone}`} />
                                        <div className="se-mov-info">
                                            <strong>{TYPE_LABELS[mov.type] || mov.type_label || mov.type}</strong>
                                            {mov.notes ? <small>{mov.notes}</small> : null}
                                            <small className="se-mov-date">{mov.occurred_at ? formatDateTime(mov.occurred_at) : '—'}</small>
                                        </div>
                                        <div className="se-mov-delta-col">
                                            <span className={`se-mov-delta ${isPositive ? 'positive' : 'negative'}`}>
                                                {isPositive ? '+' : ''}{formatNumber(mov.quantity_delta)}
                                            </span>
                                            <small className="se-mov-stock-after">
                                                → {formatNumber(mov.stock_after)}
                                            </small>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div className="se-mov-empty">
                                    <i className="fa-solid fa-clock-rotate-left" />
                                    <span>Nenhuma movimentação encontrada</span>
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </ActionDrawer>
        </AppLayout>
    )
}

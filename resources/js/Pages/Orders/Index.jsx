import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import ProductSearchPanel from '@/Components/Pos/ProductSearchPanel'
import CartPanel from '@/Components/Pos/CartPanel'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatDateTime, formatMoney } from '@/lib/format'
import './orders.css'

function buildDraftPayload(draft) {
    return {
        type: draft.type,
        reference: draft.reference || null,
        customer_id: draft.customerId || null,
        notes: draft.notes || null,
        items: draft.items.map((item) => ({
            id: item.id,
            qty: Number(item.qty),
        })),
    }
}

function mapOrderToDraft(order) {
    return {
        id: order.id,
        type: order.type,
        reference: order.reference || '',
        status: order.status,
        label: order.label,
        customerId: order.customer?.id ? String(order.customer.id) : '',
        notes: order.notes || '',
        subtotal: Number(order.subtotal || 0),
        total: Number(order.total || 0),
        updatedAt: order.updated_at || null,
        items: (order.items || []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            barcode: item.barcode,
            unit: item.unit,
            qty: Number(item.qty),
            cost_price: Number(item.cost_price || 0),
            sale_price: Number(item.sale_price || 0),
            stock_quantity: Number(item.stock_quantity || 0),
            lineTotal: Number(item.lineTotal || Number(item.sale_price || 0) * Number(item.qty || 0)),
        })),
    }
}

function sortDrafts(drafts) {
    return [...drafts].sort((left, right) => {
        if (left.status !== right.status) {
            return left.status === 'draft' ? -1 : 1
        }

        return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    })
}

export default function OrdersIndex({ categories, customers, drafts: initialDrafts, initialDraft }) {
    const [drafts, setDrafts] = useState(sortDrafts(initialDrafts))
    const [currentDraft, setCurrentDraft] = useState(initialDraft ? mapOrderToDraft(initialDraft) : null)
    const [selectedItemId, setSelectedItemId] = useState(initialDraft?.items?.[0]?.id ?? null)
    const [selectedCategory, setSelectedCategory] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [loadingDraft, setLoadingDraft] = useState(false)
    const [creatingDraft, setCreatingDraft] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [sendingDraft, setSendingDraft] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const saveTimeoutRef = useRef(null)
    const lastSavedSignatureRef = useRef(initialDraft ? JSON.stringify(buildDraftPayload(mapOrderToDraft(initialDraft))) : null)

    useEffect(() => {
        const trimmedSearchTerm = searchTerm.trim()
        let ignore = false

        if (trimmedSearchTerm === '') {
            setProducts([])
            setLoadingProducts(false)
            return () => {
                ignore = true
            }
        }

        const timeout = setTimeout(() => {
            startTransition(async () => {
                if (ignore) {
                    return
                }

                setLoadingProducts(true)

                try {
                    const response = await apiRequest('/api/pdv/products', {
                        params: { term: trimmedSearchTerm, category_id: selectedCategory || undefined },
                    })

                    if (!ignore) {
                        setProducts(response.products)
                    }
                } catch (error) {
                    if (!ignore) {
                        setFeedback({ type: 'error', text: error.message })
                    }
                } finally {
                    if (!ignore) {
                        setLoadingProducts(false)
                    }
                }
            })
        }, 250)

        return () => {
            ignore = true
            clearTimeout(timeout)
        }
    }, [searchTerm, selectedCategory])

    useEffect(() => {
        if (!currentDraft?.items?.length) {
            setSelectedItemId(null)
            return
        }

        if (!currentDraft.items.some((item) => item.id === selectedItemId)) {
            setSelectedItemId(currentDraft.items[0].id)
        }
    }, [currentDraft, selectedItemId])

    useEffect(() => () => {
        clearTimeout(saveTimeoutRef.current)
    }, [])

    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer.id) === currentDraft?.customerId) ?? null,
        [customers, currentDraft],
    )

    function showFeedback(type, text) {
        setFeedback({ type, text })
    }

    function updateDraftUrl(draftId) {
        const nextUrl = draftId ? `/pedidos?draft=${draftId}` : '/pedidos'
        window.history.replaceState({}, '', nextUrl)
    }

    function syncDraftSummary(order) {
        const nextSummary = {
            id: order.id,
            type: order.type,
            reference: order.reference,
            label: order.label,
            status: order.status,
            subtotal: Number(order.subtotal || 0),
            total: Number(order.total || 0),
            items_count: order.items?.length ?? order.items_count ?? 0,
            customer: order.customer,
            created_by: order.created_by,
            sent_to_cashier_at: order.sent_to_cashier_at,
            updated_at: order.updated_at || new Date().toISOString(),
        }

        setDrafts((current) => {
            const hasDraft = current.some((draft) => Number(draft.id) === Number(order.id))
            const nextDrafts = hasDraft
                ? current.map((draft) => (Number(draft.id) === Number(order.id) ? nextSummary : draft))
                : [nextSummary, ...current]

            return sortDrafts(nextDrafts)
        })
    }

    function hydrateDraft(order) {
        const mappedDraft = mapOrderToDraft(order)
        clearTimeout(saveTimeoutRef.current)
        lastSavedSignatureRef.current = JSON.stringify(buildDraftPayload(mappedDraft))
        setCurrentDraft(mappedDraft)
        setSelectedItemId(mappedDraft.items[0]?.id ?? null)
        updateDraftUrl(mappedDraft.id)
        syncDraftSummary(order)
        setFeedback(null)
    }

    async function saveDraftNow(nextDraft) {
        if (!nextDraft?.id) {
            return
        }

        const payload = buildDraftPayload(nextDraft)
        const payloadSignature = JSON.stringify(payload)

        if (payloadSignature === lastSavedSignatureRef.current) {
            return
        }

        clearTimeout(saveTimeoutRef.current)
        setSavingDraft(true)

        try {
            const response = await apiRequest(`/api/orders/${nextDraft.id}`, {
                method: 'put',
                data: payload,
            })

            lastSavedSignatureRef.current = payloadSignature
            setCurrentDraft((current) => (
                current && Number(current.id) === Number(response.order.id)
                    ? {
                        ...current,
                        status: response.order.status,
                        label: response.order.label,
                        subtotal: Number(response.order.subtotal || 0),
                        total: Number(response.order.total || 0),
                        updatedAt: response.order.updated_at || null,
                    }
                    : current
            ))
            syncDraftSummary(response.order)
        } catch (error) {
            showFeedback('error', error.message)
            throw error
        } finally {
            setSavingDraft(false)
        }
    }

    function scheduleDraftSave(nextDraft) {
        if (!nextDraft?.id) {
            return
        }

        const payload = buildDraftPayload(nextDraft)
        const payloadSignature = JSON.stringify(payload)

        if (payloadSignature === lastSavedSignatureRef.current) {
            return
        }

        clearTimeout(saveTimeoutRef.current)
        setSavingDraft(true)

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await apiRequest(`/api/orders/${nextDraft.id}`, {
                    method: 'put',
                    data: payload,
                })

                lastSavedSignatureRef.current = payloadSignature
                setCurrentDraft((current) => (
                    current && Number(current.id) === Number(response.order.id)
                        ? {
                            ...current,
                            status: response.order.status,
                            label: response.order.label,
                            subtotal: Number(response.order.subtotal || 0),
                            total: Number(response.order.total || 0),
                            updatedAt: response.order.updated_at || null,
                        }
                        : current
                ))
                syncDraftSummary(response.order)
            } catch (error) {
                showFeedback('error', error.message)
            } finally {
                setSavingDraft(false)
            }
        }, 500)
    }

    async function handleCreateDraft() {
        setCreatingDraft(true)

        try {
            if (currentDraft) {
                await saveDraftNow(currentDraft)
            }

            const response = await apiRequest('/api/orders', { method: 'post' })
            hydrateDraft(response.order)
            showFeedback('success', response.message)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setCreatingDraft(false)
        }
    }

    async function handleSelectDraft(draftId) {
        if (!draftId || Number(currentDraft?.id) === Number(draftId)) {
            return
        }

        setLoadingDraft(true)

        try {
            if (currentDraft) {
                await saveDraftNow(currentDraft)
            }

            const response = await apiRequest(`/api/orders/${draftId}`)
            hydrateDraft(response.order)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setLoadingDraft(false)
        }
    }

    function updateDraft(updater) {
        setCurrentDraft((current) => {
            if (!current) {
                return current
            }

            const nextDraft = updater(current)
            scheduleDraftSave(nextDraft)
            return nextDraft
        })
    }

    function handleAddProduct(product) {
        if (!currentDraft) {
            showFeedback('error', 'Crie uma comanda ou mesa antes de adicionar produtos.')
            return
        }

        setFeedback(null)
        updateDraft((current) => {
            const existing = current.items.find((item) => item.id === product.id)

            const nextItems = existing
                ? current.items.map((item) =>
                    item.id === product.id
                        ? {
                            ...item,
                            qty: Number(item.qty) + 1,
                            stock_quantity: Number(product.stock_quantity || item.stock_quantity || 0),
                            sale_price: Number(product.sale_price || item.sale_price || 0),
                            lineTotal: Number(product.sale_price || item.sale_price || 0) * (Number(item.qty) + 1),
                        }
                        : item,
                )
                : [
                    ...current.items,
                    {
                        ...product,
                        qty: 1,
                        lineTotal: Number(product.sale_price || 0),
                    },
                ]

            return {
                ...current,
                items: nextItems,
                subtotal: nextItems.reduce((accumulator, item) => accumulator + Number(item.sale_price) * Number(item.qty), 0),
                total: nextItems.reduce((accumulator, item) => accumulator + Number(item.sale_price) * Number(item.qty), 0),
            }
        })
    }

    function handleQuantityChange(productId, value) {
        updateDraft((current) => {
            const quantity = Math.max(0.001, Number(value || 0.001))
            const nextItems = current.items.map((item) => (
                item.id === productId
                    ? {
                        ...item,
                        qty: quantity,
                        lineTotal: Number(item.sale_price) * quantity,
                    }
                    : item
            ))

            return {
                ...current,
                items: nextItems,
                subtotal: nextItems.reduce((accumulator, item) => accumulator + Number(item.sale_price) * Number(item.qty), 0),
                total: nextItems.reduce((accumulator, item) => accumulator + Number(item.sale_price) * Number(item.qty), 0),
            }
        })
    }

    function handleRemove(productId) {
        updateDraft((current) => {
            const nextItems = current.items.filter((item) => item.id !== productId)

            return {
                ...current,
                items: nextItems,
                subtotal: nextItems.reduce((accumulator, item) => accumulator + Number(item.sale_price) * Number(item.qty), 0),
                total: nextItems.reduce((accumulator, item) => accumulator + Number(item.sale_price) * Number(item.qty), 0),
            }
        })
    }

    async function handleSendToCashier() {
        if (!currentDraft) {
            return
        }

        setSendingDraft(true)

        try {
            await saveDraftNow(currentDraft)
            await apiRequest(`/api/orders/${currentDraft.id}/send-to-cashier`, {
                method: 'post',
            })

            router.get('/pdv', { orderDraft: currentDraft.id })
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSendingDraft(false)
        }
    }

    return (
        <AppLayout title="Pedidos">
            <div className="orders-page">
                <section className="orders-hero ui-card">
                    <div className="ui-card-body">
                        <div className="orders-hero-grid">
                            <div>
                                <span>Comandas e mesas</span>
                                <h1>Pedidos persistidos para nao perder nada</h1>
                                <p>Monte comandas, mesas e pedidos, salve automaticamente em rascunho e envie para o caixa no momento da cobranca.</p>
                            </div>

                            <div className="orders-hero-actions">
                                <div>
                                    <small>Pedidos ativos</small>
                                    <strong>{drafts.length}</strong>
                                </div>
                                <button type="button" className="ui-button" onClick={handleCreateDraft} disabled={creatingDraft}>
                                    <i className="fa-solid fa-plus" />
                                    {creatingDraft ? 'Criando...' : 'Nova comanda'}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {feedback ? <div className={`orders-feedback ${feedback.type}`}>{feedback.text}</div> : null}

                <div className="orders-layout">
                    <aside className="orders-sidebar">
                        <section className="orders-card">
                            <div className="orders-card-header">
                                <div>
                                    <h2>Pedidos em andamento</h2>

                                </div>
                            </div>

                            <div className="orders-draft-list">
                                {drafts.length ? (
                                    drafts.map((draft) => {
                                        const isActive = Number(currentDraft?.id) === Number(draft.id)

                                        return (
                                            <button
                                                key={draft.id}
                                                type="button"
                                                className={`orders-draft-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleSelectDraft(draft.id)}
                                                disabled={loadingDraft}
                                            >
                                                <div>
                                                    <span className={`ui-badge ${draft.status === 'sent_to_cashier' ? 'info' : 'warning'}`}>
                                                        {draft.status === 'sent_to_cashier' ? 'No caixa' : 'Rascunho'}
                                                    </span>
                                                    <strong>{draft.label}</strong>
                                                    <small>
                                                        {draft.items_count} item(ns) • {formatMoney(draft.total)}
                                                    </small>
                                                    <small>
                                                        {draft.customer?.name ? `${draft.customer.name} • ` : ''}
                                                        {draft.updated_at ? formatDateTime(draft.updated_at) : 'Sem atualizacao'}
                                                    </small>
                                                </div>
                                                <i className="fa-solid fa-angle-right" />
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="orders-empty-state">Nenhum pedido aberto ainda. Crie a primeira comanda para comecar.</div>
                                )}
                            </div>
                        </section>
                    </aside>

                    <div className="orders-main">
                        {currentDraft ? (
                            <>
                                <section className="orders-card">
                                    <div className="orders-card-header">
                                        <div>
                                            <h2>{currentDraft.label}</h2>
                                            <p>
                                                {savingDraft
                                                    ? 'Salvando alteracoes automaticamente...'
                                                    : currentDraft.updatedAt
                                                        ? `Ultima atualizacao em ${formatDateTime(currentDraft.updatedAt)}`
                                                        : 'Rascunho pronto para receber itens.'}
                                            </p>
                                        </div>

                                        <div className="orders-card-actions">
                                            <span className={`ui-badge ${currentDraft.status === 'sent_to_cashier' ? 'info' : 'warning'}`}>
                                                {currentDraft.status === 'sent_to_cashier' ? 'Ja enviado ao caixa' : 'Edicao em andamento'}
                                            </span>
                                            <button
                                                type="button"
                                                className="ui-button"
                                                onClick={handleSendToCashier}
                                                disabled={sendingDraft || !currentDraft.items.length}
                                            >
                                                <i className="fa-solid fa-cash-register" />
                                                {sendingDraft
                                                    ? 'Abrindo no caixa...'
                                                    : currentDraft.status === 'sent_to_cashier'
                                                        ? 'Atualizar e abrir no caixa'
                                                        : 'Enviar para o caixa'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="orders-details-grid">
                                        <label>
                                            Tipo
                                            <select
                                                className="ui-select"
                                                value={currentDraft.type}
                                                onChange={(event) => updateDraft((current) => ({ ...current, type: event.target.value }))}
                                            >
                                                <option value="comanda">Comanda</option>
                                                <option value="mesa">Mesa</option>
                                                <option value="pedido">Pedido</option>
                                            </select>
                                        </label>

                                        <label>
                                            Numero ou referencia
                                            <input
                                                className="ui-input"
                                                value={currentDraft.reference}
                                                placeholder="Ex.: 12, varanda, retirada"
                                                onChange={(event) => updateDraft((current) => ({ ...current, reference: event.target.value }))}
                                            />
                                        </label>

                                        <label>
                                            Cliente
                                            <select
                                                className="ui-select"
                                                value={currentDraft.customerId}
                                                onChange={(event) => updateDraft((current) => ({ ...current, customerId: event.target.value }))}
                                            >
                                                <option value="">Nao identificado</option>
                                                {customers.map((customer) => (
                                                    <option key={customer.id} value={customer.id}>
                                                        {customer.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <div className="orders-total-box">
                                            <span>Total atual</span>
                                            <strong>{formatMoney(currentDraft.total)}</strong>
                                            <small>{currentDraft.items.length} item(ns) salvos no rascunho</small>
                                        </div>
                                    </div>

                                    <label className="orders-notes-field">
                                        Observacoes do pedido
                                        <textarea
                                            className="ui-input"
                                            rows="3"
                                            value={currentDraft.notes}
                                            placeholder="Informacoes para preparo, entrega ou cobranca"
                                            onChange={(event) => updateDraft((current) => ({ ...current, notes: event.target.value }))}
                                        />
                                    </label>

                                    {selectedCustomer ? (
                                        <div className="orders-customer-chip">
                                            <strong>{selectedCustomer.name}</strong>
                                            <small>{selectedCustomer.phone || 'Sem telefone informado'}</small>
                                        </div>
                                    ) : null}
                                </section>

                                <ProductSearchPanel
                                    categories={categories}
                                    selectedCategory={selectedCategory}
                                    onCategoryChange={setSelectedCategory}
                                    searchTerm={searchTerm}
                                    onSearchChange={setSearchTerm}
                                    searchInputRef={null}
                                    hasSearchTerm={searchTerm.trim() !== ''}
                                    products={products}
                                    loading={loadingProducts}
                                    onAddProduct={handleAddProduct}
                                />

                                <CartPanel
                                    cart={currentDraft.items.map((item) => ({
                                        ...item,
                                        lineSubtotal: Number(item.sale_price) * Number(item.qty),
                                        lineDiscount: 0,
                                        lineTotal: Number(item.sale_price) * Number(item.qty),
                                    }))}
                                    selectedItemId={selectedItemId}
                                    onSelectItem={setSelectedItemId}
                                    onQuantityChange={handleQuantityChange}
                                    onRemove={handleRemove}
                                />
                            </>
                        ) : (
                            <section className="orders-card orders-empty-card">
                                <strong>Nenhum pedido selecionado</strong>
                                <p>Crie uma nova comanda para começar a lançar produtos e salvar o rascunho automaticamente.</p>
                                <button type="button" className="ui-button" onClick={handleCreateDraft} disabled={creatingDraft}>
                                    <i className="fa-solid fa-plus" />
                                    {creatingDraft ? 'Criando...' : 'Criar primeira comanda'}
                                </button>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}

import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import './fashion.css'

function EmptyState({ title, text }) {
    return (
        <section className="fashion-empty-state">
            <strong>{title}</strong>
            <p>{text}</p>
        </section>
    )
}

function Feedback({ feedback }) {
    useErrorFeedbackPopup(feedback)

    if (!feedback) {
        return null
    }

    return <div className={`fashion-feedback ${feedback.type}`}>{feedback.text}</div>
}

function SectionTabs({ tabs, activeTab, onChange }) {
    return (
        <section className="ui-tabs fashion-tabs">
            {tabs.map((tab) => (
                <button key={tab.key} type="button" className={`ui-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => onChange(tab.key)}>
                    <i className={`fa-solid ${tab.icon}`} />
                    <span>{tab.label}</span>
                </button>
            ))}
        </section>
    )
}

function PromotionStatusBadge({ promotion }) {
    const now = Date.now()
    const start = promotion.start_at ? new Date(promotion.start_at).getTime() : null
    const end = promotion.end_at ? new Date(promotion.end_at).getTime() : null

    if (!promotion.active) return <span className="ui-badge muted">Inativa</span>
    if (start && start > now) return <span className="ui-badge warning">Agendada</span>
    if (end && end < now) return <span className="ui-badge danger">Encerrada</span>
    return <span className="ui-badge success">Ativa</span>
}

function promotionMatchesTab(promotion, activeTab) {
    const now = Date.now()
    const start = promotion.start_at ? new Date(promotion.start_at).getTime() : null
    const end = promotion.end_at ? new Date(promotion.end_at).getTime() : null

    if (activeTab === 'scheduled') return promotion.active && Boolean(start && start > now)
    if (activeTab === 'ended') return !promotion.active || Boolean(end && end < now)
    return promotion.active && (!start || start <= now) && (!end || end >= now)
}

function getPromotionDiscountLabel(promotion) {
    if (promotion.type === 'percent') return `${formatNumber(promotion.discount_value)}%`
    if (promotion.type === 'price_override') return `Preco final ${formatMoney(promotion.discount_value)}`
    return formatMoney(promotion.discount_value)
}

function getPromotionScopeLabel(promotion) {
    if (promotion.scope === 'product') return promotion.product_name || 'Produto vinculado'
    if (promotion.scope === 'category') return promotion.category_name || 'Categoria vinculada'
    if (promotion.scope === 'collection') return promotion.collection || 'Colecao vinculada'
    return 'Catalogo inteiro'
}

function getProductOptionLabel(product) {
    const grade = [product.color, product.size].filter(Boolean).join(' / ')
    const details = [product.collection, grade, product.code].filter(Boolean).join(' | ')

    return details ? `${product.name} - ${details}` : product.name
}

function PromotionsWorkspace({ payload }) {
    const emptyForm = {
        id: null,
        name: '',
        description: '',
        type: 'percent',
        scope: 'all',
        product_id: '',
        category_id: '',
        collection: '',
        discount_value: '',
        highlight_text: '',
        start_at: '',
        end_at: '',
        active: true,
    }
    const [promotions, setPromotions] = useState(payload.promotions)
    const [activeTab, setActiveTab] = useState('active')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredPromotions = useMemo(() => promotions.filter((promotion) => promotionMatchesTab(promotion, activeTab)), [promotions, activeTab])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)

        try {
            const payloadData = {
                ...form,
                product_id: form.scope === 'product' && form.product_id ? Number(form.product_id) : null,
                category_id: form.scope === 'category' && form.category_id ? Number(form.category_id) : null,
                collection: form.scope === 'collection' ? form.collection || null : null,
                discount_value: Number(form.discount_value || 0),
                active: Boolean(form.active),
                start_at: form.start_at || null,
                end_at: form.end_at || null,
            }
            const response = form.id
                ? await apiRequest(`/api/fashion/promotions/${form.id}`, { method: 'put', data: payloadData })
                : await apiRequest('/api/fashion/promotions', { method: 'post', data: payloadData })

            setPromotions((current) => {
                const exists = current.some((promotion) => promotion.id === response.promotion.id)
                return exists ? current.map((promotion) => (promotion.id === response.promotion.id ? response.promotion : promotion)) : [response.promotion, ...current]
            })
            setForm({ ...emptyForm, ...response.promotion })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a promocao "${form.name}"?`)) return

        try {
            const response = await apiRequest(`/api/fashion/promotions/${form.id}`, { method: 'delete' })
            setPromotions((current) => current.filter((promotion) => promotion.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="fashion-module-stack">
            <SectionTabs tabs={[{ key: 'active', label: 'Ativas', icon: 'fa-tags' }, { key: 'scheduled', label: 'Agendadas', icon: 'fa-calendar-days' }, { key: 'ended', label: 'Encerradas', icon: 'fa-clock-rotate-left' }]} activeTab={activeTab} onChange={setActiveTab} />
            <section className="fashion-metric-grid">
                <article><span>Promocoes</span><strong>{formatNumber(promotions.length)}</strong><small>Total cadastrado</small></article>
                <article><span>Ativas</span><strong>{formatNumber(promotions.filter((promotion) => promotionMatchesTab(promotion, 'active')).length)}</strong><small>Em vigencia</small></article>
                <article><span>Colecoes</span><strong>{formatNumber(payload.collections.length)}</strong><small>Com alvo disponivel</small></article>
            </section>
            <div className="fashion-grid two-columns">
                <section className="fashion-panel-card">
                    <header><h2>Campanhas</h2><span>{formatNumber(filteredPromotions.length)} registro(s)</span></header>
                    <Feedback feedback={feedback} />
                    <div className="fashion-list-stack">
                        {filteredPromotions.length ? filteredPromotions.map((promotion) => (
                            <button key={promotion.id} type="button" className={`fashion-list-card ${form.id === promotion.id ? 'active' : ''}`} onClick={() => setForm({ ...emptyForm, ...promotion })}>
                                <div className="fashion-list-card-top"><strong>{promotion.name}</strong><PromotionStatusBadge promotion={promotion} /></div>
                                <p>{promotion.description || 'Sem descricao.'}</p>
                                <div className="fashion-list-card-meta"><span>{getPromotionDiscountLabel(promotion)}</span><span>{getPromotionScopeLabel(promotion)}</span></div>
                            </button>
                        )) : <EmptyState title="Sem promocoes nesse recorte" text="Cadastre campanhas comerciais para acompanhar desconto, colecao e vigencia." />}
                    </div>
                </section>
                <section className="fashion-panel-card">
                    <header><h2>{form.id ? 'Editar promocao' : 'Nova promocao'}</h2><span>Salvo no banco</span></header>
                    <form className="fashion-form-grid" onSubmit={handleSubmit}>
                        <label><span>Nome</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                        <label><span>Tipo</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="percent">Percentual</option><option value="fixed">Valor fixo</option><option value="price_override">Preco final</option></select></label>
                        <label className="span-2"><span>Descricao</span><textarea rows="3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
                        <label><span>Escopo</span><select value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value, product_id: '', category_id: '', collection: '' }))}><option value="all">Catalogo inteiro</option><option value="product">Produto</option><option value="category">Categoria</option><option value="collection">Colecao</option></select></label>
                        <label><span>Desconto</span><input type="number" step="0.01" value={form.discount_value} onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))} required /></label>
                        {form.scope === 'product' ? <label className="span-2"><span>Produto alvo</span><select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}><option value="">Selecione</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select></label> : null}
                        {form.scope === 'category' ? <label className="span-2"><span>Categoria alvo</span><select value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}><option value="">Selecione</option>{payload.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
                        {form.scope === 'collection' ? <label className="span-2"><span>Colecao alvo</span><select value={form.collection} onChange={(event) => setForm((current) => ({ ...current, collection: event.target.value }))}><option value="">Selecione</option>{payload.collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label> : null}
                        <label><span>Inicio</span><input type="datetime-local" value={form.start_at} onChange={(event) => setForm((current) => ({ ...current, start_at: event.target.value }))} /></label>
                        <label><span>Fim</span><input type="datetime-local" value={form.end_at} onChange={(event) => setForm((current) => ({ ...current, end_at: event.target.value }))} /></label>
                        <label className="span-2"><span>Chamada comercial</span><input value={form.highlight_text} onChange={(event) => setForm((current) => ({ ...current, highlight_text: event.target.value }))} placeholder="Ex.: Semana do jeans" /></label>
                        <label className="fashion-inline-toggle span-2"><input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Promocao ativa</span></label>
                        <div className="fashion-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar promocao' : 'Salvar promocao'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}
function ReturnsWorkspace({ payload }) {
    const emptyForm = {
        id: null,
        customer_id: '',
        sale_id: '',
        product_id: '',
        product_name: '',
        product_code: '',
        type: 'troca',
        status: 'aberto',
        size: '',
        color: '',
        reason: '',
        resolution: '',
        refund_amount: '',
        store_credit_amount: '',
        notes: '',
        processed_at: '',
    }
    const [records, setRecords] = useState(payload.records)
    const [activeTab, setActiveTab] = useState('aberto')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])

    function handleProductChange(productId) {
        const selectedProduct = payload.products.find((product) => String(product.id) === String(productId))
        setForm((current) => ({
            ...current,
            product_id: productId,
            product_name: selectedProduct?.name || current.product_name,
            product_code: selectedProduct?.code || current.product_code,
            size: selectedProduct?.size || current.size,
            color: selectedProduct?.color || current.color,
        }))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)

        try {
            const payloadData = {
                ...form,
                customer_id: form.customer_id ? Number(form.customer_id) : null,
                sale_id: form.sale_id ? Number(form.sale_id) : null,
                product_id: form.product_id ? Number(form.product_id) : null,
                refund_amount: Number(form.refund_amount || 0),
                store_credit_amount: Number(form.store_credit_amount || 0),
                processed_at: form.processed_at || null,
            }
            const response = form.id
                ? await apiRequest(`/api/fashion/returns/${form.id}`, { method: 'put', data: payloadData })
                : await apiRequest('/api/fashion/returns', { method: 'post', data: payloadData })

            setRecords((current) => {
                const exists = current.some((record) => record.id === response.record.id)
                return exists ? current.map((record) => (record.id === response.record.id ? response.record : record)) : [response.record, ...current]
            })
            setForm({ ...emptyForm, ...response.record, customer_id: response.record.customer_id || '', product_id: response.record.product_id || '', sale_id: response.record.sale_id || '' })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover o atendimento de ${form.product_name}?`)) return

        try {
            const response = await apiRequest(`/api/fashion/returns/${form.id}`, { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="fashion-module-stack">
            <SectionTabs tabs={[{ key: 'aberto', label: 'Abertos', icon: 'fa-right-left' }, { key: 'em_analise', label: 'Em analise', icon: 'fa-magnifying-glass' }, { key: 'concluido', label: 'Concluidos', icon: 'fa-badge-check' }]} activeTab={activeTab} onChange={setActiveTab} />
            <div className="fashion-grid two-columns">
                <section className="fashion-panel-card">
                    <header><h2>Atendimentos</h2><span>{formatNumber(filteredRecords.length)} registro(s)</span></header>
                    <Feedback feedback={feedback} />
                    <div className="fashion-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <button key={record.id} type="button" className={`fashion-list-card ${form.id === record.id ? 'active' : ''}`} onClick={() => setForm({ ...emptyForm, ...record, customer_id: record.customer_id || '', product_id: record.product_id || '', sale_id: record.sale_id || '' })}>
                                <div className="fashion-list-card-top"><strong>{record.product_name}</strong><span className="ui-badge warning">{record.status}</span></div>
                                <p>{record.reason}</p>
                                <div className="fashion-list-card-meta"><span>{record.customer_name || 'Cliente nao informado'}</span><span>{record.type}</span></div>
                            </button>
                        )) : <EmptyState title="Sem trocas nesse status" text="Os atendimentos cadastrados aparecem aqui em tempo real." />}
                    </div>
                </section>
                <section className="fashion-panel-card">
                    <header><h2>{form.id ? 'Editar atendimento' : 'Novo atendimento'}</h2><span>Fluxo real de loja</span></header>
                    <form className="fashion-form-grid" onSubmit={handleSubmit}>
                        <label><span>Cliente</span><select value={form.customer_id} onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}><option value="">Nao informado</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <label><span>Produto</span><select value={form.product_id} onChange={(event) => handleProductChange(event.target.value)}><option value="">Selecione</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select></label>
                        <label><span>Tipo</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="troca">Troca</option><option value="devolucao">Devolucao</option></select></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="aberto">Aberto</option><option value="em_analise">Em analise</option><option value="concluido">Concluido</option><option value="cancelado">Cancelado</option></select></label>
                        <label><span>Produto atendido</span><input value={form.product_name} onChange={(event) => setForm((current) => ({ ...current, product_name: event.target.value }))} required /></label>
                        <label><span>Codigo</span><input value={form.product_code} onChange={(event) => setForm((current) => ({ ...current, product_code: event.target.value }))} /></label>
                        <label><span>Tamanho</span><input value={form.size} onChange={(event) => setForm((current) => ({ ...current, size: event.target.value }))} /></label>
                        <label><span>Cor</span><input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} /></label>
                        <label className="span-2"><span>Motivo</span><input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required /></label>
                        <label className="span-2"><span>Resolucao</span><input value={form.resolution} onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))} placeholder="Ex.: troca por outro tamanho" /></label>
                        <label><span>Estorno</span><input type="number" step="0.01" value={form.refund_amount} onChange={(event) => setForm((current) => ({ ...current, refund_amount: event.target.value }))} /></label>
                        <label><span>Credito</span><input type="number" step="0.01" value={form.store_credit_amount} onChange={(event) => setForm((current) => ({ ...current, store_credit_amount: event.target.value }))} /></label>
                        <label><span>Processado em</span><input type="datetime-local" value={form.processed_at} onChange={(event) => setForm((current) => ({ ...current, processed_at: event.target.value }))} /></label>
                        <label><span>ID da venda</span><input value={form.sale_id} onChange={(event) => setForm((current) => ({ ...current, sale_id: event.target.value }))} /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <div className="fashion-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar atendimento' : 'Salvar atendimento'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}

function CatalogWorkspace({ payload }) {
    const [activeTab, setActiveTab] = useState('catalog')
    const [settings, setSettings] = useState(payload.settings)
    const [products, setProducts] = useState(payload.products)
    const [collectionFilter, setCollectionFilter] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [savingSettings, setSavingSettings] = useState(false)

    const filteredProducts = useMemo(() => products.filter((product) => collectionFilter === '' || product.collection === collectionFilter), [products, collectionFilter])
    const publishedCount = products.filter((product) => product.catalog_visible).length

    async function handleToggle(product) {
        try {
            const nextVisible = !product.catalog_visible
            await apiRequest(`/api/fashion/catalog/products/${product.id}`, { method: 'put', data: { catalog_visible: nextVisible } })
            setProducts((current) => current.map((item) => (item.id === product.id ? { ...item, catalog_visible: nextVisible } : item)))
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function handleSaveSettings(event) {
        event.preventDefault()
        setSavingSettings(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/api/fashion/catalog/settings', { method: 'put', data: settings })
            setSettings(response.settings)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSavingSettings(false)
        }
    }

    return (
        <div className="fashion-module-stack">
            <SectionTabs tabs={[{ key: 'catalog', label: 'Vitrine', icon: 'fa-store' }, { key: 'settings', label: 'Configuracoes', icon: 'fa-sliders' }]} activeTab={activeTab} onChange={setActiveTab} />
            <section className="fashion-metric-grid">
                <article><span>Publicados</span><strong>{formatNumber(publishedCount)}</strong><small>Itens em vitrine</small></article>
                <article><span>Total</span><strong>{formatNumber(products.length)}</strong><small>Produtos ativos</small></article>
                <article><span>Colecoes</span><strong>{formatNumber(payload.collections.length)}</strong><small>Recortes disponiveis</small></article>
            </section>
            <Feedback feedback={feedback} />
            {activeTab === 'catalog' ? (
                <section className="fashion-panel-card">
                    <header><h2>Produtos do catalogo</h2><div className="fashion-header-actions"><a href="/shop" className="ui-button-ghost" target="_blank" rel="noreferrer">Abrir /shop</a><select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}><option value="">Todas as colecoes</option>{payload.collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></div></header>
                    <div className="fashion-table-wrap">
                        <table className="ui-table">
                            <thead><tr><th>Produto</th><th>Colecao</th><th>Grade</th><th>Preco</th><th>Estoque</th><th>Catalogo</th></tr></thead>
                            <tbody>
                                {filteredProducts.map((product) => (
                                    <tr key={product.id}>
                                        <td><strong>{product.name}</strong><small>{product.category_name || 'Sem categoria'}</small></td>
                                        <td>{product.collection || '-'}</td>
                                        <td>{[product.color, product.size].filter(Boolean).join(' / ') || product.style_reference || '-'}</td>
                                        <td>{formatMoney(product.sale_price)}</td>
                                        <td>{formatNumber(product.stock_quantity)}</td>
                                        <td><button type="button" className={`fashion-chip ${product.catalog_visible ? 'active' : ''}`} onClick={() => handleToggle(product)}>{product.catalog_visible ? 'Publicado' : 'Oculto'}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : (
                <section className="fashion-panel-card">
                    <header><h2>Configuracoes da vitrine</h2><span>Salvas no tenant</span></header>
                    <form className="fashion-form-grid" onSubmit={handleSaveSettings}>
                        <label className="span-2"><span>Titulo</span><input value={settings.title} onChange={(event) => setSettings((current) => ({ ...current, title: event.target.value }))} required /></label>
                        <label className="span-2"><span>Subtitulo</span><input value={settings.subtitle || ''} onChange={(event) => setSettings((current) => ({ ...current, subtitle: event.target.value }))} /></label>
                        <label><span>Colecao em destaque</span><select value={settings.featured_collection || ''} onChange={(event) => setSettings((current) => ({ ...current, featured_collection: event.target.value }))}><option value="">Sem destaque fixo</option>{payload.collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label>
                        <label className="fashion-inline-toggle"><input type="checkbox" checked={Boolean(settings.show_prices)} onChange={(event) => setSettings((current) => ({ ...current, show_prices: event.target.checked }))} /><span>Exibir precos na vitrine</span></label>
                        <div className="fashion-actions span-2"><button type="submit" className="ui-button" disabled={savingSettings}>{savingSettings ? 'Salvando...' : 'Salvar configuracoes'}</button></div>
                    </form>
                </section>
            )}
        </div>
    )
}
function mapOrderToForm(order, channel) {
    return order ? {
        id: order.id,
        channel: order.channel,
        customer_id: order.customer?.id ? String(order.customer.id) : '',
        reference: order.reference || '',
        notes: order.notes || '',
        status: order.status,
        items: (order.items || []).map((item) => ({ product_id: String(item.product_id || item.id), qty: String(item.qty || 1) })),
    } : {
        id: null,
        channel,
        customer_id: '',
        reference: '',
        notes: '',
        status: 'draft',
        items: [],
    }
}

function OnlineOrdersWorkspace({ payload }) {
    const [activeTab, setActiveTab] = useState('site')
    const [orders, setOrders] = useState(payload.orders)
    const [form, setForm] = useState(mapOrderToForm(null, 'site'))
    const [newProductId, setNewProductId] = useState('')
    const [newQty, setNewQty] = useState('1')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredOrders = useMemo(() => orders.filter((order) => order.channel === activeTab), [orders, activeTab])
    const totalPreview = useMemo(() => form.items.reduce((total, item) => {
        const product = payload.products.find((entry) => String(entry.id) === String(item.product_id))
        return total + (Number(product?.sale_price || 0) * Number(item.qty || 0))
    }, 0), [form.items, payload.products])

    function resetForm(channel = activeTab) {
        setForm(mapOrderToForm(null, channel))
        setNewProductId('')
        setNewQty('1')
    }

    function addItem() {
        if (!newProductId) return

        setForm((current) => {
            const existing = current.items.find((item) => String(item.product_id) === String(newProductId))
            const items = existing
                ? current.items.map((item) => String(item.product_id) === String(newProductId) ? { ...item, qty: String(Number(item.qty) + Number(newQty || 1)) } : item)
                : [...current.items, { product_id: newProductId, qty: String(Number(newQty || 1)) }]
            return { ...current, items }
        })
        setNewProductId('')
        setNewQty('1')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)

        try {
            const payloadData = {
                channel: form.channel,
                customer_id: form.customer_id ? Number(form.customer_id) : null,
                reference: form.reference || null,
                notes: form.notes || null,
                items: form.items.map((item) => ({ id: Number(item.product_id), qty: Number(item.qty || 1) })),
            }
            const response = form.id
                ? await apiRequest(`/api/fashion/online-orders/${form.id}`, { method: 'put', data: payloadData })
                : await apiRequest('/api/fashion/online-orders', { method: 'post', data: payloadData })

            setOrders((current) => {
                const exists = current.some((order) => order.id === response.order.id)
                return exists ? current.map((order) => (order.id === response.order.id ? response.order : order)) : [response.order, ...current]
            })
            setForm(mapOrderToForm(response.order, response.order.channel))
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleSendToCashier() {
        if (!form.id) return

        try {
            const response = await apiRequest(`/api/fashion/online-orders/${form.id}/send-to-cashier`, { method: 'post' })
            setOrders((current) => current.map((order) => order.id === response.order.id ? response.order : order))
            setForm(mapOrderToForm(response.order, response.order.channel))
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="fashion-module-stack">
            <SectionTabs tabs={[{ key: 'site', label: 'Site', icon: 'fa-globe' }, { key: 'whatsapp', label: 'WhatsApp', icon: 'fa-comment-dots' }]} activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); resetForm(tab) }} />
            <div className="fashion-grid two-columns">
                <section className="fashion-panel-card">
                    <header><h2>Fila digital</h2><button type="button" className="ui-button-ghost" onClick={() => resetForm(activeTab)}>Novo pedido</button></header>
                    <Feedback feedback={feedback} />
                    <div className="fashion-list-stack">
                        {filteredOrders.length ? filteredOrders.map((order) => (
                            <button key={order.id} type="button" className={`fashion-list-card ${form.id === order.id ? 'active' : ''}`} onClick={() => setForm(mapOrderToForm(order, order.channel))}>
                                <div className="fashion-list-card-top"><strong>{order.label}</strong><span className={`ui-badge ${order.status === 'sent_to_cashier' ? 'info' : 'warning'}`}>{order.status === 'sent_to_cashier' ? 'No caixa' : 'Em aberto'}</span></div>
                                <p>{order.customer?.name || 'Cliente nao informado'}</p>
                                <div className="fashion-list-card-meta"><span>{formatMoney(order.total)}</span><span>{order.items?.length || 0} item(ns)</span></div>
                            </button>
                        )) : <EmptyState title="Sem pedidos no canal" text="Cadastre pedidos do site ou do WhatsApp para acompanhar a fila digital." />}
                    </div>
                </section>
                <section className="fashion-panel-card">
                    <header><h2>{form.id ? 'Editar pedido online' : 'Novo pedido online'}</h2><span>Canal {form.channel}</span></header>
                    <form className="fashion-form-grid" onSubmit={handleSubmit}>
                        <label><span>Canal</span><select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}><option value="site">Site</option><option value="whatsapp">WhatsApp</option></select></label>
                        <label><span>Cliente</span><select value={form.customer_id} onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}><option value="">Nao informado</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <label><span>Referencia</span><input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                        <label><span>Status</span><input value={form.status === 'sent_to_cashier' ? 'No caixa' : 'Em aberto'} readOnly /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <div className="fashion-inline-adder span-2">
                            <select value={newProductId} onChange={(event) => setNewProductId(event.target.value)}><option value="">Adicionar produto</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select>
                            <input type="number" min="1" step="1" value={newQty} onChange={(event) => setNewQty(event.target.value)} />
                            <button type="button" className="ui-button-ghost" onClick={addItem}>Adicionar</button>
                        </div>
                        <div className="span-2 fashion-table-wrap">
                            <table className="ui-table">
                                <thead><tr><th>Produto</th><th>Grade</th><th>Qtd</th><th>Total</th><th>Acao</th></tr></thead>
                                <tbody>
                                    {form.items.length ? form.items.map((item) => {
                                        const product = payload.products.find((entry) => String(entry.id) === String(item.product_id))
                                        return (
                                            <tr key={item.product_id}>
                                                <td>{product?.name || 'Produto'}</td>
                                                <td>{[product?.color, product?.size].filter(Boolean).join(' / ') || '-'}</td>
                                                <td><input type="number" min="1" step="1" value={item.qty} onChange={(event) => setForm((current) => ({ ...current, items: current.items.map((entry) => String(entry.product_id) === String(item.product_id) ? { ...entry, qty: event.target.value } : entry) }))} /></td>
                                                <td>{formatMoney(Number(product?.sale_price || 0) * Number(item.qty || 0))}</td>
                                                <td><button type="button" className="ui-button-ghost danger" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((entry) => String(entry.product_id) !== String(item.product_id)) }))}>Remover</button></td>
                                            </tr>
                                        )
                                    }) : <tr><td colSpan="5">Nenhum item adicionado.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div className="fashion-total-bar span-2"><span>Total previsto</span><strong>{formatMoney(totalPreview)}</strong></div>
                        <div className="fashion-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => resetForm(activeTab)}>Limpar</button>{form.id && form.status !== 'sent_to_cashier' ? <button type="button" className="ui-button-ghost" onClick={handleSendToCashier}>Enviar ao caixa</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar pedido' : 'Salvar pedido'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}
function WhatsAppWorkspace({ payload }) {
    const [activeTab, setActiveTab] = useState('settings')
    const [settings, setSettings] = useState(payload.settings)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const previewText = useMemo(
        () => (settings.checkout_template || '')
            .replaceAll('{{items}}', 'Vestido Midi Preto x1, Camisa Linho Bege x2')
            .replaceAll('{{total}}', formatMoney(389.9))
            .replaceAll('{{customer}}', 'Cliente Exemplo'),
        [settings.checkout_template],
    )

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/api/fashion/whatsapp/settings', { method: 'put', data: settings })
            setSettings(response.settings)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fashion-module-stack">
            <SectionTabs tabs={[{ key: 'settings', label: 'Configuracao', icon: 'fa-gear' }, { key: 'preview', label: 'Preview', icon: 'fa-comment' }]} activeTab={activeTab} onChange={setActiveTab} />
            <section className="fashion-metric-grid">
                <article><span>Em aberto</span><strong>{formatNumber(payload.summary.drafts)}</strong><small>Pedidos no canal</small></article>
                <article><span>No caixa</span><strong>{formatNumber(payload.summary.sent_to_cashier)}</strong><small>Fila pronta para cobrar</small></article>
                <article><span>Contato</span><strong>{settings.phone || '-'}</strong><small>Numero oficial</small></article>
            </section>
            <Feedback feedback={feedback} />
            {activeTab === 'settings' ? (
                <section className="fashion-panel-card">
                    <header><h2>Configuracoes do canal</h2><span>Salvas no tenant</span></header>
                    <form className="fashion-form-grid" onSubmit={handleSubmit}>
                        <label><span>Numero</span><input value={settings.phone || ''} onChange={(event) => setSettings((current) => ({ ...current, phone: event.target.value }))} placeholder="5511999999999" /></label>
                        <label><span>Horario</span><input value={settings.business_hours || ''} onChange={(event) => setSettings((current) => ({ ...current, business_hours: event.target.value }))} /></label>
                        <label className="span-2"><span>Saudacao</span><input value={settings.greeting || ''} onChange={(event) => setSettings((current) => ({ ...current, greeting: event.target.value }))} /></label>
                        <label className="span-2"><span>Template do checkout</span><textarea rows="6" value={settings.checkout_template || ''} onChange={(event) => setSettings((current) => ({ ...current, checkout_template: event.target.value }))} /></label>
                        <div className="fashion-actions span-2"><button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar configuracoes'}</button></div>
                    </form>
                </section>
            ) : (
                <section className="fashion-panel-card">
                    <header><h2>Preview da mensagem</h2><span>Mensagem pronta para atendimento</span></header>
                    <div className="fashion-message-preview"><strong>{settings.greeting}</strong><pre>{previewText}</pre></div>
                </section>
            )}
        </div>
    )
}

export default function FashionWorkspace({ moduleKey, moduleTitle, moduleDescription, payload }) {
    return (
        <AppLayout title={moduleTitle}>
            <div className="fashion-page">
                <section className="fashion-hero">
                    <div>
                        <span>Modo loja roupas</span>
                        <h1>{moduleTitle}</h1>
                        <p>{moduleDescription}</p>
                    </div>
                </section>
                {moduleKey === 'promotions' ? <PromotionsWorkspace payload={payload} /> : null}
                {moduleKey === 'returns' ? <ReturnsWorkspace payload={payload} /> : null}
                {moduleKey === 'catalog' ? <CatalogWorkspace payload={payload} /> : null}
                {moduleKey === 'online-orders' ? <OnlineOrdersWorkspace payload={payload} /> : null}
                {moduleKey === 'whatsapp' ? <WhatsAppWorkspace payload={payload} /> : null}
            </div>
        </AppLayout>
    )
}

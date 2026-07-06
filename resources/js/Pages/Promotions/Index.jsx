import { useEffect, useState } from 'react'
import './promotions.css'
import PageContainer from '@/Components/UI/PageContainer'
import DenseTable from '@/Components/UI/DenseTable'
import CompactModal from '@/Components/UI/CompactModal'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'

const TYPE_LABELS = {
    promo_price: 'Preço promocional',
    buy_x_pay_y: 'Leve X pague Y',
    quantity_discount: 'Desconto por quantidade',
    category_discount: 'Desconto de categoria',
}

const WEEKDAYS = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
    { value: 7, label: 'Dom' },
]

function emptyForm() {
    return {
        id: null,
        name: '',
        description: '',
        type: 'promo_price',
        scope: 'product',
        product_id: '',
        category_id: '',
        discount_value: '',
        tiers: [{ min_quantity: '', unit_price: '' }],
        buy_quantity: '',
        pay_quantity: '',
        highlight_text: '',
        start_at: '',
        end_at: '',
        weekdays: [],
        active: true,
    }
}

export default function PromotionsIndex({ categories = [], products = [] }) {
    const [promotions, setPromotions] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm())
    const [saving, setSaving] = useState(false)

    async function refresh() {
        setLoading(true)
        try {
            const response = await apiRequest('/api/promotions')
            setPromotions(response.promotions || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void refresh()
    }, [])

    function openCreate() {
        setForm(emptyForm())
        setModalOpen(true)
    }

    function openEdit(promotion) {
        setForm({
            id: promotion.id,
            name: promotion.name,
            description: promotion.description || '',
            type: promotion.type,
            scope: promotion.scope,
            product_id: promotion.product_id || '',
            category_id: promotion.category_id || '',
            discount_value: promotion.discount_value ?? '',
            tiers: promotion.config?.tiers?.length ? promotion.config.tiers : [{ min_quantity: '', unit_price: '' }],
            buy_quantity: promotion.config?.buy_quantity ?? '',
            pay_quantity: promotion.config?.pay_quantity ?? '',
            highlight_text: promotion.highlight_text || '',
            start_at: promotion.start_at || '',
            end_at: promotion.end_at || '',
            weekdays: promotion.weekdays || [],
            active: promotion.active,
        })
        setModalOpen(true)
    }

    function toggleWeekday(value) {
        setForm((current) => ({
            ...current,
            weekdays: current.weekdays.includes(value)
                ? current.weekdays.filter((day) => day !== value)
                : [...current.weekdays, value],
        }))
    }

    function updateTier(index, key, value) {
        setForm((current) => ({
            ...current,
            tiers: current.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, [key]: value } : tier)),
        }))
    }

    function addTier() {
        setForm((current) => ({ ...current, tiers: [...current.tiers, { min_quantity: '', unit_price: '' }] }))
    }

    function removeTier(index) {
        setForm((current) => ({ ...current, tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index) }))
    }

    function buildPayload() {
        const scope = form.type === 'category_discount' ? 'category' : 'product'

        const config = form.type === 'buy_x_pay_y'
            ? { buy_quantity: Number(form.buy_quantity), pay_quantity: Number(form.pay_quantity) }
            : form.type === 'quantity_discount'
                ? { tiers: form.tiers.filter((tier) => tier.min_quantity !== '' && tier.unit_price !== '').map((tier) => ({ min_quantity: Number(tier.min_quantity), unit_price: Number(tier.unit_price) })) }
                : null

        return {
            name: form.name,
            description: form.description || null,
            type: form.type,
            scope,
            product_id: scope === 'product' ? Number(form.product_id) || null : null,
            category_id: scope === 'category' ? Number(form.category_id) || null : null,
            discount_value: form.discount_value === '' ? 0 : Number(form.discount_value),
            config,
            highlight_text: form.highlight_text || null,
            start_at: form.start_at || null,
            end_at: form.end_at || null,
            weekdays: form.weekdays.length ? form.weekdays : null,
            active: Boolean(form.active),
        }
    }

    async function submitForm(event) {
        event.preventDefault()
        setSaving(true)

        try {
            const payload = buildPayload()
            const response = form.id
                ? await apiRequest(`/api/promotions/${form.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/promotions', { method: 'post', data: payload })

            setFeedback({ type: 'success', text: response.message })
            setModalOpen(false)
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function removePromotion(promotion) {
        try {
            const response = await apiRequest(`/api/promotions/${promotion.id}`, { method: 'delete' })
            setFeedback({ type: 'success', text: response.message })
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function duplicatePromotion(promotion) {
        try {
            const response = await apiRequest(`/api/promotions/${promotion.id}/duplicate`, { method: 'post' })
            setFeedback({ type: 'success', text: response.message })
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    const rows = promotions.map((promotion) => ({
        ...promotion,
        type_label: TYPE_LABELS[promotion.type] || promotion.type,
        target_label: promotion.scope === 'product' ? (promotion.product_name || '-') : (promotion.category_name || '-'),
    }))

    return (
        <AppLayout title="Promoções">
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                <div className="ui-filter-bar">
                    <button type="button" className="ui-button" onClick={openCreate}>
                        <i className="fa-solid fa-plus" /> Nova promoção
                    </button>
                </div>

                <DenseTable
                    columns={[
                        { key: 'name', label: 'Nome' },
                        { key: 'type_label', label: 'Tipo' },
                        { key: 'target_label', label: 'Alvo' },
                        { key: 'status', label: 'Status', render: (row) => <span className={`promotions-status-badge ${row.status}`}>{row.status}</span> },
                        { key: 'active', label: 'Ativa', render: (row) => (row.active ? 'Sim' : 'Não') },
                    ]}
                    rows={rows}
                    rowKey="id"
                    onRowClick={(row) => openEdit(row)}
                    emptyState={<p>{loading ? 'Carregando...' : 'Nenhuma promoção cadastrada.'}</p>}
                    getRowActions={(row) => [
                        { key: 'duplicate', icon: 'fa-copy', label: 'Duplicar', onClick: () => void duplicatePromotion(row) },
                        { key: 'delete', icon: 'fa-trash', label: 'Excluir', onClick: () => void removePromotion(row) },
                    ]}
                />
            </PageContainer>

            <CompactModal
                open={modalOpen}
                title={form.id ? 'Editar promoção' : 'Nova promoção'}
                icon="fa-tags"
                size="lg"
                onClose={() => setModalOpen(false)}
            >
                <form onSubmit={submitForm}>
                    <label>
                        <span>Nome</span>
                        <input className="ui-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                    </label>

                    <label>
                        <span>Descrição</span>
                        <textarea className="ui-input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                    </label>

                    <label>
                        <span>Tipo</span>
                        <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                            {Object.entries(TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>

                    {form.type === 'category_discount' ? (
                        <label>
                            <span>Categoria</span>
                            <select value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))} required>
                                <option value="">Selecione</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <label>
                            <span>Produto</span>
                            <select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))} required>
                                <option value="">Selecione</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>{product.name} ({product.code})</option>
                                ))}
                            </select>
                        </label>
                    )}

                    {form.type === 'promo_price' ? (
                        <label>
                            <span>Preço promocional (R$)</span>
                            <input className="ui-input" type="number" step="0.01" min="0" value={form.discount_value} onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))} required />
                        </label>
                    ) : null}

                    {form.type === 'category_discount' ? (
                        <label>
                            <span>Desconto (%)</span>
                            <input className="ui-input" type="number" step="0.1" min="0" max="99" value={form.discount_value} onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))} required />
                        </label>
                    ) : null}

                    {form.type === 'buy_x_pay_y' ? (
                        <div className="promotions-tier-row">
                            <label>
                                <span>Leve (unidades)</span>
                                <input className="ui-input" type="number" min="1" value={form.buy_quantity} onChange={(event) => setForm((current) => ({ ...current, buy_quantity: event.target.value }))} required />
                            </label>
                            <label>
                                <span>Pague (unidades)</span>
                                <input className="ui-input" type="number" min="0" value={form.pay_quantity} onChange={(event) => setForm((current) => ({ ...current, pay_quantity: event.target.value }))} required />
                            </label>
                        </div>
                    ) : null}

                    {form.type === 'quantity_discount' ? (
                        <>
                            <span>Faixas de quantidade</span>
                            {form.tiers.map((tier, index) => (
                                <div key={index} className="promotions-tier-row">
                                    <input className="ui-input" type="number" min="1" placeholder="A partir de (un)" value={tier.min_quantity} onChange={(event) => updateTier(index, 'min_quantity', event.target.value)} />
                                    <input className="ui-input" type="number" step="0.01" min="0" placeholder="Preço unitário" value={tier.unit_price} onChange={(event) => updateTier(index, 'unit_price', event.target.value)} />
                                    <button type="button" className="ui-icon-button" onClick={() => removeTier(index)}><i className="fa-solid fa-xmark" /></button>
                                </div>
                            ))}
                            <button type="button" className="ui-button-ghost" onClick={addTier}>+ Adicionar faixa</button>
                        </>
                    ) : null}

                    <label>
                        <span>Texto de destaque (opcional)</span>
                        <input className="ui-input" value={form.highlight_text} onChange={(event) => setForm((current) => ({ ...current, highlight_text: event.target.value }))} />
                    </label>

                    <div className="promotions-tier-row">
                        <label>
                            <span>Início da vigência</span>
                            <input className="ui-input" type="datetime-local" value={form.start_at} onChange={(event) => setForm((current) => ({ ...current, start_at: event.target.value }))} />
                        </label>
                        <label>
                            <span>Fim da vigência</span>
                            <input className="ui-input" type="datetime-local" value={form.end_at} onChange={(event) => setForm((current) => ({ ...current, end_at: event.target.value }))} />
                        </label>
                        <span />
                    </div>

                    <span>Dias da semana (deixe vazio para todos os dias)</span>
                    <div className="promotions-weekday-row">
                        {WEEKDAYS.map((day) => (
                            <button
                                type="button"
                                key={day.value}
                                className={`promotions-weekday-chip ${form.weekdays.includes(day.value) ? 'active' : ''}`}
                                onClick={() => toggleWeekday(day.value)}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>

                    <label>
                        <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                        {' '}Ativa
                    </label>

                    <div className="promotions-tier-row">
                        <button type="button" className="ui-button-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                        <span />
                    </div>
                </form>
            </CompactModal>
        </AppLayout>
    )
}

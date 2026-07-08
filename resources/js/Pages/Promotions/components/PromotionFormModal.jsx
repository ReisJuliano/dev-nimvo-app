import CompactModal from '@/Components/UI/CompactModal'
import { TYPE_LABELS, WEEKDAYS } from '../constants'

export default function PromotionFormModal({
    open,
    form,
    setForm,
    categories,
    products,
    campaigns,
    saving,
    onSubmit,
    onClose,
}) {
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

    return (
        <CompactModal
            open={open}
            title={form.id ? 'Editar promoção' : 'Nova promoção'}
            icon="fa-tags"
            size="lg"
            onClose={onClose}
        >
            <form onSubmit={onSubmit} className="promo-form">
                <label>
                    <span>Tabloide</span>
                    <select value={form.campaign_id} onChange={(event) => setForm((current) => ({ ...current, campaign_id: event.target.value }))}>
                        <option value="">Nenhum (avulsa)</option>
                        {campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                        ))}
                    </select>
                </label>

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
                    <div className="promo-tier-row">
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
                            <div key={index} className="promo-tier-row">
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

                <div className="promo-tier-row">
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
                <div className="promo-weekday-row">
                    {WEEKDAYS.map((day) => (
                        <button
                            type="button"
                            key={day.value}
                            className={`promo-weekday-chip ${form.weekdays.includes(day.value) ? 'active' : ''}`}
                            onClick={() => toggleWeekday(day.value)}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>

                <label className="promo-inline-checkbox">
                    <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                    <span>Ativa</span>
                </label>

                <div className="promo-form-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </form>
        </CompactModal>
    )
}

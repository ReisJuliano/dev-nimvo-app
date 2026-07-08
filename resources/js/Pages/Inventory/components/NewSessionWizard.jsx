import { useState } from 'react'
import CompactModal from '@/Components/UI/CompactModal'
import { apiRequest } from '@/lib/http'
import { CYCLE_CLASS_LABELS } from '../constants'

export function emptyWizardForm() {
    return {
        type: 'general',
        mode: 'snapshot',
        count_resolution: 'manual_review',
        blind_count: false,
        category_ids: [],
        supplier_ids: [],
        product_ids: [],
        notes: '',
    }
}

export default function NewSessionWizard({ open, form, setForm, categories, suppliers, saving, onSubmit, onClose }) {
    const [suggesting, setSuggesting] = useState(false)
    const [suggestion, setSuggestion] = useState(null)

    async function suggestCycle(cycleClass) {
        setSuggesting(true)
        setSuggestion(null)

        try {
            const response = await apiRequest('/api/inventory/cycle-count/suggestion', { params: { class: cycleClass } })
            setSuggestion(response)
            setForm((current) => ({ ...current, product_ids: response.product_ids, category_ids: [], supplier_ids: [] }))
        } catch {
            setSuggestion(null)
        } finally {
            setSuggesting(false)
        }
    }

    function handleClose() {
        setSuggestion(null)
        onClose()
    }

    return (
        <CompactModal open={open} title="Novo inventário" icon="fa-clipboard-list" size="lg" onClose={handleClose}>
            <form onSubmit={onSubmit} className="ivs-wizard">
                <label>
                    <span>Tipo</span>
                    <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                        <option value="general">Geral (todos os produtos ativos)</option>
                        <option value="partial">Parcial (filtrado)</option>
                    </select>
                </label>

                {form.type === 'partial' ? (
                    <>
                        <div className="ivs-cycle-suggestion">
                            <p className="nimvo-section-label">Sugestão cíclica por curva ABC</p>
                            <div className="ivs-cycle-buttons">
                                {Object.entries(CYCLE_CLASS_LABELS).map(([cycleClass, label]) => (
                                    <button
                                        key={cycleClass}
                                        type="button"
                                        className="ui-button-ghost"
                                        disabled={suggesting}
                                        onClick={() => suggestCycle(cycleClass)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {suggesting ? <p className="ivs-cycle-hint">Calculando sugestão...</p> : null}
                            {suggestion ? (
                                <p className="ivs-cycle-hint">
                                    {suggestion.total_candidates} produto(s) da classe {suggestion.class} vencido(s) pro intervalo
                                    de {suggestion.interval_days} dias — selecionados como filtro desta sessão.
                                </p>
                            ) : null}
                        </div>

                        <label>
                            <span>Categorias (filtro manual)</span>
                            <select
                                multiple
                                value={form.category_ids}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    category_ids: Array.from(event.target.selectedOptions, (option) => Number(option.value)),
                                    product_ids: [],
                                }))}
                            >
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Fornecedores (filtro manual)</span>
                            <select
                                multiple
                                value={form.supplier_ids}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    supplier_ids: Array.from(event.target.selectedOptions, (option) => Number(option.value)),
                                    product_ids: [],
                                }))}
                            >
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                ))}
                            </select>
                        </label>
                    </>
                ) : null}

                <label>
                    <span>Modo</span>
                    <select value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))}>
                        <option value="snapshot">Snapshot (loja continua vendendo e recebendo)</option>
                        <option value="frozen">Congelado (bloqueia venda dos itens)</option>
                    </select>
                </label>

                <label>
                    <span>Regra de resolução de contagens</span>
                    <select value={form.count_resolution} onChange={(event) => setForm((current) => ({ ...current, count_resolution: event.target.value }))}>
                        <option value="manual_review">Decisão manual do supervisor</option>
                        <option value="two_matching_counts">Duas contagens iguais confirmam</option>
                        <option value="last_count_wins">Última contagem vale</option>
                    </select>
                </label>

                <label className="ivs-wizard-checkbox">
                    <input
                        type="checkbox"
                        checked={form.blind_count}
                        onChange={(event) => setForm((current) => ({ ...current, blind_count: event.target.checked }))}
                    />
                    <span>
                        <strong>Contagem cega</strong>
                        <small>Quem está bipando não vê a quantidade do sistema — só o supervisor, na revisão</small>
                    </span>
                </label>

                <label>
                    <span>Observações</span>
                    <textarea className="ui-input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                </label>

                <div className="ivs-wizard-actions">
                    <button type="button" className="ui-button-ghost" onClick={handleClose}>Cancelar</button>
                    <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Criando...' : 'Criar sessão'}</button>
                </div>
            </form>
        </CompactModal>
    )
}

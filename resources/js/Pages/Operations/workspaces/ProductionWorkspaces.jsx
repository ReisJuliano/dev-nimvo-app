import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import KitchenKanbanBoard from './KitchenKanbanBoard'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    ensureDate,
    ensureDateTime,
    Feedback,
    FeedbackHeader,
    getProductOptionLabel,
    ListCard,
    MetricGrid,
    parseNumber,
    SectionTabs,
    upsertRecord,
} from './shared'

function RecipeItemsEditor({ products, items, onChange }) {
    const [draft, setDraft] = useState({ product_id: '', quantity: '1', unit: 'UN', notes: '' })

    function addItem() {
        if (!draft.product_id) return

        const product = products.find((entry) => String(entry.id) === String(draft.product_id))
        onChange([
            ...items,
            {
                product_id: String(draft.product_id),
                product_name: product?.name,
                quantity: String(parseNumber(draft.quantity, 1)),
                unit: draft.unit || product?.unit || 'UN',
                notes: draft.notes,
            },
        ])
        setDraft({ product_id: '', quantity: '1', unit: 'UN', notes: '' })
    }

    return (
        <>
            <div className="ops-workspace-inline-adder span-2">
                <select value={draft.product_id} onChange={(event) => setDraft((current) => ({ ...current, product_id: event.target.value }))}>
                    <option value="">Adicionar insumo</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}
                </select>
                <input type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
                <input value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="UN" />
                <button type="button" className="ui-button-ghost" onClick={addItem}>Adicionar</button>
            </div>
            <div className="ops-workspace-table-wrap span-2">
                <table className="ui-table">
                    <thead><tr><th>Insumo</th><th>Qtd</th><th>Unidade</th><th>Obs.</th><th>Acao</th></tr></thead>
                    <tbody>
                        {items.length ? items.map((item, index) => (
                            <tr key={`${item.product_id}-${index}`}>
                                <td>{item.product_name || products.find((product) => String(product.id) === String(item.product_id))?.name || 'Insumo'}</td>
                                <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantity: event.target.value } : entry)))} /></td>
                                <td><input value={item.unit} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, unit: event.target.value } : entry)))} /></td>
                                <td><input value={item.notes || ''} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, notes: event.target.value } : entry)))} /></td>
                                <td><button type="button" className="ui-button-ghost danger" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}>Remover</button></td>
                            </tr>
                        )) : <tr><td colSpan="5">Nenhum insumo adicionado.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    )
}

export function RecipesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, code: '', name: '', product_id: '', yield_quantity: '1', yield_unit: 'UN', prep_time_minutes: '', instructions: '', active: true, items: [] }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('active')
    const [form, setForm] = useState(emptyForm)
    const [detail, setDetail] = useState(null)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => (activeTab === 'active' ? record.active : !record.active)), [records, activeTab])
    const metrics = useMemo(() => [
        { label: 'Fichas', value: records.length, caption: 'Cadastros do modulo' },
        { label: 'Ativas', value: records.filter((record) => record.active).length, caption: 'Disponiveis para producao' },
        { label: 'Insumos', value: records.reduce((total, record) => total + (record.items?.length || 0), 0), caption: 'Itens tecnicos cadastrados' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = {
                ...form,
                product_id: form.product_id ? Number(form.product_id) : null,
                yield_quantity: parseNumber(form.yield_quantity, 1),
                prep_time_minutes: form.prep_time_minutes ? Number(form.prep_time_minutes) : null,
                items: form.items.map((item) => ({ product_id: Number(item.product_id), quantity: parseNumber(item.quantity, 0), unit: item.unit, notes: item.notes || null })),
            }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, product_id: response.record.product_id ? String(response.record.product_id) : '', yield_quantity: String(response.record.yield_quantity || 1), prep_time_minutes: response.record.prep_time_minutes ? String(response.record.prep_time_minutes) : '', items: (response.record.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity) })) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a ficha "${form.name}"?`)) return
        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="ops-workspace-stack">
            <SectionTabs tabs={[{ key: 'active', label: 'Ativas', icon: 'fa-book-open' }, { key: 'inactive', label: 'Inativas', icon: 'fa-ban' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Receitas" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setDetail(record)}
                                title={`${record.name} ${record.code ? `· ${record.code}` : ''}`}
                                badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativa' : 'Inativa'}</Badge>}
                                description={record.product_name || 'Sem produto final vinculado'}
                                meta={[`${record.items?.length || 0} insumo(s)`, `${formatNumber(record.yield_quantity)} ${record.yield_unit}`]}
                            />
                        )) : <EmptyState title="Sem fichas nesse recorte" text="Cadastre receitas e consumo tecnico para padronizar a operacao." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar ficha' : 'Nova ficha'} subtitle="Receita com insumos e rendimento" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Codigo</span><input value={form.code || ''} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Automatico se vazio" /></label>
                        <label><span>Produto final</span><select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}><option value="">Sem vinculo</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select></label>
                        <label className="span-2"><span>Nome</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                        <label><span>Rendimento</span><input type="number" min="0.001" step="0.001" value={form.yield_quantity} onChange={(event) => setForm((current) => ({ ...current, yield_quantity: event.target.value }))} required /></label>
                        <label><span>Unidade</span><input value={form.yield_unit} onChange={(event) => setForm((current) => ({ ...current, yield_unit: event.target.value }))} required /></label>
                        <label className="span-2"><span>Tempo de preparo (minutos)</span><input type="number" min="0" step="1" value={form.prep_time_minutes} onChange={(event) => setForm((current) => ({ ...current, prep_time_minutes: event.target.value }))} /></label>
                        <label className="span-2"><span>Modo de preparo</span><textarea rows="4" value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} /></label>
                        <RecipeItemsEditor products={payload.products} items={form.items} onChange={(items) => setForm((current) => ({ ...current, items }))} />
                        <label className="ops-workspace-inline-toggle span-2"><input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Ficha ativa</span></label>
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar ficha' : 'Salvar ficha'}</button></div>
                    </form>
                </section>
            </div>

            {detail ? (
                <div className="ops-recipe-modal" role="dialog" aria-modal="true">
                    <div className="ops-recipe-modal-backdrop" onClick={() => setDetail(null)} />
                    <div className="ops-recipe-modal-card">
                        <header className="ops-recipe-modal-header">
                            <div>
                                <strong>{detail.name}</strong>
                                <small>{detail.code ? `Codigo ${detail.code}` : 'Sem codigo'}</small>
                            </div>
                            <button type="button" className="ui-button-ghost" onClick={() => setDetail(null)}>
                                <i className="fa-solid fa-xmark" />
                                Fechar
                            </button>
                        </header>

                        <div className="ops-recipe-modal-body">
                            <div className="ops-recipe-metrics">
                                <div>
                                    <span>Rendimento</span>
                                    <strong>{`${formatNumber(detail.yield_quantity)} ${detail.yield_unit}`}</strong>
                                </div>
                                <div>
                                    <span>Tempo</span>
                                    <strong>{detail.prep_time_minutes ? `${detail.prep_time_minutes} min` : 'Nao informado'}</strong>
                                </div>
                                <div>
                                    <span>Produto final</span>
                                    <strong>{detail.product_name || 'Sem vinculo'}</strong>
                                </div>
                            </div>

                            <section className="ops-recipe-section">
                                <h4>Insumos</h4>
                                <div className="ops-recipe-items">
                                    {(detail.items || []).map((item) => (
                                        <article key={item.id} className="ops-recipe-item">
                                            <strong>{item.product_name || item.ingredient_name || 'Insumo'}</strong>
                                            <small>{`${formatNumber(item.quantity)} ${item.unit}`}</small>
                                            {item.notes ? <p>{item.notes}</p> : null}
                                        </article>
                                    ))}
                                </div>
                            </section>

                            <section className="ops-recipe-section">
                                <h4>Modo de preparo</h4>
                                <p className="ops-recipe-instructions">{detail.instructions || 'Nao informado.'}</p>
                            </section>
                        </div>

                        <footer className="ops-recipe-modal-footer">
                            <button
                                type="button"
                                className="ui-button-secondary"
                                onClick={() => {
                                    setForm({
                                        ...emptyForm,
                                        ...detail,
                                        product_id: detail.product_id ? String(detail.product_id) : '',
                                        yield_quantity: String(detail.yield_quantity || 1),
                                        prep_time_minutes: detail.prep_time_minutes ? String(detail.prep_time_minutes) : '',
                                        items: (detail.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity) })),
                                    })
                                    setDetail(null)
                                }}
                            >
                                <i className="fa-solid fa-pen" />
                                Editar receita
                            </button>
                            <button type="button" className="ui-button" onClick={() => setDetail(null)}>
                                Ok
                            </button>
                        </footer>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export function ProductionWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, recipe_id: '', product_id: '', status: 'planned', planned_quantity: '1', produced_quantity: '', unit: 'UN', scheduled_for: '', notes: '' }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('planned')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const metrics = useMemo(() => [
        { label: 'Ordens', value: records.length, caption: 'Cadastros totais' },
        { label: 'Concluidas', value: records.filter((record) => record.status === 'completed').length, caption: 'Lotes fechados' },
        { label: 'Com estoque aplicado', value: records.filter((record) => record.stock_applied_at).length, caption: 'Impacto em estoque confirmado' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, recipe_id: form.recipe_id ? Number(form.recipe_id) : null, product_id: form.product_id ? Number(form.product_id) : null, planned_quantity: parseNumber(form.planned_quantity, 1), produced_quantity: form.produced_quantity === '' ? null : parseNumber(form.produced_quantity, 0), scheduled_for: form.scheduled_for || null }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, recipe_id: response.record.recipe_id ? String(response.record.recipe_id) : '', product_id: response.record.product_id ? String(response.record.product_id) : '', planned_quantity: String(response.record.planned_quantity || 1), produced_quantity: response.record.produced_quantity ? String(response.record.produced_quantity) : '', scheduled_for: ensureDate(response.record.scheduled_for) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a ordem "${form.code}"?`)) return
        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    function handleRecipeChange(recipeId) {
        const recipe = payload.recipes.find((entry) => String(entry.id) === String(recipeId))
        setForm((current) => ({ ...current, recipe_id: recipeId, product_id: recipe?.product_id ? String(recipe.product_id) : current.product_id, unit: recipe?.yield_unit || current.unit }))
    }

    return (
        <div className="ops-workspace-stack">
            <SectionTabs tabs={[{ key: 'planned', label: 'Planejadas', icon: 'fa-calendar-check' }, { key: 'in_progress', label: 'Em preparo', icon: 'fa-gears' }, { key: 'completed', label: 'Concluidas', icon: 'fa-check-double' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Lotes" subtitle={`${filteredRecords.length} ordem(ns)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, recipe_id: record.recipe_id ? String(record.recipe_id) : '', product_id: record.product_id ? String(record.product_id) : '', planned_quantity: String(record.planned_quantity || 1), produced_quantity: record.produced_quantity ? String(record.produced_quantity) : '', scheduled_for: ensureDate(record.scheduled_for) })}
                                title={`${record.code} · ${record.product_name || 'Sem produto'}`}
                                badge={<Badge tone={record.stock_applied_at ? 'success' : record.status === 'completed' ? 'info' : 'warning'}>{record.status}</Badge>}
                                description={record.recipe_name || 'Sem ficha vinculada'}
                                meta={[`Planejado ${formatNumber(record.planned_quantity)} ${record.unit}`, `Produzido ${formatNumber(record.produced_quantity || 0)} ${record.unit}`]}
                            />
                        )) : <EmptyState title="Sem lotes nesse status" text="Crie ordens de producao para controlar preparo e devolucao ao estoque." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar ordem' : 'Nova ordem'} subtitle="Planejamento e encerramento da producao" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Ficha tecnica</span><select value={form.recipe_id} onChange={(event) => handleRecipeChange(event.target.value)}><option value="">Sem ficha</option>{payload.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label>
                        <label><span>Produto final</span><select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}><option value="">Selecione</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="planned">Planejada</option><option value="in_progress">Em preparo</option><option value="completed">Concluida</option></select></label>
                        <label><span>Agendada para</span><input type="date" value={form.scheduled_for} onChange={(event) => setForm((current) => ({ ...current, scheduled_for: event.target.value }))} /></label>
                        <label><span>Qtd planejada</span><input type="number" min="0.001" step="0.001" value={form.planned_quantity} onChange={(event) => setForm((current) => ({ ...current, planned_quantity: event.target.value }))} required /></label>
                        <label><span>Qtd produzida</span><input type="number" min="0" step="0.001" value={form.produced_quantity} onChange={(event) => setForm((current) => ({ ...current, produced_quantity: event.target.value }))} /></label>
                        <label className="span-2"><span>Unidade</span><input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} required /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        {form.stock_applied_at ? <div className="ops-workspace-inline-alert span-2">Esta ordem ja movimentou estoque e esta bloqueada para alteracoes operacionais.</div> : null}
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar ordem' : 'Salvar ordem'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function KitchenWorkspace({ moduleKey, payload }) {
    const [records, setRecords] = useState(payload.records || [])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const metrics = useMemo(() => [
        { label: 'Comandas', value: records.length, caption: 'Fila completa' },
        { label: 'Em preparo', value: records.filter((record) => record.status === 'in_preparation').length, caption: 'Producao ativa' },
        { label: 'Prontas', value: records.filter((record) => record.status === 'ready').length, caption: 'Aguardando retirada' },
    ], [records])

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            if (document.hidden) return
            void refreshRecords(true)
        }, 10000)

        return () => window.clearInterval(intervalId)
    }, [moduleKey])

    async function refreshRecords(silent = false) {
        if (!silent) setLoading(true)

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'get' })
            setRecords(response.records || [])
        } catch (error) {
            if (!silent) {
                setFeedback({ type: 'error', text: error.message })
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }

    function buildTicketPayload(ticket, nextStatus) {
        return {
            ...ticket,
            status: nextStatus,
            requested_at: ticket.requested_at || null,
            items: (ticket.items || []).map((item) => ({
                product_id: item.product_id ? Number(item.product_id) : null,
                item_name: item.item_name,
                quantity: parseNumber(item.quantity, 1),
                unit: item.unit || 'UN',
                notes: item.notes || null,
            })),
        }
    }

    async function handleMoveTicket(ticket, nextStatus) {
        if (ticket.status === nextStatus) return

        setFeedback(null)
        setLoading(true)

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, ticket.id), {
                method: 'put',
                data: buildTicketPayload(ticket, nextStatus),
            })

            setRecords((current) => upsertRecord(current, response.record))
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    async function handleToggleItemDone(ticketId, itemId) {
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/kitchen/tickets/${ticketId}/items/${itemId}/toggle-done`, { method: 'post' })
            setRecords((current) => upsertRecord(current, response.record))
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="ops-workspace-stack">
            <FeedbackHeader
                title="Cozinha integrada"
                subtitle="Comandas do restaurante em fluxo unico"
                action={(
                    <div className="ops-kitchen-header-actions">
                        <button type="button" className="ui-button-ghost" onClick={() => refreshRecords(false)}>
                            <i className="fa-solid fa-rotate-right" />
                            Atualizar
                        </button>
                        <a className="ui-button" href="/cozinha-tv" target="_blank" rel="noreferrer">
                            <i className="fa-solid fa-tv" />
                            Abrir tela TV
                        </a>
                    </div>
                )}
            />
            <MetricGrid items={metrics} />
            <p className="ops-kitchen-priority-note">
                Prioridade automatica: urgente manual, atrasado acima de 35 min e atencao acima de 20 min.
                {' '}
                No card: use &lt; para voltar etapa e &gt; para avancar etapa.
            </p>
            <Feedback feedback={feedback} />
            <KitchenKanbanBoard
                tickets={records}
                onMoveTicket={handleMoveTicket}
                onToggleItemDone={handleToggleItemDone}
                loading={loading}
            />
        </div>
    )
}

export function LossesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, product_id: '', reason: '', status: 'draft', quantity: '1', notes: '', occurred_at: '' }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('draft')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const selectedProduct = payload.products.find((product) => String(product.id) === String(form.product_id))
    const totalPreview = parseNumber(form.quantity, 0) * parseNumber(selectedProduct?.cost_price, 0)
    const metrics = useMemo(() => [
        { label: 'Registros', value: records.length, caption: 'Perdas cadastradas' },
        { label: 'Confirmadas', value: records.filter((record) => record.status === 'confirmed').length, caption: 'Com reflexo em estoque' },
        { label: 'Custo total', value: records.reduce((total, record) => total + Number(record.total_cost || 0), 0), caption: 'Impacto financeiro', format: 'money' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, product_id: Number(form.product_id), quantity: parseNumber(form.quantity, 0), occurred_at: form.occurred_at || null }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, product_id: String(response.record.product_id), quantity: String(response.record.quantity), occurred_at: ensureDateTime(response.record.occurred_at) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover o registro de perda "${form.reason}"?`)) return
        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="ops-workspace-stack">
            <SectionTabs tabs={[{ key: 'draft', label: 'Rascunhos', icon: 'fa-note-sticky' }, { key: 'confirmed', label: 'Confirmadas', icon: 'fa-triangle-exclamation' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Perdas" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, product_id: String(record.product_id), quantity: String(record.quantity), occurred_at: ensureDateTime(record.occurred_at) })}
                                title={record.product_name || 'Produto'}
                                badge={<Badge tone={record.status === 'confirmed' ? 'danger' : 'warning'}>{record.status === 'confirmed' ? 'Confirmada' : 'Rascunho'}</Badge>}
                                description={record.reason}
                                meta={[`${formatNumber(record.quantity)} ${record.unit || ''}`, formatMoney(record.total_cost || 0)]}
                            />
                        )) : <EmptyState title="Sem perdas nesse status" text="Use o modulo para documentar quebra, descarte e vencimento." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar perda' : 'Nova perda'} subtitle="Impacto real no estoque" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Produto</span><select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))} required><option value="">Selecione</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="confirmed">Confirmada</option></select></label>
                        <label className="span-2"><span>Motivo</span><input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required /></label>
                        <label><span>Quantidade</span><input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required /></label>
                        <label><span>Ocorrida em</span><input type="datetime-local" value={form.occurred_at} onChange={(event) => setForm((current) => ({ ...current, occurred_at: event.target.value }))} /></label>
                        <div className="ops-workspace-total-bar span-2"><span>Custo previsto</span><strong>{formatMoney(totalPreview)}</strong></div>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        {form.stock_applied_at ? <div className="ops-workspace-inline-alert span-2">Esta perda ja foi aplicada no estoque e esta bloqueada para alteracao de produto/quantidade.</div> : null}
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar registro' : 'Salvar registro'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}


import { useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
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

function KitchenItemsEditor({ products, items, onChange }) {
    const [draft, setDraft] = useState({ product_id: '', item_name: '', quantity: '1', unit: 'UN', notes: '' })

    function addItem() {
        if (!draft.item_name && !draft.product_id) return

        const product = products.find((entry) => String(entry.id) === String(draft.product_id))
        onChange([
            ...items,
            {
                product_id: draft.product_id,
                item_name: draft.item_name || product?.name || '',
                quantity: String(parseNumber(draft.quantity, 1)),
                unit: draft.unit || product?.unit || 'UN',
                notes: draft.notes,
            },
        ])
        setDraft({ product_id: '', item_name: '', quantity: '1', unit: 'UN', notes: '' })
    }

    return (
        <>
            <div className="ops-workspace-inline-adder span-2">
                <select value={draft.product_id} onChange={(event) => {
                    const product = products.find((entry) => String(entry.id) === String(event.target.value))
                    setDraft((current) => ({ ...current, product_id: event.target.value, item_name: current.item_name || product?.name || '', unit: current.unit || product?.unit || 'UN' }))
                }}>
                    <option value="">Produto opcional</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}
                </select>
                <input value={draft.item_name} onChange={(event) => setDraft((current) => ({ ...current, item_name: event.target.value }))} placeholder="Nome do item" />
                <input type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
                <button type="button" className="ui-button-ghost" onClick={addItem}>Adicionar</button>
            </div>
            <div className="ops-workspace-table-wrap span-2">
                <table className="ui-table">
                    <thead><tr><th>Item</th><th>Qtd</th><th>Unidade</th><th>Obs.</th><th>Acao</th></tr></thead>
                    <tbody>
                        {items.length ? items.map((item, index) => (
                            <tr key={`${item.item_name}-${index}`}>
                                <td><input value={item.item_name} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, item_name: event.target.value } : entry)))} /></td>
                                <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantity: event.target.value } : entry)))} /></td>
                                <td><input value={item.unit} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, unit: event.target.value } : entry)))} /></td>
                                <td><input value={item.notes || ''} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, notes: event.target.value } : entry)))} /></td>
                                <td><button type="button" className="ui-button-ghost danger" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}>Remover</button></td>
                            </tr>
                        )) : <tr><td colSpan="5">Nenhum item adicionado.</td></tr>}
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
                    <FeedbackHeader title="Fichas tecnicas" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, product_id: record.product_id ? String(record.product_id) : '', yield_quantity: String(record.yield_quantity || 1), prep_time_minutes: record.prep_time_minutes ? String(record.prep_time_minutes) : '', items: (record.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity) })) })}
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
    const emptyForm = { id: null, reference: '', channel: 'balcao', status: 'queued', priority: 'normal', customer_name: '', notes: '', requested_at: '', items: [] }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('queued')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const metrics = useMemo(() => [
        { label: 'Tickets', value: records.length, caption: 'Fila completa' },
        { label: 'Urgentes', value: records.filter((record) => record.priority === 'urgent').length, caption: 'Atencao imediata' },
        { label: 'Prontos', value: records.filter((record) => record.status === 'ready').length, caption: 'Aguardando saida' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, requested_at: form.requested_at || null, items: form.items.map((item) => ({ product_id: item.product_id ? Number(item.product_id) : null, item_name: item.item_name, quantity: parseNumber(item.quantity, 1), unit: item.unit, notes: item.notes || null })) }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, requested_at: ensureDateTime(response.record.requested_at), items: (response.record.items || []).map((item) => ({ ...item, product_id: item.product_id ? String(item.product_id) : '', quantity: String(item.quantity) })) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover o ticket "${form.reference || form.customer_name || `#${form.id}`}"?`)) return
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
            <SectionTabs tabs={[{ key: 'queued', label: 'Fila', icon: 'fa-list' }, { key: 'in_preparation', label: 'Em preparo', icon: 'fa-fire-burner' }, { key: 'ready', label: 'Prontos', icon: 'fa-bell-concierge' }, { key: 'completed', label: 'Expedidos', icon: 'fa-check-double' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Painel da cozinha" subtitle={`${filteredRecords.length} ticket(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, requested_at: ensureDateTime(record.requested_at), items: (record.items || []).map((item) => ({ ...item, product_id: item.product_id ? String(item.product_id) : '', quantity: String(item.quantity) })) })}
                                title={record.reference || record.customer_name || `Ticket #${record.id}`}
                                badge={<Badge tone={record.priority === 'urgent' ? 'danger' : 'warning'}>{record.priority === 'urgent' ? 'Urgente' : record.status}</Badge>}
                                description={record.channel}
                                meta={[`${record.items?.length || 0} item(ns)`, record.customer_name || 'Sem cliente']}
                            />
                        )) : <EmptyState title="Sem tickets nesse status" text="Monte a fila de preparo e acompanhe o que ja saiu da cozinha." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar ticket' : 'Novo ticket'} subtitle="Fila operacional da cozinha" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Referencia</span><input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                        <label><span>Cliente / mesa</span><input value={form.customer_name} onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} /></label>
                        <label><span>Canal</span><select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}><option value="balcao">Balcao</option><option value="mesa">Mesa</option><option value="delivery">Delivery</option><option value="retirada">Retirada</option></select></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="queued">Fila</option><option value="in_preparation">Em preparo</option><option value="ready">Pronto</option><option value="completed">Expedido</option></select></label>
                        <label><span>Prioridade</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Normal</option><option value="urgent">Urgente</option></select></label>
                        <label><span>Recebido em</span><input type="datetime-local" value={form.requested_at} onChange={(event) => setForm((current) => ({ ...current, requested_at: event.target.value }))} /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <KitchenItemsEditor products={payload.products} items={form.items} onChange={(items) => setForm((current) => ({ ...current, items }))} />
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar ticket' : 'Salvar ticket'}</button></div>
                    </form>
                </section>
            </div>
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import ActionButton from '@/Components/UI/ActionButton'
import ModalForm from '@/Components/UI/ModalForm'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    ListCard,
    WorkspaceCollectionShell,
    upsertRecord,
} from './shared'

const CATEGORY_STATUS_FILTERS = [
    { value: 'all', label: 'Status: todos' },
    { value: 'active', label: 'Status: ativas' },
    { value: 'inactive', label: 'Status: inativas' },
]

const CATEGORY_PRODUCT_FILTERS = [
    { value: 'all', label: 'Produtos: todos' },
    { value: 'with-products', label: 'Com produtos' },
    { value: 'without-products', label: 'Sem produtos' },
]

function FieldLabel({ icon, text }) {
    return (
        <span className="ops-workspace-label-with-icon">
            <i className={`fa-solid ${icon}`} />
            {text}
        </span>
    )
}

function normalizeCategorySearch(value) {
    return String(value || '').trim().toLowerCase()
}

function normalizeCustomerSearch(value) {
    return String(value || '').trim()
}

function normalizeCustomerSearchKey(value) {
    return normalizeCustomerSearch(value).toLowerCase()
}

function sortCustomers(records) {
    return [...records].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR', { sensitivity: 'base' }),
    )
}

function CategoryListCard({ record, active, onClick }) {
    const initial = String(record.name || 'C').trim().charAt(0).toUpperCase() || 'C'

    return (
        <button type="button" className={`ops-category-card ${active ? 'active' : ''}`} onClick={onClick}>
            <span className="ops-category-card-icon">{initial}</span>
            <div className="ops-category-card-content">
                <div className="ops-category-card-head">
                    <strong>{record.name}</strong>
                    <Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativa' : 'Inativa'}</Badge>
                </div>
                <div className="ops-category-card-meta">
                    <span>
                        <i className="fa-solid fa-boxes-stacked" />
                        {record.products_count || 0} produto(s)
                    </span>
                    <span>
                        <i className="fa-solid fa-wallet" />
                        {formatMoney(record.stock_value || 0)}
                    </span>
                </div>
            </div>
        </button>
    )
}

export function CategoriesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', description: '', active: true }
    const [records, setRecords] = useState(payload.records || [])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [productFilter, setProductFilter] = useState('all')
    const [form, setForm] = useState(emptyForm)
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const normalizedSearch = useMemo(() => normalizeCategorySearch(search), [search])
    const hasFilters = normalizedSearch !== '' || statusFilter !== 'all' || productFilter !== 'all'

    const filteredRecords = useMemo(
        () => {
            if (!hasFilters) {
                return []
            }

            return records.filter((record) => {
                const matchesSearch = normalizedSearch === ''
                    || normalizeCategorySearch(record.name).includes(normalizedSearch)
                    || normalizeCategorySearch(record.description).includes(normalizedSearch)
                const matchesStatus = statusFilter === 'all'
                    || (statusFilter === 'active' ? record.active : !record.active)
                const hasProducts = Number(record.products_count || 0) > 0
                const matchesProducts = productFilter === 'all'
                    || (productFilter === 'with-products' ? hasProducts : !hasProducts)

                return matchesSearch && matchesStatus && matchesProducts
            })
        },
        [hasFilters, normalizedSearch, productFilter, records, statusFilter],
    )
    function handleCreate() {
        setForm(emptyForm)
        setModalOpen(true)
    }

    function handleSelectRecord(record) {
        setForm({ ...emptyForm, ...record })
        setModalOpen(true)
    }

    function handleCloseModal() {
        setForm(emptyForm)
        setModalOpen(false)
    }

    function handleClearFilters() {
        setSearch('')
        setStatusFilter('all')
        setProductFilter('all')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: form })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: form })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record })
            setModalOpen(false)
            setSearch(response.record.name || '')
            setStatusFilter(response.record.active ? 'active' : 'inactive')
            setProductFilter('all')
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover categoria',
            message: `Remover a categoria "${form.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            handleCloseModal()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <WorkspaceCollectionShell
                tabs={[]}
                activeTab={null}
                onTabChange={() => {}}
                listTitle="Categorias"
                listIcon="fa-layer-group"
                listCount={hasFilters ? `${filteredRecords.length} resultado(s)` : 'Pesquise ou filtre'}
                createLabel="Nova categoria"
                onCreate={handleCreate}
                summaryItems={[]}
                emptyState={null}
                listChildren={(
                    <div className="ops-category-shell">
                        <section className="ops-category-toolbar">
                            <label className="ops-category-search-field">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar categoria"
                                />
                            </label>
                            <label className="ops-category-filter-field">
                                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                    {CATEGORY_STATUS_FILTERS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="ops-category-filter-field">
                                <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
                                    {CATEGORY_PRODUCT_FILTERS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <ActionButton
                                tone="ghost"
                                icon="fa-rotate-left"
                                iconOnly
                                onClick={handleClearFilters}
                                title="Limpar filtros"
                                aria-label="Limpar filtros"
                                disabled={!hasFilters}
                            />
                        </section>

                        {hasFilters ? (
                            filteredRecords.length ? (
                                <div className="ops-category-results">
                                    {filteredRecords.map((record) => (
                                        <CategoryListCard
                                            key={record.id}
                                            record={record}
                                            active={modalOpen && form.id === record.id}
                                            onClick={() => handleSelectRecord(record)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState icon="fa-folder-open" title="Nenhum resultado" text="Refine a busca." />
                            )
                        ) : (
                            <EmptyState icon="fa-sliders" title="Pesquise ou filtre" text="Ative um recorte para listar." />
                        )}
                    </div>
                )}
            />
            <ModalForm
                open={modalOpen}
                title={form.id ? 'Editar categoria' : 'Nova categoria'}
                description="Cadastro compacto"
                icon="fa-layer-group"
                size="sm"
                onClose={handleCloseModal}
                footer={(
                    <>
                        {form.id ? (
                            <ActionButton tone="danger" onClick={handleDelete}>
                                Excluir
                            </ActionButton>
                        ) : <span />}
                        <ActionButton form="category-modal-form" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar categoria'}
                        </ActionButton>
                    </>
                )}
            >
                <form id="category-modal-form" className="ops-workspace-form-grid one-column" onSubmit={handleSubmit}>
                    <label>
                        <FieldLabel icon="fa-layer-group" text="Nome" />
                        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                    </label>
                    <label>
                        <FieldLabel icon="fa-toggle-on" text="Status" />
                        <select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))}>
                            <option value="active">Ativa</option>
                            <option value="inactive">Inativa</option>
                        </select>
                    </label>
                    <label>
                        <FieldLabel icon="fa-align-left" text="Descricao" />
                        <textarea rows="4" value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                    </label>
                </form>
            </ModalForm>
        </>
    )
}

export function SuppliersWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', document: '', trade_name: '', state_registration: '', city_name: '', state: '', phone: '', email: '', active: true }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('active')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(
        () => records.filter((record) => (activeTab === 'active' ? record.active : !record.active)),
        [records, activeTab],
    )
    const metrics = useMemo(
        () => [
            { label: 'Fornecedores', value: records.length, caption: 'Base cadastrada' },
            { label: 'Ativos', value: records.filter((record) => record.active).length, caption: 'Disponiveis para compras' },
            { label: 'Com produtos', value: records.filter((record) => Number(record.products_count || 0) > 0).length, caption: 'Vinculados ao catalogo' },
        ],
        [records],
    )

    function handleCreate() {
        setForm(emptyForm)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: form })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: form })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover fornecedor',
            message: `Remover o fornecedor "${form.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

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
        <>
            <Feedback feedback={feedback} />
            <WorkspaceCollectionShell
                tabs={[
                    { key: 'active', label: 'Ativos', icon: 'fa-truck-ramp-box' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                listTitle="Fornecedores"
                listIcon="fa-truck-ramp-box"
                listCount={`${filteredRecords.length} registro(s)`}
                createLabel="Novo fornecedor"
                onCreate={handleCreate}
                summaryItems={metrics}
                emptyState={<EmptyState title="Sem fornecedores nesse filtro" text="Ajuste o recorte ou crie um novo cadastro." />}
                formTitle={form.id ? 'Editar fornecedor' : 'Novo fornecedor'}
                formSubtitle="Contato e dados comerciais"
                formChildren={(
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-building" text="Nome" />
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label>
                            <FieldLabel icon="fa-id-card" text="CNPJ / Documento" />
                            <input value={form.document || ''} onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))} placeholder="Somente numeros ou formatado" />
                        </label>
                        <label>
                            <FieldLabel icon="fa-store" text="Nome fantasia" />
                            <input value={form.trade_name || ''} onChange={(event) => setForm((current) => ({ ...current, trade_name: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-receipt" text="Inscricao estadual" />
                            <input value={form.state_registration || ''} onChange={(event) => setForm((current) => ({ ...current, state_registration: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-city" text="Cidade" />
                            <input value={form.city_name || ''} onChange={(event) => setForm((current) => ({ ...current, city_name: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-map-location-dot" text="UF" />
                            <input maxLength="2" value={form.state || ''} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-phone" text="Telefone" />
                            <input value={form.phone || ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-envelope" text="E-mail" />
                            <input type="email" value={form.email || ''} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <ActionButton tone="ghost" onClick={() => setForm(emptyForm)}>
                                Limpar
                            </ActionButton>
                            {form.id ? (
                                <ActionButton tone="danger" onClick={handleDelete}>
                                    Excluir
                                </ActionButton>
                            ) : null}
                            <ActionButton type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar fornecedor'}
                            </ActionButton>
                        </div>
                    </form>
                )}
            >
                <div className="ops-workspace-list-stack">
                    {filteredRecords.map((record) => (
                        <ListCard
                            key={record.id}
                            active={form.id === record.id}
                            onClick={() => setForm({ ...emptyForm, ...record })}
                            title={record.name}
                            badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativo' : 'Inativo'}</Badge>}
                            description={record.document || record.email || 'Sem documento fiscal'}
                            meta={[record.phone || 'Sem telefone', `${record.products_count || 0} produto(s)`]}
                        />
                    ))}
                </div>
            </WorkspaceCollectionShell>
        </>
    )
}

export function CustomersWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', phone: '', credit_limit: '0', active: true }
    const [records, setRecords] = useState(payload.records || [])
    const [search, setSearch] = useState('')
    const [form, setForm] = useState(emptyForm)
    const [modalOpen, setModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const requestIdRef = useRef(0)
    const normalizedSearch = useMemo(() => normalizeCustomerSearch(search), [search])
    const normalizedSearchKey = useMemo(() => normalizeCustomerSearchKey(search), [search])
    const hasSearch = normalizedSearch !== ''

    useEffect(() => {
        if (!hasSearch) {
            requestIdRef.current += 1
            setRecords([])
            setLoading(false)
            return
        }

        const requestId = requestIdRef.current + 1
        requestIdRef.current = requestId
        setLoading(true)
        let cancelled = false

        const timer = window.setTimeout(async () => {
            try {
                const response = await apiRequest(buildRecordsUrl(moduleKey), {
                    params: { search: normalizedSearch },
                })

                if (cancelled || requestId !== requestIdRef.current) {
                    return
                }

                setRecords(sortCustomers(response.records || []))
            } catch (error) {
                if (cancelled || requestId !== requestIdRef.current) {
                    return
                }

                setRecords([])
                setFeedback({ type: 'error', text: error.message })
            } finally {
                if (!cancelled && requestId === requestIdRef.current) {
                    setLoading(false)
                }
            }
        }, 300)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [hasSearch, moduleKey, normalizedSearch])

    function buildCustomerForm(record = null) {
        return {
            ...emptyForm,
            ...(record || {}),
            credit_limit: String(record?.credit_limit || 0),
        }
    }

    function recordMatchesSearch(record) {
        if (!normalizedSearchKey) {
            return true
        }

        return normalizeCustomerSearchKey(record?.name).includes(normalizedSearchKey)
    }

    function handleSelectRecord(record) {
        setForm(buildCustomerForm(record))
        setModalOpen(true)
    }

    function handleCreate() {
        setForm(buildCustomerForm())
        setModalOpen(true)
    }

    function handleCloseModal() {
        setForm(buildCustomerForm())
        setModalOpen(false)
    }

    function handleClearSearch() {
        requestIdRef.current += 1
        setSearch('')
        setRecords([])
        setLoading(false)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = {
                ...form,
                credit_limit: Number(form.credit_limit || 0),
            }
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })

            if (form.id) {
                setRecords((current) => {
                    if (!recordMatchesSearch(response.record)) {
                        return current.filter((record) => record.id !== response.record.id)
                    }

                    return sortCustomers(upsertRecord(current, response.record))
                })
            } else {
                setSearch(response.record.name || '')
                setRecords(sortCustomers([response.record]))
            }

            handleCloseModal()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover cliente',
            message: `Remover o cliente "${form.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            handleCloseModal()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <WorkspaceCollectionShell
                tabs={[]}
                activeTab={null}
                onTabChange={() => {}}
                listTitle="Clientes"
                listIcon="fa-user-group"
                listCount={loading ? 'Buscando...' : hasSearch ? `${records.length} resultado(s)` : 'Digite o nome'}
                createLabel="Novo cliente"
                onCreate={handleCreate}
                emptyState={null}
                listChildren={(
                    <div className="ops-category-shell">
                        <section className="ops-customer-toolbar">
                            <label className="ops-category-search-field">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar cliente por nome"
                                />
                            </label>
                            <ActionButton
                                tone="ghost"
                                icon="fa-rotate-left"
                                iconOnly
                                onClick={handleClearSearch}
                                title="Limpar busca"
                                aria-label="Limpar busca"
                                disabled={!hasSearch}
                            />
                        </section>

                        {loading ? (
                            <EmptyState icon="fa-spinner fa-spin" title="Buscando clientes" text="Aguarde a consulta." />
                        ) : hasSearch ? (
                            records.length ? (
                                <div className="ops-workspace-list-stack">
                                    {records.map((record) => (
                                        <ListCard
                                            key={record.id}
                                            active={modalOpen && form.id === record.id}
                                            onClick={() => handleSelectRecord(record)}
                                            title={record.name}
                                            badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativo' : 'Inativo'}</Badge>}
                                            description={record.phone || 'Sem telefone'}
                                            meta={[`Vendas: ${record.sales_count || 0}`, `Limite: ${formatMoney(record.credit_limit || 0)}`]}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState icon="fa-user-slash" title="Nenhum cliente" text="Refine o nome pesquisado." />
                            )
                        ) : (
                            <EmptyState icon="fa-magnifying-glass" title="Busque um cliente" text="Digite o nome para listar." />
                        )}
                    </div>
                )}
            />
            <ModalForm
                open={modalOpen}
                title={form.id ? 'Editar cliente' : 'Novo cliente'}
                description="Contato e limite de credito"
                icon="fa-user-pen"
                size="sm"
                onClose={handleCloseModal}
                footer={(
                    <>
                        {form.id ? (
                            <ActionButton tone="danger" onClick={handleDelete}>
                                Excluir
                            </ActionButton>
                        ) : <span />}
                        <ActionButton form="customer-modal-form" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar cliente'}
                        </ActionButton>
                    </>
                )}
            >
                <form id="customer-modal-form" className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                    <label>
                        <FieldLabel icon="fa-user" text="Nome" />
                        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                    </label>
                    <label>
                        <FieldLabel icon="fa-phone" text="Telefone" />
                        <input value={form.phone || ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                    </label>
                    <label>
                        <FieldLabel icon="fa-credit-card" text="Limite de credito" />
                        <input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))} />
                    </label>
                    <label>
                        <FieldLabel icon="fa-toggle-on" text="Status" />
                        <select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))}>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </label>
                </form>
            </ModalForm>
        </>
    )
}

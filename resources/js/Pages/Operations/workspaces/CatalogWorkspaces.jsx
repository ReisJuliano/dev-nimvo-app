import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import { requiredMessage, validateEmail } from '@/lib/formValidation'
import { maskDocument, validateCpfOrCnpj } from '@/lib/validation'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearch, matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import ActionButton from '@/Components/UI/ActionButton'
import ActionSidebar from '@/Components/UI/ActionSidebar'
import DataTable from '@/Components/UI/DataTable'
import ModalForm from '@/Components/UI/ModalForm'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    ListCard,
    SectionTabs,
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

const SUPPLIER_STATUS_FILTERS = [
    { value: 'all', label: 'Status: todos' },
    { value: 'active', label: 'Status: ativos' },
    { value: 'inactive', label: 'Status: inativos' },
]

const SUPPLIER_PRODUCT_FILTERS = [
    { value: 'all', label: 'Produtos: todos' },
    { value: 'with-products', label: 'Com produtos' },
    { value: 'without-products', label: 'Sem produtos' },
]

const CUSTOMER_MODAL_TABS = [
    { key: 'registration', label: 'Cadastro', icon: 'fa-address-card' },
    { key: 'fiscal', label: 'Fiscal', icon: 'fa-file-invoice' },
    { key: 'address', label: 'Endereco', icon: 'fa-map-location-dot' },
    { key: 'limits', label: 'Limites', icon: 'fa-wallet' },
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
    return normalizeTextSearch(value)
}

function normalizeSupplierSearch(value) {
    return normalizeTextSearch(value)
}

function normalizeCustomerSearch(value) {
    return String(value || '').trim()
}

function normalizeCustomerSearchKey(value) {
    return normalizeTextSearch(value)
}

function resolveActiveStatusMeta(active, activeLabel = 'Ativo', inactiveLabel = 'Inativo') {
    return active
        ? { label: activeLabel, tone: 'active' }
        : { label: inactiveLabel, tone: 'inactive' }
}

function matchesCategoryView(record, activeFilter) {
    const hasProducts = Number(record.products_count || 0) > 0

    switch (activeFilter) {
        case 'active':
            return Boolean(record.active)
        case 'inactive':
            return !record.active
        case 'with-products':
            return hasProducts
        case 'without-products':
            return !hasProducts
        default:
            return true
    }
}

function matchesSupplierView(record, activeFilter) {
    const hasProducts = Number(record.products_count || 0) > 0

    switch (activeFilter) {
        case 'active':
            return Boolean(record.active)
        case 'inactive':
            return !record.active
        case 'with-products':
            return hasProducts
        case 'without-products':
            return !hasProducts
        default:
            return true
    }
}

function matchesCustomerView(record, activeFilter) {
    if (activeFilter === 'active') {
        return Boolean(record.active)
    }

    if (activeFilter === 'inactive') {
        return !record.active
    }

    return true
}

function sortSuppliers(records) {
    return [...records].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR', { sensitivity: 'base' }),
    )
}

function supplierLocationLabel(record) {
    const location = [record.city_name, record.state].filter(Boolean).join(' / ')

    return location || 'Sem localizacao'
}

function supplierSearchValues(record) {
    return [
        record.name,
        record.trade_name,
        record.document,
        record.phone,
        record.email,
        record.city_name,
        record.state,
    ]
        .filter(Boolean)
}

function matchesSupplierFilters(record, normalizedSearch, statusFilter, productFilter) {
    const matchesSearch = normalizedSearch === '' || matchesTextSearchAny(supplierSearchValues(record), normalizedSearch)
    const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? record.active : !record.active)
    const hasProducts = Number(record.products_count || 0) > 0
    const matchesProducts = productFilter === 'all'
        || (productFilter === 'with-products' ? hasProducts : !hasProducts)

    return matchesSearch && matchesStatus && matchesProducts
}

function sortCustomers(records) {
    return [...records].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR', { sensitivity: 'base' }),
    )
}

function customerListDescription(record) {
    return record.document || record.phone || record.email || 'Sem dados fiscais'
}

function customerLocationLabel(record) {
    const location = [record.city_name, record.state].filter(Boolean).join(' / ')

    return location || 'Sem endereco'
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

function supplierContactHighlights(record) {
    const highlights = []

    if (record.document) {
        highlights.push({ icon: 'fa-id-card', label: record.document })
    }

    if (record.phone) {
        highlights.push({ icon: 'fa-phone', label: record.phone })
    } else if (record.email) {
        highlights.push({ icon: 'fa-envelope', label: record.email })
    }

    if (!highlights.length) {
        highlights.push({ icon: 'fa-address-card', label: 'Sem contato' })
    }

    return highlights
}

function SupplierListCard({ record, active, onClick }) {
    const initial = String(record.trade_name || record.name || 'F').trim().charAt(0).toUpperCase() || 'F'
    const highlights = supplierContactHighlights(record)

    return (
        <button type="button" className={`ops-supplier-card ${active ? 'active' : ''}`} onClick={onClick}>
            <div className="ops-supplier-card-header">
                <span className="ops-supplier-card-avatar">{initial}</span>
                <div className="ops-supplier-card-copy">
                    <div className="ops-supplier-card-top">
                        <div className="ops-supplier-card-title">
                            <strong>{record.name}</strong>
                            {record.trade_name ? <small>{record.trade_name}</small> : null}
                        </div>
                        <Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <div className="ops-supplier-card-tags">
                        {highlights.map((item) => (
                            <span key={`${record.id}-${item.icon}-${item.label}`}>
                                <i className={`fa-solid ${item.icon}`} />
                                {item.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="ops-supplier-card-footer">
                <span>
                    <i className="fa-solid fa-location-dot" />
                    {supplierLocationLabel(record)}
                </span>
                <span>
                    <i className="fa-solid fa-boxes-stacked" />
                    {record.products_count || 0} produto(s)
                </span>
            </div>
        </button>
    )
}

export function CategoriesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', description: '', active: true }
    const [records, setRecords] = useState(payload.records || [])
    const searchControl = useConfirmedSearch('')
    const [activeFilter, setActiveFilter] = useState('all')
    const [selectedId, setSelectedId] = useState((payload.records || [])[0]?.id ?? null)
    const [form, setForm] = useState(emptyForm)
    const [modalOpen, setModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [hasLoadedRecords, setHasLoadedRecords] = useState((payload.records || []).length > 0)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const normalizedSearch = useMemo(() => normalizeCategorySearch(searchControl.value), [searchControl.value])
    const filteredRecords = useMemo(
        () => records.filter((record) => {
            const matchesSearch = normalizedSearch === ''
                || matchesTextSearchAny([record.name, record.description], normalizedSearch)

            return matchesSearch && matchesCategoryView(record, activeFilter)
        }),
        [activeFilter, normalizedSearch, records],
    )
    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedId))
            || records.find((record) => String(record.id) === String(selectedId))
            || null,
        [filteredRecords, records, selectedId],
    )
    const filterCounts = useMemo(() => ({
        all: records.length,
        active: records.filter((record) => record.active).length,
        inactive: records.filter((record) => !record.active).length,
        with_products: records.filter((record) => Number(record.products_count || 0) > 0).length,
        without_products: records.filter((record) => Number(record.products_count || 0) <= 0).length,
    }), [records])

    useEffect(() => {
        setSelectedId((current) => {
            if (current && records.some((record) => String(record.id) === String(current))) {
                return current
            }

            return records[0]?.id ?? null
        })
    }, [records])

    function handleCreate() {
        setForm(emptyForm)
        setModalOpen(true)
    }

    function openRecordModal(record = selectedRecord) {
        if (!record) {
            return
        }

        setSelectedId(record.id)
        setForm({ ...emptyForm, ...record })
        setModalOpen(true)
    }

    function handleCloseModal() {
        setForm(emptyForm)
        setModalOpen(false)
    }

    function handleClearFilters() {
        searchControl.clear()
        setActiveFilter('all')
        setRecords([])
        setSelectedId(null)
        setLoading(false)
        setHasLoadedRecords(false)
    }

    async function handleApplyFilters() {
        setLoading(true)
        setFeedback(null)

        try {
            const nextSearch = searchControl.apply()
            const response = await apiRequest(buildRecordsUrl(moduleKey), {
                params: {
                    applied: 1,
                    search: nextSearch || undefined,
                    status: activeFilter,
                },
            })

            setRecords(response.records || [])
            searchControl.sync(nextSearch)
            setSelectedId((response.records || [])[0]?.id ?? null)
            setHasLoadedRecords(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
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
            setHasLoadedRecords(true)
            setSelectedId(response.record.id)
            setForm({ ...emptyForm, ...response.record })
            setModalOpen(false)
            searchControl.sync(response.record.name || '')
            setActiveFilter('all')
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(record = form) {
        if (!record?.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover categoria',
            message: `Remover a categoria "${record.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))
            if (String(form.id) === String(record.id)) {
                handleCloseModal()
            }
            if (String(selectedId) === String(record.id)) {
                setSelectedId(null)
            }
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Categorias"
                        search={{
                            placeholder: 'Buscar categoria',
                            value: searchControl.draftValue,
                            onChange: searchControl.setDraftValue,
                            onApply: () => searchControl.apply(),
                        }}
                        filters={[
                            { key: 'all', value: 'all', label: 'Todas', count: filterCounts.all },
                            { key: 'active', value: 'active', label: 'Ativas', count: filterCounts.active },
                            { key: 'inactive', value: 'inactive', label: 'Inativas', count: filterCounts.inactive },
                            { key: 'with-products', value: 'with-products', label: 'Com produtos', count: filterCounts.with_products },
                            { key: 'without-products', value: 'without-products', label: 'Sem produtos', count: filterCounts.without_products },
                        ]}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        onApply={handleApplyFilters}
                        onReset={handleClearFilters}
                    />

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Categoria',
                                    render: (record) => <strong>{record.name}</strong>,
                                },
                                {
                                    key: 'description',
                                    label: 'Descricao',
                                    render: (record) => record.description || 'Sem descricao',
                                },
                                {
                                    key: 'products_count',
                                    label: 'Produtos',
                                    align: 'right',
                                    render: (record) => formatNumber(record.products_count || 0),
                                },
                                {
                                    key: 'stock_value',
                                    label: 'Valor em estoque',
                                    align: 'right',
                                    render: (record) => <strong>{formatMoney(record.stock_value || 0)}</strong>,
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (record) => {
                                        const statusMeta = resolveActiveStatusMeta(record.active, 'Ativa', 'Inativa')

                                        return <StatusBadge compact label={statusMeta.label} tone={statusMeta.tone} />
                                    },
                                },
                            ]}
                            rows={filteredRecords}
                            rowKey="id"
                            selectedRowKey={selectedId}
                            onRowClick={(record) => setSelectedId(record.id)}
                            emptyMessage={loading ? 'Buscando categorias' : hasLoadedRecords ? 'Nenhuma categoria encontrada' : 'Clique em Filtrar para buscar'}
                            emptyIcon={loading ? 'fa-spinner fa-spin' : 'fa-layer-group'}
                            actions={(record) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    tone: 'primary',
                                    onClick: () => openRecordModal(record),
                                },
                            ]}
                        />
                    </section>
                </div>

                <ActionSidebar
                    storageKey="operations-categories"
                    actions={[
                        {
                            key: 'create',
                            icon: 'fa-plus',
                            label: 'Nova categoria',
                            tone: 'primary',
                            onClick: handleCreate,
                        },
                        {
                            key: 'edit',
                            icon: 'fa-pen',
                            label: 'Editar',
                            disabled: !selectedRecord,
                            onClick: () => openRecordModal(selectedRecord),
                        },
                        {
                            key: 'delete',
                            icon: 'fa-trash-can',
                            label: 'Excluir',
                            tone: 'danger',
                            dividerBefore: true,
                            disabled: !selectedRecord,
                            onClick: () => handleDelete(selectedRecord),
                        },
                    ]}
                />
            </div>
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
                            <ActionButton tone="danger" onClick={() => handleDelete(form)}>
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
    const searchControl = useConfirmedSearch('')
    const [activeFilter, setActiveFilter] = useState('all')
    const [selectedId, setSelectedId] = useState((payload.records || [])[0]?.id ?? null)
    const [form, setForm] = useState(emptyForm)
    const [modalOpen, setModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [hasLoadedRecords, setHasLoadedRecords] = useState((payload.records || []).length > 0)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const normalizedSearch = useMemo(() => normalizeSupplierSearch(searchControl.value), [searchControl.value])
    const filteredRecords = useMemo(
        () => records.filter((record) => {
            const matchesSearch = normalizedSearch === '' || matchesTextSearchAny(supplierSearchValues(record), normalizedSearch)

            return matchesSearch && matchesSupplierView(record, activeFilter)
        }),
        [activeFilter, normalizedSearch, records],
    )
    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedId))
            || records.find((record) => String(record.id) === String(selectedId))
            || null,
        [filteredRecords, records, selectedId],
    )
    const filterCounts = useMemo(() => ({
        all: records.length,
        active: records.filter((record) => record.active).length,
        inactive: records.filter((record) => !record.active).length,
        with_products: records.filter((record) => Number(record.products_count || 0) > 0).length,
        without_products: records.filter((record) => Number(record.products_count || 0) <= 0).length,
    }), [records])

    useEffect(() => {
        setSelectedId((current) => {
            if (current && records.some((record) => String(record.id) === String(current))) {
                return current
            }

            return records[0]?.id ?? null
        })
    }, [records])

    function handleCreate() {
        setForm(emptyForm)
        setModalOpen(true)
    }

    function openRecordModal(record = selectedRecord) {
        if (!record) {
            return
        }

        setSelectedId(record.id)
        setForm({ ...emptyForm, ...record })
        setModalOpen(true)
    }

    function handleCloseModal() {
        setForm(emptyForm)
        setModalOpen(false)
    }

    function handleClearFilters() {
        searchControl.clear()
        setActiveFilter('all')
        setRecords([])
        setSelectedId(null)
        setLoading(false)
        setHasLoadedRecords(false)
    }

    async function handleApplyFilters() {
        setLoading(true)
        setFeedback(null)

        try {
            const nextSearch = searchControl.apply()
            const response = await apiRequest(buildRecordsUrl(moduleKey), {
                params: {
                    applied: 1,
                },
            })

            setRecords(sortSuppliers(response.records || []))
            searchControl.sync(nextSearch)
            setSelectedId((response.records || [])[0]?.id ?? null)
            setHasLoadedRecords(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: form })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: form })
            setRecords((current) => sortSuppliers(upsertRecord(current, response.record)))
            setHasLoadedRecords(true)
            setSelectedId(response.record.id)
            handleCloseModal()
            searchControl.sync(response.record.name || '')
            setActiveFilter('all')
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(record = form) {
        if (!record?.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover fornecedor',
            message: `Remover o fornecedor "${record.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))
            if (String(form.id) === String(record.id)) {
                handleCloseModal()
            }
            if (String(selectedId) === String(record.id)) {
                setSelectedId(null)
            }
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Fornecedores"
                        search={{
                            placeholder: 'Buscar fornecedor',
                            value: searchControl.draftValue,
                            onChange: searchControl.setDraftValue,
                            onApply: () => searchControl.apply(),
                        }}
                        filters={[
                            { key: 'all', value: 'all', label: 'Todos', count: filterCounts.all },
                            { key: 'active', value: 'active', label: 'Ativos', count: filterCounts.active },
                            { key: 'inactive', value: 'inactive', label: 'Inativos', count: filterCounts.inactive },
                            { key: 'with-products', value: 'with-products', label: 'Com produtos', count: filterCounts.with_products },
                            { key: 'without-products', value: 'without-products', label: 'Sem produtos', count: filterCounts.without_products },
                        ]}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        onApply={handleApplyFilters}
                        onReset={handleClearFilters}
                    />

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Fornecedor',
                                    render: (record) => (
                                        <div>
                                            <strong>{record.name}</strong>
                                            {record.trade_name ? <small>{record.trade_name}</small> : null}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'document',
                                    label: 'Documento',
                                    render: (record) => record.document || 'Nao informado',
                                },
                                {
                                    key: 'location',
                                    label: 'Cidade / UF',
                                    render: (record) => supplierLocationLabel(record),
                                },
                                {
                                    key: 'contact',
                                    label: 'Contato',
                                    render: (record) => record.phone || record.email || 'Sem contato',
                                },
                                {
                                    key: 'products_count',
                                    label: 'Produtos',
                                    align: 'right',
                                    render: (record) => formatNumber(record.products_count || 0),
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (record) => {
                                        const statusMeta = resolveActiveStatusMeta(record.active)

                                        return <StatusBadge compact label={statusMeta.label} tone={statusMeta.tone} />
                                    },
                                },
                            ]}
                            rows={filteredRecords}
                            rowKey="id"
                            selectedRowKey={selectedId}
                            onRowClick={(record) => setSelectedId(record.id)}
                            emptyMessage={loading ? 'Buscando fornecedores' : hasLoadedRecords ? 'Nenhum fornecedor encontrado' : 'Clique em Filtrar para buscar'}
                            emptyIcon={loading ? 'fa-spinner fa-spin' : 'fa-building'}
                            actions={(record) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    tone: 'primary',
                                    onClick: () => openRecordModal(record),
                                },
                            ]}
                        />
                    </section>
                </div>

                <ActionSidebar
                    storageKey="operations-suppliers"
                    actions={[
                        {
                            key: 'create',
                            icon: 'fa-plus',
                            label: 'Novo fornecedor',
                            tone: 'primary',
                            onClick: handleCreate,
                        },
                        {
                            key: 'edit',
                            icon: 'fa-pen',
                            label: 'Editar',
                            disabled: !selectedRecord,
                            onClick: () => openRecordModal(selectedRecord),
                        },
                        {
                            key: 'delete',
                            icon: 'fa-trash-can',
                            label: 'Excluir',
                            tone: 'danger',
                            dividerBefore: true,
                            disabled: !selectedRecord,
                            onClick: () => handleDelete(selectedRecord),
                        },
                    ]}
                />
            </div>
            <ModalForm
                open={modalOpen}
                title={form.id ? 'Editar fornecedor' : 'Novo fornecedor'}
                description="Cadastro e contato"
                icon="fa-truck-ramp-box"
                size="lg"
                onClose={handleCloseModal}
                footer={(
                    <>
                        {form.id ? (
                            <ActionButton tone="danger" onClick={() => handleDelete(form)}>
                                Excluir
                            </ActionButton>
                        ) : <span />}
                        <ActionButton form="supplier-modal-form" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar fornecedor'}
                        </ActionButton>
                    </>
                )}
            >
                <form id="supplier-modal-form" className="ops-workspace-form-grid" onSubmit={handleSubmit}>
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
                    <label>
                        <FieldLabel icon="fa-toggle-on" text="Status" />
                        <select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))}>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </label>
                    <label className="span-2">
                        <FieldLabel icon="fa-envelope" text="E-mail" />
                        <input type="email" value={form.email || ''} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                    </label>
                </form>
            </ModalForm>
        </>
    )
}

export function CustomersWorkspace({ moduleKey, payload }) {
    const emptyForm = {
        id: null,
        name: '',
        document: '',
        phone: '',
        email: '',
        state_registration: '',
        street: '',
        number: '',
        complement: '',
        district: '',
        city_name: '',
        city_code: '',
        state: '',
        zip_code: '',
        consumer_final: true,
        credit_limit: '0',
        active: true,
    }
    const [records, setRecords] = useState(payload.records || [])
    const searchControl = useConfirmedSearch('')
    const [activeFilter, setActiveFilter] = useState('all')
    const [selectedId, setSelectedId] = useState((payload.records || [])[0]?.id ?? null)
    const [form, setForm] = useState(emptyForm)
    const [modalOpen, setModalOpen] = useState(false)
    const [activeModalTab, setActiveModalTab] = useState('registration')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const requestIdRef = useRef(0)
    const normalizedSearch = useMemo(() => normalizeCustomerSearch(searchControl.value), [searchControl.value])
    const normalizedSearchKey = useMemo(() => normalizeCustomerSearchKey(searchControl.value), [searchControl.value])
    const hasSearch = normalizedSearch !== ''
    const filteredRecords = useMemo(
        () => records.filter((record) => matchesCustomerView(record, activeFilter)),
        [activeFilter, records],
    )
    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedId))
            || records.find((record) => String(record.id) === String(selectedId))
            || null,
        [filteredRecords, records, selectedId],
    )
    const filterCounts = useMemo(() => ({
        all: records.length,
        active: records.filter((record) => record.active).length,
        inactive: records.filter((record) => !record.active).length,
    }), [records])

    useEffect(() => {
        setSelectedId((current) => {
            if (current && records.some((record) => String(record.id) === String(current))) {
                return current
            }

            return records[0]?.id ?? null
        })
    }, [records])

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
            document: String(record?.document || ''),
            phone: String(record?.phone || ''),
            email: String(record?.email || ''),
            state_registration: String(record?.state_registration || ''),
            street: String(record?.street || ''),
            number: String(record?.number || ''),
            complement: String(record?.complement || ''),
            district: String(record?.district || ''),
            city_name: String(record?.city_name || ''),
            city_code: String(record?.city_code || ''),
            state: String(record?.state || ''),
            zip_code: String(record?.zip_code || ''),
            consumer_final: record?.consumer_final ?? true,
            credit_limit: String(record?.credit_limit || 0),
        }
    }

    function recordMatchesSearch(record) {
        if (!normalizedSearchKey) {
            return true
        }

        return matchesTextSearch(record?.name, normalizedSearchKey)
    }

    function handleSelectRecord(record) {
        setSelectedId(record.id)
        setForm(buildCustomerForm(record))
        setActiveModalTab('registration')
        setModalOpen(true)
    }

    function handleCreate() {
        setForm(buildCustomerForm())
        setActiveModalTab('registration')
        setModalOpen(true)
    }

    function handleCloseModal() {
        setForm(buildCustomerForm())
        setActiveModalTab('registration')
        setModalOpen(false)
    }

    function handleClearSearch() {
        requestIdRef.current += 1
        searchControl.clear()
        setActiveFilter('all')
        setRecords([])
        setLoading(false)
    }

    function handleSearchApply() {
        const nextSearch = searchControl.apply()

        if (normalizeCustomerSearch(nextSearch) === '') {
            requestIdRef.current += 1
            setRecords([])
            setLoading(false)
        }
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setFeedback(null)

        const requiredError = requiredMessage(form.name, 'o nome do cliente')
        if (requiredError) {
            setFeedback({ type: 'warning', text: requiredError })
            return
        }

        if (form.document && !validateCpfOrCnpj(form.document)) {
            setFeedback({ type: 'warning', text: 'CPF ou CNPJ inválido. Verifique os dígitos informados.' })
            return
        }

        if (!validateEmail(form.email)) {
            setFeedback({ type: 'warning', text: 'Informe um endereço de e-mail válido.' })
            return
        }

        setSaving(true)
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
                searchControl.sync(response.record.name || '')
                setRecords(sortCustomers([response.record]))
            }

            setSelectedId(response.record.id)
            setActiveFilter('all')
            handleCloseModal()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(record = form) {
        if (!record?.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover cliente',
            message: `Remover o cliente "${record.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))
            if (String(form.id) === String(record.id)) {
                handleCloseModal()
            }
            if (String(selectedId) === String(record.id)) {
                setSelectedId(null)
            }
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Clientes"
                        search={{
                            placeholder: 'Buscar cliente por nome',
                            value: searchControl.draftValue,
                            onChange: searchControl.setDraftValue,
                            onApply: handleSearchApply,
                        }}
                        filters={[
                            { key: 'all', value: 'all', label: 'Todos', count: filterCounts.all },
                            { key: 'active', value: 'active', label: 'Ativos', count: filterCounts.active },
                            { key: 'inactive', value: 'inactive', label: 'Inativos', count: filterCounts.inactive },
                        ]}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        onReset={handleClearSearch}
                    />

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Cliente',
                                    render: (record) => <strong>{record.name}</strong>,
                                },
                                {
                                    key: 'document',
                                    label: 'Documento',
                                    render: (record) => record.document || 'Nao informado',
                                },
                                {
                                    key: 'contact',
                                    label: 'Contato',
                                    render: (record) => customerListDescription(record),
                                },
                                {
                                    key: 'location',
                                    label: 'Cidade / UF',
                                    render: (record) => customerLocationLabel(record),
                                },
                                {
                                    key: 'credit_limit',
                                    label: 'Limite',
                                    align: 'right',
                                    render: (record) => <strong>{formatMoney(record.credit_limit || 0)}</strong>,
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (record) => {
                                        const statusMeta = resolveActiveStatusMeta(record.active)

                                        return <StatusBadge compact label={statusMeta.label} tone={statusMeta.tone} />
                                    },
                                },
                            ]}
                            rows={filteredRecords}
                            rowKey="id"
                            selectedRowKey={selectedId}
                            onRowClick={(record) => setSelectedId(record.id)}
                            emptyMessage={loading ? 'Buscando clientes' : hasSearch ? 'Nenhum cliente encontrado' : 'Busque um cliente pelo nome'}
                            emptyIcon={loading ? 'fa-spinner fa-spin' : 'fa-user-group'}
                            actions={(record) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    tone: 'primary',
                                    onClick: () => handleSelectRecord(record),
                                },
                            ]}
                        />
                    </section>
                </div>

                <ActionSidebar
                    storageKey="operations-customers"
                    actions={[
                        {
                            key: 'create',
                            icon: 'fa-plus',
                            label: 'Novo cliente',
                            tone: 'primary',
                            onClick: handleCreate,
                        },
                        {
                            key: 'edit',
                            icon: 'fa-pen',
                            label: 'Editar',
                            disabled: !selectedRecord,
                            onClick: () => selectedRecord && handleSelectRecord(selectedRecord),
                        },
                        {
                            key: 'delete',
                            icon: 'fa-trash-can',
                            label: 'Excluir',
                            tone: 'danger',
                            dividerBefore: true,
                            disabled: !selectedRecord,
                            onClick: () => handleDelete(selectedRecord),
                        },
                    ]}
                />
            </div>
            <ModalForm
                open={modalOpen}
                title={form.id ? 'Editar cliente' : 'Novo cliente'}
                description="Dados cadastrais, fiscais e endereco"
                icon="fa-user-pen"
                size="lg"
                onClose={handleCloseModal}
                footer={(
                    <>
                        {form.id ? (
                            <ActionButton tone="danger" onClick={() => handleDelete(form)}>
                                Excluir
                            </ActionButton>
                        ) : <span />}
                        <ActionButton form="customer-modal-form" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar cliente'}
                        </ActionButton>
                    </>
                )}
            >
                <form id="customer-modal-form" className="ops-customer-modal-shell" onSubmit={handleSubmit} noValidate>
                    <SectionTabs tabs={CUSTOMER_MODAL_TABS} activeTab={activeModalTab} onChange={setActiveModalTab} />

                    {activeModalTab === 'registration' ? (
                        <div className="ops-workspace-form-grid">
                            <label>
                                <FieldLabel icon="fa-user" text="Nome" />
                                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-id-card" text="CPF ou CNPJ" />
                                <input value={form.document} onChange={(event) => setForm((current) => ({ ...current, document: maskDocument(event.target.value) }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-phone" text="Telefone" />
                                <input value={form.phone || ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-envelope" text="E-mail" />
                                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-circle-check" text="Status" />
                                <select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))}>
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Inativo</option>
                                </select>
                            </label>
                        </div>
                    ) : null}

                    {activeModalTab === 'fiscal' ? (
                        <div className="ops-workspace-form-grid">
                            <label>
                                <FieldLabel icon="fa-user-check" text="Consumidor final" />
                                <select value={form.consumer_final ? 'yes' : 'no'} onChange={(event) => setForm((current) => ({ ...current, consumer_final: event.target.value === 'yes' }))}>
                                    <option value="yes">Sim</option>
                                    <option value="no">Nao</option>
                                </select>
                            </label>
                            <label>
                                <FieldLabel icon="fa-file-lines" text="Inscricao estadual" />
                                <input value={form.state_registration} onChange={(event) => setForm((current) => ({ ...current, state_registration: event.target.value }))} />
                            </label>
                        </div>
                    ) : null}

                    {activeModalTab === 'address' ? (
                        <div className="ops-workspace-form-grid">
                            <label className="span-2">
                                <FieldLabel icon="fa-road" text="Logradouro" />
                                <input value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-house" text="Numero" />
                                <input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-plus" text="Complemento" />
                                <input value={form.complement} onChange={(event) => setForm((current) => ({ ...current, complement: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-map" text="Bairro" />
                                <input value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-city" text="Cidade" />
                                <input value={form.city_name} onChange={(event) => setForm((current) => ({ ...current, city_name: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-map-pin" text="Codigo IBGE" />
                                <input value={form.city_code} onChange={(event) => setForm((current) => ({ ...current, city_code: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-flag" text="UF" />
                                <input maxLength="2" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} />
                            </label>
                            <label className="span-2">
                                <FieldLabel icon="fa-location-dot" text="CEP" />
                                <input value={form.zip_code} onChange={(event) => setForm((current) => ({ ...current, zip_code: event.target.value }))} />
                            </label>
                        </div>
                    ) : null}

                    {activeModalTab === 'limits' ? (
                        <div className="ops-workspace-form-grid">
                            <label>
                                <FieldLabel icon="fa-wallet" text="Limite de credito" />
                                <input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))} />
                            </label>
                        </div>
                    ) : null}
                </form>
            </ModalForm>
        </>
    )
}

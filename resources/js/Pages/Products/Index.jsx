import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import AppLayout from '@/Layouts/AppLayout'
import ProductFormModal from '@/Components/Products/ProductFormModal'
import useResetPageHistoryOnLeave from '@/hooks/useResetPageHistoryOnLeave'
import { confirmPopup, showErrorPopup, showPopup } from '@/lib/errorPopup'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import { replaceCurrentInertiaHistoryPage } from '@/lib/inertiaHistory'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearch, matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import {
    configureOfflineWorkspaceBridge,
    getOfflineWorkspaceSnapshot,
    hasOfflineWorkspaceData,
    hydrateOfflineWorkspace,
    removeOfflineProduct,
    resolveOfflineEntityId,
    seedOfflineWorkspace,
    subscribeOfflineWorkspace,
    syncOfflineWorkspace,
    upsertOfflineProduct,
} from '@/lib/offline/workspace'
import './products.css'

function normalizeProductRecord(product) {
    return {
        ...product,
        category_id: product.category_id ?? product.category?.id ?? null,
        supplier_id: product.supplier_id ?? product.supplier?.id ?? null,
        category_name: product.category_name ?? product.category?.name ?? null,
        supplier_name: product.supplier_name ?? product.supplier?.name ?? null,
        cost_price: Number(product.cost_price || 0),
        sale_price: Number(product.sale_price || 0),
        stock_quantity: Number(product.stock_quantity || 0),
        min_stock: Number(product.min_stock || 0),
        icms_rate: product.icms_rate === null || product.icms_rate === undefined || product.icms_rate === '' ? null : Number(product.icms_rate),
        pis_rate: product.pis_rate === null || product.pis_rate === undefined || product.pis_rate === '' ? null : Number(product.pis_rate),
        cofins_rate: product.cofins_rate === null || product.cofins_rate === undefined || product.cofins_rate === '' ? null : Number(product.cofins_rate),
        ipi_rate: product.ipi_rate === null || product.ipi_rate === undefined || product.ipi_rate === '' ? null : Number(product.ipi_rate),
        fiscal_enabled: product.fiscal_enabled !== false,
        active: product.active !== false,
    }
}

function getSearchableValues(product) {
    return [
        product.name,
        product.code,
        product.barcode,
        product.category_name,
        product.supplier_name,
    ]
        .filter(Boolean)
}

function getProductSearchScore(product, searchTerm) {
    const normalizedSearch = normalizeTextSearch(searchTerm)
    const code = String(product.code || '').toLowerCase()
    const barcode = String(product.barcode || '').toLowerCase()
    const name = String(product.name || '').toLowerCase()
    const usesWildcard = normalizedSearch.includes('%')

    if (!usesWildcard && [code, barcode].includes(normalizedSearch)) return 0
    if (!usesWildcard && name === normalizedSearch) return 1
    if (matchesTextSearchAny([code, barcode], normalizedSearch)) return 2
    if (matchesTextSearch(name, normalizedSearch)) return 3
    return 4
}

function isLowStock(product) {
    return Number(product.stock_quantity || 0) <= Number(product.min_stock || 0)
}

function getProductStatusMeta(product) {
    if (!product.active) {
        return { label: 'Inativo', tone: 'inactive' }
    }

    if (Number(product.stock_quantity || 0) <= 0) {
        return { label: 'Sem estoque', tone: 'danger' }
    }

    if (isLowStock(product)) {
        return { label: 'Produtos acabando', tone: 'warning' }
    }

    return { label: 'Ativo', tone: 'active' }
}

export default function ProductsIndex({ products, categories, suppliers, filters = {} }) {
    const { tenant, localAgentBridge } = usePage().props
    const tenantId = tenant?.id
    const hasAppliedFilters = Boolean(filters?.applied)
    const [collectionItems, setCollectionItems] = useState((products || []).map((product) => normalizeProductRecord(product)))
    const [categoryOptions, setCategoryOptions] = useState(categories || [])
    const [supplierOptions, setSupplierOptions] = useState(suppliers || [])
    const searchControl = useConfirmedSearch(filters?.search || '')
    const [activeFilter, setActiveFilter] = useState('all')
    const [selectedProductId, setSelectedProductId] = useState((products || [])[0]?.id ?? null)
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [saving, setSaving] = useState(false)
    const deferredSearch = useDeferredValue(searchControl.value)
    const normalizedSearch = normalizeTextSearch(deferredSearch)

    const visibleCollectionItems = useMemo(
        () => (hasAppliedFilters ? collectionItems : []),
        [collectionItems, hasAppliedFilters],
    )

    const resetHistoryEntry = useCallback(() => {
        replaceCurrentInertiaHistoryPage((page) => ({
            ...page,
            url: '/produtos',
            props: {
                ...page.props,
                filters: {
                    applied: false,
                    search: '',
                },
            },
        }), '/produtos')
    }, [])

    useResetPageHistoryOnLeave(resetHistoryEntry)

    useEffect(() => {
        if (!tenantId) {
            return undefined
        }

        let cancelled = false
        let unsubscribe = () => {}

        const applyWorkspaceState = (state) => {
            setCollectionItems(state.catalogs.products.map((product) => normalizeProductRecord(product)))
            setCategoryOptions(state.catalogs.categories)
            setSupplierOptions(state.catalogs.suppliers)
            setSelectedProduct((current) => {
                if (!current) {
                    return current
                }

                return state.catalogs.products.find((product) => String(product.id) === String(current.id)) || current
            })
        }

        const handleOnline = () => {
            syncOfflineWorkspace(tenantId, apiRequest).catch(() => {})
        }

        const bootstrap = async () => {
            configureOfflineWorkspaceBridge(tenantId, localAgentBridge)
            await hydrateOfflineWorkspace(tenantId).catch(() => {})

            if (cancelled) {
                return
            }

            const shouldSeedSnapshot =
                typeof navigator === 'undefined'
                || navigator.onLine !== false
                || !hasOfflineWorkspaceData(tenantId)

            if (shouldSeedSnapshot) {
                seedOfflineWorkspace(tenantId, {
                    products,
                    categories,
                    suppliers,
                })
            }

            if (cancelled) {
                return
            }

            applyWorkspaceState(getOfflineWorkspaceSnapshot(tenantId))
            unsubscribe = subscribeOfflineWorkspace(tenantId, ({ state }) => {
                applyWorkspaceState(state)
            })
            handleOnline()
        }

        bootstrap()
        window.addEventListener('online', handleOnline)

        return () => {
            cancelled = true
            unsubscribe()
            window.removeEventListener('online', handleOnline)
        }
    }, [categories, localAgentBridge, products, suppliers, tenantId])

    useEffect(() => {
        setSelectedProductId((current) => {
            if (current && collectionItems.some((product) => String(product.id) === String(current))) {
                return current
            }

            return collectionItems[0]?.id ?? null
        })
    }, [collectionItems])

    const filteredProducts = useMemo(() => {
        return visibleCollectionItems
            .filter((product) => {
                const matchesSearch = normalizedSearch === '' || matchesTextSearchAny(getSearchableValues(product), normalizedSearch)
                const matchesStatus = activeFilter === 'all'
                    || (activeFilter === 'active' ? product.active : !product.active)
                    || (activeFilter === 'low_stock' ? isLowStock(product) : false)

                return matchesSearch && matchesStatus
            })
            .sort((left, right) => {
                const score = normalizedSearch === ''
                    ? 0
                    : getProductSearchScore(left, normalizedSearch) - getProductSearchScore(right, normalizedSearch)

                if (score !== 0) {
                    return score
                }

                return String(left.name || '').localeCompare(String(right.name || ''))
            })
    }, [activeFilter, normalizedSearch, visibleCollectionItems])

    const selectedRow = useMemo(
        () => filteredProducts.find((product) => String(product.id) === String(selectedProductId))
            || visibleCollectionItems.find((product) => String(product.id) === String(selectedProductId))
            || null,
        [filteredProducts, selectedProductId, visibleCollectionItems],
    )

    const filterCounts = useMemo(() => ({
        all: visibleCollectionItems.length,
        active: visibleCollectionItems.filter((product) => product.active).length,
        low_stock: visibleCollectionItems.filter((product) => isLowStock(product)).length,
        inactive: visibleCollectionItems.filter((product) => !product.active).length,
    }), [visibleCollectionItems])

    function handleCreate() {
        setSelectedProductId(null)
        setSelectedProduct(null)
        setModalOpen(true)
    }

    function handleEdit(product) {
        setSelectedProductId(product.id)
        setSelectedProduct(product)
        setModalOpen(true)
    }

    function handleResetFilters() {
        searchControl.clear()
        setActiveFilter('all')
        router.get('/produtos', {}, {
            preserveScroll: true,
            replace: true,
        })
    }

    function handleApplyFilters() {
        const nextSearch = searchControl.apply()
        const params = {}

        if (String(nextSearch || '').trim()) {
            params.search = String(nextSearch).trim()
        }

        params.applied = 1

        router.get('/produtos', params, {
            preserveScroll: true,
            replace: true,
        })
    }

    async function handleDelete(product) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Desativar produto',
            message: `Deseja desativar o produto "${product.name}"?`,
            confirmLabel: 'Desativar',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                removeOfflineProduct(tenantId, product.id)
                showPopup({
                    type: 'warning',
                    title: 'Produto salvo offline',
                    message: `O produto "${product.name}" foi removido da operação local e entrará na fila de sincronizaç?.`,
                })
                return
            }

            const response = await apiRequest(`/api/products/${resolveOfflineEntityId(tenantId, 'products', product.id)}`, { method: 'delete' })
            const nextItems = collectionItems.filter((entry) => entry.id !== product.id)
            setCollectionItems(nextItems)
            if (String(selectedProductId) === String(product.id)) {
                setSelectedProductId(nextItems[0]?.id ?? null)
            }
            seedOfflineWorkspace(tenantId, {
                products: nextItems,
                categories: categoryOptions,
                suppliers: supplierOptions,
            })
            showPopup({
                type: 'success',
                title: 'Produto desativado',
                message: response.message || `O produto "${product.name}" foi desativado com sucesso.`,
            })
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                removeOfflineProduct(tenantId, product.id)
                showPopup({
                    type: 'warning',
                    title: 'Produto salvo offline',
                    message: `O produto "${product.name}" foi removido da operação local e entrará na fila de sincronizaç?.`,
                })
            } else {
                showErrorPopup(error.message)
            }
        }
    }

    async function handleSubmit(form) {
        setSaving(true)

        try {
            const payload = {
                ...form,
                name: form.name?.trim() || '',
                barcode: form.barcode?.trim() || null,
                category_id: form.category_id ? Number(form.category_id) : null,
                supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
                internal_notes: form.internal_notes?.trim() || null,
                ncm: form.ncm?.trim() || null,
                cfop: form.cfop?.trim() || null,
                cest: form.cest?.trim() || null,
                origin_code: form.origin_code?.trim() || '0',
                icms_csosn: form.icms_csosn?.trim() || '102',
                pis_cst: form.pis_cst?.trim() || '49',
                cofins_cst: form.cofins_cst?.trim() || '49',
                fiscal_enabled: Boolean(form.fiscal_enabled),
                commercial_unit: form.commercial_unit?.trim() || form.unit?.trim() || 'UN',
                taxable_unit: form.taxable_unit?.trim() || form.commercial_unit?.trim() || form.unit?.trim() || 'UN',
                cost_price: form.cost_price === '' ? null : Number(form.cost_price),
                sale_price: form.sale_price === '' ? null : Number(form.sale_price),
                min_stock: Number(form.min_stock || 0),
                icms_rate: form.icms_rate === '' ? null : Number(form.icms_rate),
                pis_rate: form.pis_rate === '' ? null : Number(form.pis_rate),
                cofins_rate: form.cofins_rate === '' ? null : Number(form.cofins_rate),
                ipi_rate: form.ipi_rate === '' ? null : Number(form.ipi_rate),
                active: Boolean(form.active),
            }
            const category = categoryOptions.find((option) => String(option.id) === String(payload.category_id))
            const supplier = supplierOptions.find((option) => String(option.id) === String(payload.supplier_id))

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                upsertOfflineProduct(tenantId, {
                    ...payload,
                    id: form.id ? Number(form.id) : null,
                    category_name: category?.name || null,
                    supplier_name: supplier?.name || null,
                })
                setModalOpen(false)
                setSelectedProduct(null)
                showPopup({
                    type: 'warning',
                    title: 'Produto salvo offline',
                    message: `O produto "${payload.name}" foi guardado nesta máquina e será sincronizado quando a internet voltar.`,
                })
                return
            }

            if (form.id) {
                const response = await apiRequest(`/api/products/${resolveOfflineEntityId(tenantId, 'products', form.id)}`, { method: 'put', data: payload })
                const normalized = normalizeProductRecord(response.product)
                const nextItems = collectionItems.map((entry) => (entry.id === normalized.id ? normalized : entry))
                setCollectionItems(nextItems)
                setSelectedProductId(normalized.id)
                seedOfflineWorkspace(tenantId, {
                    products: nextItems,
                    categories: categoryOptions,
                    suppliers: supplierOptions,
                })
            } else {
                const response = await apiRequest('/api/products', { method: 'post', data: payload })
                const normalized = normalizeProductRecord(response.product)
                const nextItems = [normalized, ...collectionItems]
                setCollectionItems(nextItems)
                setSelectedProductId(normalized.id)
                seedOfflineWorkspace(tenantId, {
                    products: nextItems,
                    categories: categoryOptions,
                    suppliers: supplierOptions,
                })
            }

            setModalOpen(false)
            setSelectedProduct(null)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const payload = {
                    ...form,
                    id: form.id ? Number(form.id) : null,
                    category_id: form.category_id ? Number(form.category_id) : null,
                    supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
                }
                const category = categoryOptions.find((option) => String(option.id) === String(payload.category_id))
                const supplier = supplierOptions.find((option) => String(option.id) === String(payload.supplier_id))

                upsertOfflineProduct(tenantId, {
                    ...payload,
                    category_name: category?.name || null,
                    supplier_name: supplier?.name || null,
                })
                setModalOpen(false)
                setSelectedProduct(null)
                showPopup({
                    type: 'warning',
                    title: 'Produto salvo offline',
                    message: `O produto "${payload.name}" foi guardado nesta máquina e será sincronizado quando a internet voltar.`,
                })
                return
            }

            throw error
        } finally {
            setSaving(false)
        }
    }

    async function handleQuickCreateCategory(data) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('Criação rápida de categoria exige conexão ativa.')
        }

        const response = await apiRequest('/api/operations/categorias/records', {
            method: 'post',
            data,
        })

        const record = response.record
        const nextCategories = [...categoryOptions, { id: record.id, name: record.name }].sort((left, right) =>
            String(left.name).localeCompare(String(right.name)),
        )
        setCategoryOptions(nextCategories)
        seedOfflineWorkspace(tenantId, {
            products: collectionItems,
            categories: nextCategories,
            suppliers: supplierOptions,
        })

        return record
    }

    async function handleQuickCreateSupplier(data) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('Criação rápida de fornecedor exige conexão ativa.')
        }

        const response = await apiRequest('/api/operations/fornecedores/records', {
            method: 'post',
            data,
        })

        const record = response.record
        const nextSuppliers = [...supplierOptions, { id: record.id, name: record.name }].sort((left, right) =>
            String(left.name).localeCompare(String(right.name)),
        )
        setSupplierOptions(nextSuppliers)
        seedOfflineWorkspace(tenantId, {
            products: collectionItems,
            categories: categoryOptions,
            suppliers: nextSuppliers,
        })

        return record
    }

    const totalCatalogValue = useMemo(
        () => visibleCollectionItems.reduce((sum, p) => sum + Number(p.sale_price || 0), 0),
        [visibleCollectionItems],
    )

    const detailProduct = selectedRow
    const detailInitial = detailProduct ? (detailProduct.name || '?').slice(0, 2).toUpperCase() : ''
    const detailStatus = detailProduct ? getProductStatusMeta(detailProduct) : null
    const detailLow = detailProduct ? isLowStock(detailProduct) : false
    const detailMargin = detailProduct && Number(detailProduct.sale_price || 0) > 0
        ? ((Number(detailProduct.sale_price || 0) - Number(detailProduct.cost_price || 0)) / Number(detailProduct.sale_price)) * 100
        : 0

    const filtersList = [
        { key: 'all', label: 'Todos', count: hasAppliedFilters ? filterCounts.all : visibleCollectionItems.length },
        { key: 'active', label: 'Ativos', count: filterCounts.active },
        { key: 'inactive', label: 'Inativos', count: filterCounts.inactive },
    ]

    return (
        <AppLayout title="Produtos">
            <div className="prd-page">

                {/* Topbar */}
                <div className="prd-topbar">
                    <div className="prd-topbar-left">
                        <div className="prd-topbar-icon">
                            <i className="fa-solid fa-boxes-stacked" />
                        </div>
                        <div>
                            <h1 className="prd-topbar-title">Produtos</h1>
                            <p className="prd-topbar-sub">Catálogo da loja</p>
                        </div>
                    </div>

                    <div className="prd-topbar-stats">
                        <div className="prd-stat-pill">
                            <strong>{visibleCollectionItems.length}</strong>
                            <span>Total</span>
                        </div>
                        <div className="prd-stat-pill prd-stat-pill--value">
                            <strong>{formatMoney(totalCatalogValue)}</strong>
                            <span>Valor em catálogo</span>
                        </div>
                    </div>

                    <button className="prd-topbar-cta" onClick={handleCreate} type="button">
                        <i className="fa-solid fa-plus" />
                        Novo produto
                    </button>
                </div>

                {/* Split layout */}
                <div className="prd-split">

                    {/* Painel esquerdo — lista */}
                    <div className="prd-list-panel">

                        {/* Busca */}
                        <div className="prd-search-row">
                            <label className="prd-search-wrap">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    className="prd-search-input"
                                    placeholder="Nome, código ou EAN..."
                                    value={searchControl.draftValue}
                                    onChange={(e) => searchControl.setDraftValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                />
                            </label>
                            <button type="button" className="prd-filter-btn" onClick={handleApplyFilters}>Filtrar</button>
                            <button type="button" className="prd-reset-btn" onClick={handleResetFilters}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>

                        {/* Tabs de status */}
                        <div className="prd-filter-tabs">
                            {filtersList.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    className={`prd-filter-tab ${activeFilter === f.key ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(f.key)}
                                >
                                    {f.label}
                                    {f.count != null ? <span>{f.count}</span> : null}
                                </button>
                            ))}
                        </div>

                        {/* Lista de produtos */}
                        {filteredProducts.length > 0 ? (
                            <div className="prd-list">
                                {filteredProducts.map((product) => {
                                    const low = isLowStock(product)
                                    const initial = (product.name || '?').slice(0, 2).toUpperCase()
                                    const isActive = String(selectedProductId) === String(product.id)

                                    return (
                                        <button
                                            key={product.id}
                                            type="button"
                                            className={`prd-list-row ${isActive ? 'active' : ''} ${!product.active ? 'inactive' : ''}`}
                                            onClick={() => setSelectedProductId(product.id)}
                                        >
                                            <div className={`prd-list-avatar ${low ? 'warn' : ''} ${!product.active ? 'muted' : ''}`}>
                                                {initial}
                                            </div>
                                            <div className="prd-list-info">
                                                <strong>{product.name}</strong>
                                                <small>{product.category_name || 'Sem categoria'}</small>
                                            </div>
                                            <div className="prd-list-right">
                                                <span className="prd-list-price">{formatMoney(product.sale_price || 0)}</span>
                                                {low ? (
                                                    <span className="prd-list-stock-warn">
                                                        <i className="fa-solid fa-triangle-exclamation" />
                                                        {formatNumber(product.stock_quantity || 0)}
                                                    </span>
                                                ) : (
                                                    <span className="prd-list-stock">
                                                        {formatNumber(product.stock_quantity || 0)} {product.unit || 'UN'}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="prd-list-empty">
                                <i className="fa-solid fa-box-open" />
                                <strong>{hasAppliedFilters ? 'Nenhum produto encontrado' : 'Filtre para ver produtos'}</strong>
                                <small>{hasAppliedFilters ? 'Tente outro filtro ou clique em Limpar.' : 'Use a busca acima ou clique em Filtrar.'}</small>
                            </div>
                        )}
                    </div>

                    {/* Painel direito — detalhe */}
                    <div className="prd-detail-panel">
                        {detailProduct ? (
                            <>
                                {/* Header do produto */}
                                <div className="prd-detail-head">
                                    <div className={`prd-detail-avatar ${detailLow ? 'warn' : ''} ${!detailProduct.active ? 'muted' : ''}`}>
                                        {detailInitial}
                                    </div>
                                    <div className="prd-detail-head-info">
                                        <h2>{detailProduct.name}</h2>
                                        <span>{detailProduct.category_name || 'Sem categoria'}</span>
                                    </div>
                                    <span className={`prd-status-chip prd-status-chip--${detailStatus?.tone}`}>
                                        {detailStatus?.label}
                                    </span>
                                </div>

                                {/* Seção: Preços */}
                                <div className="prd-detail-section">
                                    <div className="prd-detail-section-title">
                                        <i className="fa-solid fa-tag" />
                                        Preços
                                    </div>
                                    <div className="prd-detail-kpis">
                                        <div className="prd-detail-kpi prd-detail-kpi--primary">
                                            <span>Preço de venda</span>
                                            <strong>{formatMoney(detailProduct.sale_price || 0)}</strong>
                                        </div>
                                        <div className="prd-detail-kpi">
                                            <span>Custo</span>
                                            <strong>{formatMoney(detailProduct.cost_price || 0)}</strong>
                                        </div>
                                        <div className="prd-detail-kpi">
                                            <span>Margem</span>
                                            <strong>{formatNumber(detailMargin)}%</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Seção: Estoque */}
                                <div className="prd-detail-section">
                                    <div className="prd-detail-section-title">
                                        <i className="fa-solid fa-box" />
                                        Estoque
                                    </div>
                                    <div className="prd-detail-kpis">
                                        <div className={`prd-detail-kpi ${detailLow ? 'prd-detail-kpi--warn' : 'prd-detail-kpi--primary'}`}>
                                            <span>Em estoque</span>
                                            <strong>{formatNumber(detailProduct.stock_quantity || 0)} {detailProduct.unit || 'UN'}</strong>
                                        </div>
                                        <div className="prd-detail-kpi">
                                            <span>Estoque mínimo</span>
                                            <strong>{formatNumber(detailProduct.min_stock || 0)} {detailProduct.unit || 'UN'}</strong>
                                        </div>
                                    </div>
                                    {detailLow ? (
                                        <div className="prd-detail-alert">
                                            <i className="fa-solid fa-triangle-exclamation" />
                                            Estoque abaixo do mínimo — repor o quanto antes.
                                        </div>
                                    ) : null}
                                </div>

                                {/* Seção: Identificação */}
                                <div className="prd-detail-section">
                                    <div className="prd-detail-section-title">
                                        <i className="fa-solid fa-fingerprint" />
                                        Identificação
                                    </div>
                                    <div className="prd-detail-fields">
                                        <div className="prd-detail-field">
                                            <span>Fornecedor</span>
                                            <strong>{detailProduct.supplier_name || '—'}</strong>
                                        </div>
                                        <div className="prd-detail-field">
                                            <span>Código interno</span>
                                            <strong>{detailProduct.code || '—'}</strong>
                                        </div>
                                        <div className="prd-detail-field">
                                            <span>EAN / Código de barras</span>
                                            <strong>{detailProduct.barcode || '—'}</strong>
                                        </div>
                                        <div className="prd-detail-field">
                                            <span>Unidade</span>
                                            <strong>{detailProduct.unit || 'UN'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Ações */}
                                <div className="prd-detail-actions">
                                    <button type="button" className="prd-detail-btn-edit" onClick={() => handleEdit(detailProduct)}>
                                        <i className="fa-solid fa-pen" />
                                        Editar produto
                                    </button>
                                    <button type="button" className="prd-detail-btn-delete" onClick={() => handleDelete(detailProduct)}>
                                        <i className="fa-solid fa-trash-can" />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="prd-detail-empty">
                                <div className="prd-detail-empty-icon">
                                    <i className="fa-solid fa-boxes-stacked" />
                                </div>
                                <strong>Selecione um produto</strong>
                                <p>Clique em qualquer item da lista para ver os detalhes.</p>
                                <button type="button" className="prd-topbar-cta" onClick={handleCreate}>
                                    <i className="fa-solid fa-plus" />
                                    Cadastrar produto
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ProductFormModal
                open={modalOpen}
                product={selectedProduct}
                categories={categoryOptions}
                suppliers={supplierOptions}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                loading={saving}
                onQuickCreateCategory={handleQuickCreateCategory}
                onQuickCreateSupplier={handleQuickCreateSupplier}
            />
        </AppLayout>
    )
}

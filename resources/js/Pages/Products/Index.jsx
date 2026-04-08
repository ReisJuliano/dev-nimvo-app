import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { usePage } from '@inertiajs/react'
import ActionButton from '@/Components/UI/ActionButton'
import DataList from '@/Components/UI/DataList'
import AppLayout from '@/Layouts/AppLayout'
import ProductFormModal from '@/Components/Products/ProductFormModal'
import ProductsTable from '@/Components/Products/ProductsTable'
import { confirmPopup, showErrorPopup, showPopup } from '@/lib/errorPopup'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { formatNumber } from '@/lib/format'
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

export default function ProductsIndex({ products, categories, suppliers }) {
    const { tenant, localAgentBridge } = usePage().props
    const tenantId = tenant?.id
    const [collectionItems, setCollectionItems] = useState((products || []).map((product) => normalizeProductRecord(product)))
    const [categoryOptions, setCategoryOptions] = useState(categories || [])
    const [supplierOptions, setSupplierOptions] = useState(suppliers || [])
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [saving, setSaving] = useState(false)
    const deferredSearch = useDeferredValue(search)
    const normalizedSearch = normalizeTextSearch(deferredSearch)
    const hasSearch = normalizedSearch.length > 0
    const hasFilters = search.trim() !== '' || categoryId !== ''

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

    const filteredProducts = useMemo(() => {
        if (!hasSearch) {
            return []
        }

        return collectionItems
            .filter((product) => {
                const matchesSearch = matchesTextSearchAny(getSearchableValues(product), normalizedSearch)
                const matchesCategory = categoryId === '' || String(product.category_id) === String(categoryId)

                return matchesSearch && matchesCategory
            })
            .sort((left, right) => {
                const score = getProductSearchScore(left, normalizedSearch) - getProductSearchScore(right, normalizedSearch)

                if (score !== 0) {
                    return score
                }

                return String(left.name || '').localeCompare(String(right.name || ''))
            })
    }, [categoryId, collectionItems, hasSearch, normalizedSearch])

    function handleCreate() {
        setSelectedProduct(null)
        setModalOpen(true)
    }

    function handleEdit(product) {
        setSelectedProduct(product)
        setModalOpen(true)
    }

    function handleResetFilters() {
        setSearch('')
        setCategoryId('')
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
                    message: `O produto "${product.name}" foi removido da operacao local e entrara na fila de sincronizacao.`,
                })
                return
            }

            const response = await apiRequest(`/api/products/${resolveOfflineEntityId(tenantId, 'products', product.id)}`, { method: 'delete' })
            const nextItems = collectionItems.filter((entry) => entry.id !== product.id)
            setCollectionItems(nextItems)
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
                    message: `O produto "${product.name}" foi removido da operacao local e entrara na fila de sincronizacao.`,
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
                barcode: form.barcode?.trim() || '',
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
                    message: `O produto "${payload.name}" foi guardado nesta maquina e sera sincronizado quando a internet voltar.`,
                })
                return
            }

            if (form.id) {
                const response = await apiRequest(`/api/products/${resolveOfflineEntityId(tenantId, 'products', form.id)}`, { method: 'put', data: payload })
                const normalized = normalizeProductRecord(response.product)
                const nextItems = collectionItems.map((entry) => (entry.id === normalized.id ? normalized : entry))
                setCollectionItems(nextItems)
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
                    message: `O produto "${payload.name}" foi guardado nesta maquina e sera sincronizado quando a internet voltar.`,
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
            throw new Error('Criacao rapida de categoria exige conexao ativa.')
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
            throw new Error('Criacao rapida de fornecedor exige conexao ativa.')
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

    return (
        <AppLayout title="Produtos">
            <div className="products-page">
                <section className="products-shell">
                    <header className="products-header">
                        <div className="products-title-block">
                            <span className="products-kicker">Catalogo</span>
                            <h1>Produtos</h1>
                        </div>

                        <ActionButton icon="fa-plus" onClick={handleCreate}>
                            Novo
                        </ActionButton>
                    </header>

                    <section className="products-search-panel">
                        <div className="products-search-row">
                            <label className="products-search-input">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    type="search"
                                    placeholder="Buscar por nome, codigo ou EAN"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </label>

                            <label className="products-filter">
                                <span>Categoria</span>
                                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                                    <option value="">Todas</option>
                                    {categoryOptions.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {hasFilters ? (
                                <ActionButton
                                    icon="fa-rotate-left"
                                    tone="ghost"
                                    iconOnly
                                    onClick={handleResetFilters}
                                    className="ui-tooltip"
                                    data-tooltip="Limpar filtros"
                                    aria-label="Limpar filtros"
                                />
                            ) : null}
                        </div>
                    </section>

                    <DataList
                        title="Resultados"
                        icon="fa-box-open"
                        count={hasSearch ? `${formatNumber(filteredProducts.length)} item(ns)` : 'Pesquise para listar'}
                        className="products-data-list"
                    >
                        {hasSearch ? (
                            filteredProducts.length ? (
                                <ProductsTable products={filteredProducts} onEdit={handleEdit} onDelete={handleDelete} />
                            ) : (
                                <div className="products-results-empty">
                                    <span className="products-results-icon">
                                        <i className="fa-solid fa-box-open" />
                                    </span>
                                    <strong>Sem resultados</strong>
                                </div>
                            )
                        ) : (
                            <div className="products-results-empty">
                                <span className="products-results-icon">
                                    <i className="fa-solid fa-magnifying-glass" />
                                </span>
                                <strong>Pesquise produtos</strong>
                            </div>
                        )}
                    </DataList>
                </section>
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

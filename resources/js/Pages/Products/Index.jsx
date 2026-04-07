import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { usePage } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import ProductFormModal from '@/Components/Products/ProductFormModal'
import ProductsTable from '@/Components/Products/ProductsTable'
import ProductToolbar from '@/Components/Products/ProductToolbar'
import { confirmPopup, showErrorPopup, showPopup } from '@/lib/errorPopup'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
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

export default function ProductsIndex({ products, categories, suppliers }) {
    const { tenant, localAgentBridge } = usePage().props
    const tenantId = tenant?.id
    const [collectionItems, setCollectionItems] = useState((products || []).map((product) => normalizeProductRecord(product)))
    const [categoryOptions, setCategoryOptions] = useState(categories || [])
    const [supplierOptions, setSupplierOptions] = useState(suppliers || [])
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [collection, setCollection] = useState('')
    const [visibility, setVisibility] = useState('all')
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [saving, setSaving] = useState(false)
    const isFashionMode = false
    const [activeTab, setActiveTab] = useState(isFashionMode ? 'catalog' : 'catalog')
    const deferredSearch = useDeferredValue(search)

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
    const collections = useMemo(
        () =>
            Array.from(
                new Set(
                    collectionItems
                        .map((product) => product.collection)
                        .filter(Boolean),
                ),
            ).sort((left, right) => left.localeCompare(right)),
        [collectionItems],
    )

    const filteredProducts = useMemo(() => {
        return collectionItems.filter((product) => {
            const matchesSearch =
                deferredSearch === '' ||
                [
                    product.name,
                    product.code,
                    product.barcode,
                    product.style_reference,
                    product.color,
                    product.size,
                    product.collection,
                ]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(deferredSearch.toLowerCase()))

            const matchesCategory = categoryId === '' || String(product.category_id) === String(categoryId)
            const matchesCollection = collection === '' || String(product.collection || '') === String(collection)
            const matchesVisibility =
                !isFashionMode ||
                visibility === 'all' ||
                (visibility === 'published' ? Boolean(product.catalog_visible) : !product.catalog_visible)
            const matchesTab =
                activeTab === 'catalog'
                    ? true
                    : activeTab === 'stock'
                        ? Number(product.stock_quantity) <= Number(product.min_stock)
                        : activeTab === 'grade'
                            ? [product.style_reference, product.color, product.size, product.collection].some(Boolean)
                            : activeTab === 'showcase'
                                ? Boolean(product.catalog_visible)
                                : Number(product.sale_price) > Number(product.cost_price)

            return matchesSearch && matchesCategory && matchesCollection && matchesVisibility && matchesTab
        })
    }, [collectionItems, deferredSearch, categoryId, collection, visibility, activeTab, isFashionMode])

    const summary = useMemo(() => {
        const stockValue = filteredProducts.reduce(
            (total, product) => total + Number(product.stock_quantity) * Number(product.cost_price),
            0,
        )
        const published = filteredProducts.filter((product) => product.catalog_visible).length
        const collectionsCount = new Set(filteredProducts.map((product) => product.collection).filter(Boolean)).size

        return {
            total: filteredProducts.length,
            lowStock: filteredProducts.filter((product) => product.stock_quantity <= product.min_stock).length,
            stockValue,
            published,
            collections: collectionsCount,
        }
    }, [filteredProducts])

    function handleCreate() {
        setSelectedProduct(null)
        setModalOpen(true)
    }

    function handleEdit(product) {
        setSelectedProduct(product)
        setModalOpen(true)
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
                stock_quantity: Number(form.stock_quantity || 0),
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
                <section className="products-hero ui-card">
                    <div className="ui-card-body">
                        <div className="products-hero-grid">
                            <div>
                                <h1>Catalogo de produtos</h1>
                                <p>
                                    Cadastro, consulta e ajuste de produtos.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="ui-tabs">
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'catalog' ? 'active' : ''}`}
                        onClick={() => setActiveTab('catalog')}
                    >
                        <i className="fa-solid fa-box-open" />
                        <span>Catalogo</span>
                    </button>
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'stock' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stock')}
                    >
                        <i className="fa-solid fa-triangle-exclamation" />
                        <span>Reposicao</span>
                    </button>
                    {isFashionMode ? (
                        <>
                            <button
                                type="button"
                                className={`ui-tab ${activeTab === 'grade' ? 'active' : ''}`}
                                onClick={() => setActiveTab('grade')}
                            >
                                <i className="fa-solid fa-shirt" />
                                <span>Grade</span>
                            </button>
                            <button
                                type="button"
                                className={`ui-tab ${activeTab === 'showcase' ? 'active' : ''}`}
                                onClick={() => setActiveTab('showcase')}
                            >
                                <i className="fa-solid fa-store" />
                                <span>Vitrine</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={`ui-tab ${activeTab === 'pricing' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pricing')}
                        >
                            <i className="fa-solid fa-tags" />
                            <span>Precificacao</span>
                        </button>
                    )}
                </section>

                <ProductToolbar
                    search={search}
                    onSearchChange={setSearch}
                    categoryId={categoryId}
                    onCategoryChange={setCategoryId}
                    collection={collection}
                    onCollectionChange={setCollection}
                    collections={collections}
                    visibility={visibility}
                    onVisibilityChange={setVisibility}
                    categories={categoryOptions}
                    onCreate={handleCreate}
                    isFashionMode={isFashionMode}
                />

                <section className="products-summary-card">
                    <div className="products-summary-grid">
                        <article className="tone-primary">
                            <span className="products-summary-kicker">Produtos</span>
                            <span>Total filtrado</span>
                            <strong>{formatNumber(summary.total)}</strong>
                        </article>
                        <article className="tone-warning">
                            <span className="products-summary-kicker">Estoque</span>
                            <span>Estoque baixo</span>
                            <strong>{formatNumber(summary.lowStock)}</strong>
                        </article>
                        {isFashionMode ? (
                            <>
                                <article className="tone-accent">
                                    <span className="products-summary-kicker">Colecoes</span>
                                    <span>Colecoes no filtro</span>
                                    <strong>{formatNumber(summary.collections)}</strong>
                                </article>
                                <article className="tone-success">
                                    <span className="products-summary-kicker">Vitrine</span>
                                    <span>Itens publicados</span>
                                    <strong>{formatNumber(summary.published)}</strong>
                                </article>
                            </>
                        ) : (
                            <article className="tone-success">
                                <span className="products-summary-kicker">Valor</span>
                                <span>Valor em estoque</span>
                                <strong>{formatMoney(summary.stockValue)}</strong>
                            </article>
                        )}
                    </div>
                </section>

                <ProductsTable
                    products={filteredProducts}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isFashionMode={isFashionMode}
                />
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

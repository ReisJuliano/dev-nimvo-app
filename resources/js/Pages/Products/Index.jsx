import { useDeferredValue, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ProductFormModal from '@/Components/Products/ProductFormModal'
import ProductsTable from '@/Components/Products/ProductsTable'
import ProductToolbar from '@/Components/Products/ProductToolbar'
import useModules from '@/hooks/useModules'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import './products.css'

export default function ProductsIndex({ products, categories, suppliers }) {
    const { preset, modules } = useModules()
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [collection, setCollection] = useState('')
    const [visibility, setVisibility] = useState('all')
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [saving, setSaving] = useState(false)
    const isFashionMode =
        preset === 'loja_roupas' ||
        modules.produtos_variacao ||
        modules.promocoes ||
        modules.catalogo_online ||
        modules.pedidos_online ||
        modules.whatsapp_pedidos
    const [activeTab, setActiveTab] = useState(isFashionMode ? 'catalog' : 'catalog')
    const deferredSearch = useDeferredValue(search)
    const collections = useMemo(
        () =>
            Array.from(
                new Set(
                    products
                        .map((product) => product.collection)
                        .filter(Boolean),
                ),
            ).sort((left, right) => left.localeCompare(right)),
        [products],
    )

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
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
    }, [products, deferredSearch, categoryId, collection, visibility, activeTab, isFashionMode])

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
        if (!window.confirm(`Deseja desativar o produto "${product.name}"?`)) {
            return
        }

        await apiRequest(`/api/products/${product.id}`, { method: 'delete' })
        window.location.reload()
    }

    async function handleSubmit(form) {
        setSaving(true)

        try {
            const payload = {
                ...form,
                category_id: form.category_id || null,
                supplier_id: form.supplier_id || null,
                cost_price: Number(form.cost_price || 0),
                sale_price: Number(form.sale_price || 0),
                stock_quantity: Number(form.stock_quantity || 0),
                min_stock: Number(form.min_stock || 0),
            }

            if (form.id) {
                await apiRequest(`/api/products/${form.id}`, { method: 'put', data: payload })
            } else {
                await apiRequest('/api/products', { method: 'post', data: payload })
            }

            window.location.reload()
        } finally {
            setSaving(false)
        }
    }

        return (
        <AppLayout title="Produtos">
            <div className="products-page">
                <section className="products-hero ui-card">
                    <div className="ui-card-body">
                        <div className="products-hero-grid">
                            <div>
                                <h1>{isFashionMode ? 'Catalogo da loja de roupas' : 'Catalogo de produtos'}</h1>
                                <p>
                                    {isFashionMode
                                        ? 'Cadastre referencia, cor, tamanho, colecao, vitrine digital e estoque em um fluxo real de moda.'
                                        : 'Cadastro, consulta e ajuste de produtos.'}
                                </p>
                            </div>
                            <div className="products-hero-actions">
                                <button className="ui-button" onClick={handleCreate} type="button">
                                    <i className="fa-solid fa-plus" />
                                    Novo produto
                                </button>
                                <div className="products-hero-note">
                                    <strong>{formatNumber(products.length)}</strong>
                                    <span>itens cadastrados</span>
                                </div>
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
                    categories={categories}
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
                categories={categories}
                suppliers={suppliers}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                loading={saving}
                isFashionMode={isFashionMode}
            />
        </AppLayout>
    )
}

import { useDeferredValue, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ProductFormModal from '@/Components/Products/ProductFormModal'
import ProductsTable from '@/Components/Products/ProductsTable'
import ProductToolbar from '@/Components/Products/ProductToolbar'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import './products.css'

export default function ProductsIndex({ products, categories, suppliers }) {
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('catalog')
    const deferredSearch = useDeferredValue(search)

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch =
                deferredSearch === '' ||
                [product.name, product.code, product.barcode]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(deferredSearch.toLowerCase()))

            const matchesCategory = categoryId === '' || String(product.category_id) === String(categoryId)
            const matchesTab =
                activeTab === 'catalog'
                    ? true
                    : activeTab === 'stock'
                      ? Number(product.stock_quantity) <= Number(product.min_stock)
                      : Number(product.sale_price) > Number(product.cost_price)

            return matchesSearch && matchesCategory && matchesTab
        })
    }, [products, deferredSearch, categoryId, activeTab])

    const summary = useMemo(() => {
        const stockValue = filteredProducts.reduce(
            (total, product) => total + Number(product.stock_quantity) * Number(product.cost_price),
            0,
        )

        return {
            total: filteredProducts.length,
            lowStock: filteredProducts.filter((product) => product.stock_quantity <= product.min_stock).length,
            stockValue,
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
                                <h1>Produtos</h1>
                                <p>Cadastro, consulta e ajuste de produtos.</p>
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
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'pricing' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pricing')}
                    >
                        <i className="fa-solid fa-tags" />
                        <span>Precificacao</span>
                    </button>
                </section>

                <ProductToolbar
                    search={search}
                    onSearchChange={setSearch}
                    categoryId={categoryId}
                    onCategoryChange={setCategoryId}
                    categories={categories}
                    onCreate={handleCreate}
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
                        <article className="tone-success">
                            <span className="products-summary-kicker">Valor</span>
                            <span>Valor em estoque</span>
                            <strong>{formatMoney(summary.stockValue)}</strong>
                        </article>
                    </div>
                </section>

                <ProductsTable products={filteredProducts} onEdit={handleEdit} onDelete={handleDelete} />
            </div>

            <ProductFormModal
                open={modalOpen}
                product={selectedProduct}
                categories={categories}
                suppliers={suppliers}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                loading={saving}
            />
        </AppLayout>
    )
}

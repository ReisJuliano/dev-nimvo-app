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
    const deferredSearch = useDeferredValue(search)

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch =
                deferredSearch === '' ||
                [product.name, product.code, product.barcode]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(deferredSearch.toLowerCase()))

            const matchesCategory = categoryId === '' || String(product.category_id) === String(categoryId)

            return matchesSearch && matchesCategory
        })
    }, [products, deferredSearch, categoryId])

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
                        <article>
                            <span>Total filtrado</span>
                            <strong>{formatNumber(summary.total)}</strong>
                        </article>
                        <article>
                            <span>Estoque baixo</span>
                            <strong>{formatNumber(summary.lowStock)}</strong>
                        </article>
                        <article>
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

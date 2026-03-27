import { useEffect, useState } from 'react'

const emptyForm = {
    id: null,
    code: '',
    barcode: '',
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    unit: 'UN',
    cost_price: '',
    sale_price: '',
    stock_quantity: '',
    min_stock: '',
}

export default function ProductFormModal({ open, product, categories, suppliers, onClose, onSubmit, loading }) {
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        if (open) {
            setForm(product ? { ...emptyForm, ...product } : emptyForm)
        }
    }, [open, product])

    if (!open) {
        return null
    }

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    function handleSubmit(event) {
        event.preventDefault()
        onSubmit(form)
    }

    return (
        <div className="products-modal-backdrop">
            <div className="products-modal">
                <div className="products-modal-header">
                    <div>
                        <h2>{product ? 'Editar produto' : 'Novo produto'}</h2>
                        <p>Cadastro reorganizado em campos pequenos e objetivos.</p>
                    </div>
                    <button onClick={onClose}>Fechar</button>
                </div>

                <form className="products-form-grid" onSubmit={handleSubmit}>
                    <label>
                        Codigo
                        <input value={form.code ?? ''} onChange={(event) => updateField('code', event.target.value)} />
                    </label>
                    <label>
                        EAN
                        <input value={form.barcode ?? ''} onChange={(event) => updateField('barcode', event.target.value)} />
                    </label>
                    <label className="span-2">
                        Nome
                        <input required value={form.name ?? ''} onChange={(event) => updateField('name', event.target.value)} />
                    </label>
                    <label className="span-2">
                        Descricao
                        <textarea
                            rows="3"
                            value={form.description ?? ''}
                            onChange={(event) => updateField('description', event.target.value)}
                        />
                    </label>
                    <label>
                        Categoria
                        <select
                            value={form.category_id ?? ''}
                            onChange={(event) => updateField('category_id', event.target.value)}
                        >
                            <option value="">Selecione</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Fornecedor
                        <select
                            value={form.supplier_id ?? ''}
                            onChange={(event) => updateField('supplier_id', event.target.value)}
                        >
                            <option value="">Selecione</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Unidade
                        <select value={form.unit ?? 'UN'} onChange={(event) => updateField('unit', event.target.value)}>
                            <option value="UN">UN</option>
                            <option value="CX">CX</option>
                            <option value="KG">KG</option>
                            <option value="L">L</option>
                        </select>
                    </label>
                    <label>
                        Custo
                        <input
                            type="number"
                            step="0.01"
                            value={form.cost_price ?? ''}
                            onChange={(event) => updateField('cost_price', event.target.value)}
                        />
                    </label>
                    <label>
                        Venda
                        <input
                            type="number"
                            step="0.01"
                            value={form.sale_price ?? ''}
                            onChange={(event) => updateField('sale_price', event.target.value)}
                        />
                    </label>
                    <label>
                        Estoque
                        <input
                            type="number"
                            step="0.001"
                            value={form.stock_quantity ?? ''}
                            onChange={(event) => updateField('stock_quantity', event.target.value)}
                        />
                    </label>
                    <label>
                        Estoque minimo
                        <input
                            type="number"
                            step="0.001"
                            value={form.min_stock ?? ''}
                            onChange={(event) => updateField('min_stock', event.target.value)}
                        />
                    </label>

                    <div className="products-modal-actions span-2">
                        <button type="button" onClick={onClose}>
                            Cancelar
                        </button>
                        <button className="products-primary-button" type="submit" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar produto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

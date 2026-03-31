import { useEffect, useState } from 'react'

const emptyForm = {
    id: null,
    code: '',
    barcode: '',
    name: '',
    description: '',
    style_reference: '',
    color: '',
    size: '',
    collection: '',
    catalog_visible: false,
    requires_preparation: true,
    category_id: '',
    supplier_id: '',
    unit: 'UN',
    cost_price: '',
    sale_price: '',
    stock_quantity: '',
    min_stock: '',
}

export default function ProductFormModal({
    open,
    product,
    categories,
    suppliers,
    onClose,
    onSubmit,
    loading,
    isFashionMode = false,
}) {
    const [form, setForm] = useState(emptyForm)
    const [activeTab, setActiveTab] = useState(isFashionMode ? 'identity' : 'identity')

    useEffect(() => {
        if (open) {
            setForm(
                product
                    ? {
                        ...emptyForm,
                        ...product,
                        catalog_visible: Boolean(product.catalog_visible),
                        requires_preparation: Boolean(
                            product.requires_preparation ?? emptyForm.requires_preparation,
                        ),
                    }
                    : { ...emptyForm },
            )
            setActiveTab('identity')
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
                        <p>
                            {isFashionMode
                                ? 'Cadastro completo da peca com grade, colecao, vitrine e estoque.'
                                : 'Dados de cadastro e estoque.'}
                        </p>
                    </div>
                    <button className="ui-button-ghost" onClick={onClose} type="button">
                        <i className="fa-solid fa-xmark" />
                        Fechar
                    </button>
                </div>

                {isFashionMode ? (
                    <section className="products-modal-tabs">
                        <button
                            type="button"
                            className={`products-modal-tab ${activeTab === 'identity' ? 'active' : ''}`}
                            onClick={() => setActiveTab('identity')}
                        >
                            <i className="fa-solid fa-clipboard-list" />
                            Cadastro
                        </button>
                        <button
                            type="button"
                            className={`products-modal-tab ${activeTab === 'fashion' ? 'active' : ''}`}
                            onClick={() => setActiveTab('fashion')}
                        >
                            <i className="fa-solid fa-shirt" />
                            Grade e vitrine
                        </button>
                        <button
                            type="button"
                            className={`products-modal-tab ${activeTab === 'stock' ? 'active' : ''}`}
                            onClick={() => setActiveTab('stock')}
                        >
                            <i className="fa-solid fa-boxes-stacked" />
                            Estoque e preco
                        </button>
                    </section>
                ) : null}

                <form className="products-form-grid" onSubmit={handleSubmit}>
                    {(!isFashionMode || activeTab === 'identity') && (
                        <>
                            <div className="products-form-section span-2">
                                <div>
                                    <h3>Identificacao</h3>
                                    <p>Os campos abaixo ajudam na busca, etiqueta e organizacao do catalogo.</p>
                                </div>
                            </div>
                            <label className="products-field-group">
                                Codigo
                                <input
                                    value={form.code ?? ''}
                                    onChange={(event) => updateField('code', event.target.value)}
                                />
                            </label>
                            <label className="products-field-group">
                                EAN
                                <input
                                    value={form.barcode ?? ''}
                                    onChange={(event) => updateField('barcode', event.target.value)}
                                />
                            </label>
                            <label className="products-field-group span-2">
                                Nome
                                <input
                                    required
                                    value={form.name ?? ''}
                                    onChange={(event) => updateField('name', event.target.value)}
                                />
                            </label>
                            <label className="products-field-group span-2">
                                Descricao
                                <textarea
                                    rows="3"
                                    value={form.description ?? ''}
                                    onChange={(event) => updateField('description', event.target.value)}
                                />
                            </label>

                            <div className="products-form-section span-2">
                                <div>
                                    <h3>Classificacao</h3>
                                    <p>Categoria, fornecedor e unidade para manter relatorios consistentes.</p>
                                </div>
                            </div>
                            <label className="products-field-group">
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
                            <label className="products-field-group">
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
                            <label className="products-field-group">
                                Unidade
                                <select
                                    value={form.unit ?? 'UN'}
                                    onChange={(event) => updateField('unit', event.target.value)}
                                >
                                    <option value="UN">UN</option>
                                    <option value="CX">CX</option>
                                    <option value="KG">KG</option>
                                    <option value="L">L</option>
                                </select>
                            </label>
                            <label className="products-field-group span-2 products-toggle-card">
                                <span className="products-toggle-card-title">Precisa fabricacao/preparo</span>
                                <small>
                                    Quando desmarcado, o item nao entra na fila da cozinha.
                                </small>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.requires_preparation)}
                                    onChange={(event) => updateField('requires_preparation', event.target.checked)}
                                />
                            </label>
                        </>
                    )}

                    {isFashionMode && activeTab === 'fashion' ? (
                        <>
                            <div className="products-form-section span-2">
                                <div>
                                    <h3>Grade e vitrine</h3>
                                    <p>Referencia, colecao, cor, tamanho e publicacao no catalogo online.</p>
                                </div>
                            </div>
                            <label className="products-field-group">
                                Referencia de estilo
                                <input
                                    value={form.style_reference ?? ''}
                                    onChange={(event) => updateField('style_reference', event.target.value)}
                                    placeholder="Ex.: VST-MIDI-023"
                                />
                            </label>
                            <label className="products-field-group">
                                Colecao
                                <input
                                    value={form.collection ?? ''}
                                    onChange={(event) => updateField('collection', event.target.value)}
                                    placeholder="Ex.: Inverno 2026"
                                />
                            </label>
                            <label className="products-field-group">
                                Cor
                                <input
                                    value={form.color ?? ''}
                                    onChange={(event) => updateField('color', event.target.value)}
                                    placeholder="Ex.: Preto"
                                />
                            </label>
                            <label className="products-field-group">
                                Tamanho
                                <input
                                    value={form.size ?? ''}
                                    onChange={(event) => updateField('size', event.target.value)}
                                    placeholder="Ex.: P, M, 38"
                                />
                            </label>
                            <label className="products-field-group span-2 products-toggle-card">
                                <span className="products-toggle-card-title">Publicar na vitrine digital</span>
                                <small>Deixa a peca disponivel para catalogo online e canais digitais.</small>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.catalog_visible)}
                                    onChange={(event) => updateField('catalog_visible', event.target.checked)}
                                />
                            </label>
                        </>
                    ) : null}

                    {(!isFashionMode || activeTab === 'stock') && (
                        <>
                            <div className="products-form-section span-2">
                                <div>
                                    <h3>Estoque e preco</h3>
                                    <p>Preencha custos, venda e limites para alertas de reposicao.</p>
                                </div>
                            </div>
                            <label className="products-field-group">
                                Custo
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.cost_price ?? ''}
                                    onChange={(event) => updateField('cost_price', event.target.value)}
                                />
                            </label>
                            <label className="products-field-group">
                                Venda
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.sale_price ?? ''}
                                    onChange={(event) => updateField('sale_price', event.target.value)}
                                />
                            </label>
                            <label className="products-field-group">
                                Estoque
                                <input
                                    type="number"
                                    step="0.001"
                                    value={form.stock_quantity ?? ''}
                                    onChange={(event) => updateField('stock_quantity', event.target.value)}
                                />
                            </label>
                            <label className="products-field-group">
                                Estoque minimo
                                <input
                                    type="number"
                                    step="0.001"
                                    value={form.min_stock ?? ''}
                                    onChange={(event) => updateField('min_stock', event.target.value)}
                                />
                            </label>
                        </>
                    )}

                    <div className="products-modal-actions span-2">
                        <button className="ui-button-ghost" type="button" onClick={onClose}>
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

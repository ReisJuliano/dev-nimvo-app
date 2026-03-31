import { useEffect, useMemo, useState } from 'react'

const emptyForm = {
    id: null,
    code: '',
    barcode: '',
    name: '',
    description: '',
    internal_notes: '',
    style_reference: '',
    color: '',
    size: '',
    collection: '',
    catalog_visible: false,
    requires_preparation: true,
    active: true,
    category_id: '',
    supplier_id: '',
    unit: 'UN',
    cost_price: '',
    sale_price: '',
    stock_quantity: '',
    min_stock: '',
}

const tabs = [
    { id: 'general', label: 'Informacoes gerais', icon: 'fa-solid fa-circle-info' },
    { id: 'description', label: 'Descricao', icon: 'fa-solid fa-align-left' },
    { id: 'pricing', label: 'Precos', icon: 'fa-solid fa-tags' },
    { id: 'stock', label: 'Estoque', icon: 'fa-solid fa-boxes-stacked' },
    { id: 'production', label: 'Producao', icon: 'fa-solid fa-gears' },
]

const fieldTabMap = {
    code: 'general',
    barcode: 'general',
    name: 'general',
    active: 'general',
    category_id: 'general',
    supplier_id: 'general',
    unit: 'general',
    description: 'description',
    internal_notes: 'description',
    cost_price: 'pricing',
    sale_price: 'pricing',
    stock_quantity: 'stock',
    min_stock: 'stock',
    requires_preparation: 'production',
}

const numericFieldLabels = {
    cost_price: 'Custo',
    sale_price: 'Preco de venda',
    stock_quantity: 'Estoque atual',
    min_stock: 'Estoque minimo',
}
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
})

function normalizeFormData(product) {
    if (!product) {
        return { ...emptyForm }
    }

    return {
        ...emptyForm,
        ...product,
        code: product.code ?? '',
        barcode: product.barcode ?? '',
        name: product.name ?? '',
        description: product.description ?? '',
        internal_notes: product.internal_notes ?? '',
        style_reference: product.style_reference ?? '',
        color: product.color ?? '',
        size: product.size ?? '',
        collection: product.collection ?? '',
        category_id: product.category_id ?? '',
        supplier_id: product.supplier_id ?? '',
        unit: product.unit ?? 'UN',
        cost_price: product.cost_price ?? '',
        sale_price: product.sale_price ?? '',
        stock_quantity: product.stock_quantity ?? '',
        min_stock: product.min_stock ?? '',
        active: product.active !== false,
        catalog_visible: Boolean(product.catalog_visible),
        requires_preparation: Boolean(product.requires_preparation ?? true),
    }
}

function getNumberValue(value) {
    if (value === '' || value === null || value === undefined) {
        return null
    }

    const parsed = Number(value)

    return Number.isNaN(parsed) ? NaN : parsed
}

function validateForm(form) {
    const errors = {}

    if (!String(form.name || '').trim()) {
        errors.name = 'Informe o nome do produto.'
    }

    if (!String(form.barcode || '').trim()) {
        errors.barcode = 'Informe o EAN/codigo de barras.'
    }

    if (form.cost_price === '' || form.cost_price === null || form.cost_price === undefined) {
        errors.cost_price = 'Informe o custo.'
    }

    if (form.sale_price === '' || form.sale_price === null || form.sale_price === undefined) {
        errors.sale_price = 'Informe o preco de venda.'
    }

    if (!String(form.category_id || '').trim()) {
        errors.category_id = 'Selecione uma categoria.'
    }

    if (!String(form.unit || '').trim()) {
        errors.unit = 'Selecione a unidade.'
    }

    Object.entries(numericFieldLabels).forEach(([field, label]) => {
        const numericValue = getNumberValue(form[field])

        if (Number.isNaN(numericValue)) {
            errors[field] = `${label} precisa ser um numero valido.`
            return
        }

        if (numericValue !== null && numericValue < 0) {
            errors[field] = `${label} nao pode ser negativo.`
        }
    })

    return errors
}

export default function ProductFormModal({ open, product, categories, suppliers, onClose, onSubmit, loading }) {
    const [form, setForm] = useState(emptyForm)
    const [activeTab, setActiveTab] = useState('general')
    const [errors, setErrors] = useState({})
    const [attemptedSubmit, setAttemptedSubmit] = useState(false)

    useEffect(() => {
        if (!open) {
            return
        }

        setForm(normalizeFormData(product))
        setActiveTab('general')
        setErrors({})
        setAttemptedSubmit(false)
    }, [open, product])

    const pricingSummary = useMemo(() => {
        const cost = Number(form.cost_price || 0)
        const sale = Number(form.sale_price || 0)
        const marginAmount = sale - cost
        const marginPercent = cost > 0 ? (marginAmount / cost) * 100 : null

        return {
            marginAmount,
            marginPercent,
            isNegative: marginAmount < 0,
        }
    }, [form.cost_price, form.sale_price])

    const tabWithErrors = useMemo(() => {
        return Object.keys(errors).reduce((set, field) => {
            const tabId = fieldTabMap[field]
            if (tabId) {
                set.add(tabId)
            }
            return set
        }, new Set())
    }, [errors])

    if (!open) {
        return null
    }

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }))

        setErrors((current) => {
            if (!current[field]) {
                return current
            }

            const next = { ...current }
            delete next[field]
            return next
        })
    }

    function tabClassName(tabId) {
        const classes = ['products-editor-tab']
        if (activeTab === tabId) {
            classes.push('active')
        }
        if (tabWithErrors.has(tabId)) {
            classes.push('has-error')
        }

        return classes.join(' ')
    }

    function handleSubmit(event) {
        event.preventDefault()
        setAttemptedSubmit(true)

        const nextErrors = validateForm(form)
        setErrors(nextErrors)

        const hasErrors = Object.keys(nextErrors).length > 0
        if (hasErrors) {
            const firstField = Object.keys(nextErrors)[0]
            setActiveTab(fieldTabMap[firstField] ?? 'general')
            return
        }

        onSubmit(form)
    }

    function renderFieldError(fieldName) {
        if (!errors[fieldName]) {
            return null
        }

        return <span className="products-editor-error">{errors[fieldName]}</span>
    }

    return (
        <div className="products-modal-backdrop">
            <div className="products-modal products-editor-modal" role="dialog" aria-modal="true">
                <header className="products-modal-header products-editor-header">
                    <div>
                        <h2>{product ? 'Editar produto' : 'Novo produto'}</h2>
                        <p>Cadastro organizado em abas com foco em velocidade e clareza no dia a dia.</p>
                    </div>
                    <button className="ui-button-ghost" onClick={onClose} type="button">
                        <i className="fa-solid fa-xmark" />
                        Fechar
                    </button>
                </header>

                <nav className="products-editor-tabs" aria-label="Abas do cadastro de produto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={tabClassName(tab.id)}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <i className={tab.icon} />
                            <span>{tab.label}</span>
                            {tabWithErrors.has(tab.id) ? <small>Corrigir</small> : null}
                        </button>
                    ))}
                </nav>

                <form className="products-editor-form" onSubmit={handleSubmit} noValidate>
                    <div className="products-editor-body">
                        {activeTab === 'general' ? (
                            <section className="products-editor-grid">
                                <article className="products-editor-card span-2">
                                    <h3>Identificacao e status</h3>
                                    <p>Dados principais para busca, etiqueta e controle operacional.</p>
                                </article>

                                <label className={`products-editor-field span-2 ${errors.name ? 'has-error' : ''}`}>
                                    <span>Nome do produto *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-bowl-food" />
                                        <input
                                            value={form.name ?? ''}
                                            onChange={(event) => updateField('name', event.target.value)}
                                            placeholder="Ex.: Pizza calabresa grande"
                                            required
                                        />
                                    </div>
                                    {renderFieldError('name')}
                                </label>

                                <label className="products-editor-field">
                                    <span>Codigo / SKU</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-hashtag" />
                                        <input
                                            value={form.code ?? ''}
                                            onChange={(event) => updateField('code', event.target.value)}
                                            placeholder="Gerado automaticamente se vazio"
                                        />
                                    </div>
                                </label>

                                <label className={`products-editor-field ${errors.barcode ? 'has-error' : ''}`}>
                                    <span>EAN / Codigo de barras *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-barcode" />
                                        <input
                                            value={form.barcode ?? ''}
                                            onChange={(event) => updateField('barcode', event.target.value)}
                                            placeholder="Ex.: 7891234567890"
                                            required
                                        />
                                    </div>
                                    {renderFieldError('barcode')}
                                </label>

                                <label className={`products-editor-field ${errors.category_id ? 'has-error' : ''}`}>
                                    <span>Categoria *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-layer-group" />
                                        <select
                                            value={form.category_id ?? ''}
                                            onChange={(event) => updateField('category_id', event.target.value)}
                                            required
                                        >
                                            <option value="">Selecione</option>
                                            {categories.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {renderFieldError('category_id')}
                                </label>

                                <label className="products-editor-field">
                                    <span>Fornecedor</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-truck-ramp-box" />
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
                                    </div>
                                </label>

                                <label className={`products-editor-field ${errors.unit ? 'has-error' : ''}`}>
                                    <span>Unidade *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-weight-scale" />
                                        <select
                                            value={form.unit ?? 'UN'}
                                            onChange={(event) => updateField('unit', event.target.value)}
                                            required
                                        >
                                            <option value="UN">UN</option>
                                            <option value="CX">CX</option>
                                            <option value="KG">KG</option>
                                            <option value="L">L</option>
                                        </select>
                                    </div>
                                    {renderFieldError('unit')}
                                </label>

                                <article className="products-editor-card">
                                    <h3>Status</h3>
                                    <p>Defina se o item deve permanecer disponivel no catalogo interno.</p>
                                    <div className="products-editor-toggle-row">
                                        <button
                                            type="button"
                                            className={`products-editor-toggle ${form.active ? 'active' : ''}`}
                                            onClick={() => updateField('active', true)}
                                        >
                                            Ativo
                                        </button>
                                        <button
                                            type="button"
                                            className={`products-editor-toggle ${!form.active ? 'active' : ''}`}
                                            onClick={() => updateField('active', false)}
                                        >
                                            Inativo
                                        </button>
                                    </div>
                                </article>
                            </section>
                        ) : null}

                        {activeTab === 'description' ? (
                            <section className="products-editor-grid">
                                <article className="products-editor-card span-2">
                                    <h3>Conteudo de descricao</h3>
                                    <p>Use textos claros para equipe, pedidos e catalogo.</p>
                                </article>

                                <label className="products-editor-field span-2">
                                    <span>Descricao detalhada</span>
                                    <textarea
                                        rows="5"
                                        value={form.description ?? ''}
                                        onChange={(event) => updateField('description', event.target.value)}
                                        placeholder="Descreva composicao, uso, diferenciais e instrucoes."
                                    />
                                </label>

                                <label className="products-editor-field span-2">
                                    <span>Observacoes internas</span>
                                    <textarea
                                        rows="4"
                                        value={form.internal_notes ?? ''}
                                        onChange={(event) => updateField('internal_notes', event.target.value)}
                                        placeholder="Anotacoes apenas para uso da equipe."
                                    />
                                </label>
                            </section>
                        ) : null}

                        {activeTab === 'pricing' ? (
                            <section className="products-editor-grid products-editor-grid-compact">
                                <article className="products-editor-card products-editor-card-compact span-2">
                                    <h3>Definicao de preco</h3>
                                    <p>Custo e preco de venda para ajuste rapido.</p>
                                    <div className="products-editor-inline-fields">
                                        <label className={`products-editor-field products-editor-field-compact ${errors.cost_price ? 'has-error' : ''}`}>
                                            <span>Custo *</span>
                                            <div className="products-editor-input-wrap">
                                                <i className="fa-solid fa-coins" />
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={form.cost_price ?? ''}
                                                    onChange={(event) => updateField('cost_price', event.target.value)}
                                                    required
                                                />
                                            </div>
                                            {renderFieldError('cost_price')}
                                        </label>

                                        <label className={`products-editor-field products-editor-field-compact ${errors.sale_price ? 'has-error' : ''}`}>
                                            <span>Preco de venda *</span>
                                            <div className="products-editor-input-wrap">
                                                <i className="fa-solid fa-receipt" />
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={form.sale_price ?? ''}
                                                    onChange={(event) => updateField('sale_price', event.target.value)}
                                                    required
                                                />
                                            </div>
                                            {renderFieldError('sale_price')}
                                        </label>
                                    </div>
                                </article>

                                <article className={`products-editor-card products-editor-card-compact span-2 ${pricingSummary.isNegative ? 'is-danger' : ''}`}>
                                    <h3>Margem</h3>
                                    <p>Resumo calculado automaticamente.</p>
                                    <div className="products-editor-metric-grid products-editor-metric-grid-highlight">
                                        <div>
                                            <span>Margem em valor</span>
                                            <strong>{currencyFormatter.format(pricingSummary.marginAmount)}</strong>
                                        </div>
                                        <div>
                                            <span>Margem percentual</span>
                                            <strong>
                                                {pricingSummary.marginPercent === null
                                                    ? 'Defina o custo'
                                                    : `${pricingSummary.marginPercent.toFixed(2)}%`}
                                            </strong>
                                        </div>
                                    </div>
                                </article>
                            </section>
                        ) : null}

                        {activeTab === 'stock' ? (
                            <section className="products-editor-grid products-editor-grid-compact">
                                <article className="products-editor-card products-editor-card-compact span-2">
                                    <h3>Estoque</h3>
                                    <p>Controle rapido de saldo atual e minimo.</p>
                                    <div className="products-editor-inline-fields">
                                        <label className={`products-editor-field products-editor-field-compact ${errors.stock_quantity ? 'has-error' : ''}`}>
                                            <span>Estoque atual</span>
                                            <div className="products-editor-input-wrap">
                                                <i className="fa-solid fa-box-open" />
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                    value={form.stock_quantity ?? ''}
                                                    onChange={(event) => updateField('stock_quantity', event.target.value)}
                                                />
                                            </div>
                                            {renderFieldError('stock_quantity')}
                                        </label>

                                        <label className={`products-editor-field products-editor-field-compact ${errors.min_stock ? 'has-error' : ''}`}>
                                            <span>Estoque minimo</span>
                                            <div className="products-editor-input-wrap">
                                                <i className="fa-solid fa-triangle-exclamation" />
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                    value={form.min_stock ?? ''}
                                                    onChange={(event) => updateField('min_stock', event.target.value)}
                                                />
                                            </div>
                                            {renderFieldError('min_stock')}
                                        </label>
                                    </div>
                                </article>
                            </section>
                        ) : null}

                        {activeTab === 'production' ? (
                            <section className="products-editor-grid">

                                <article className="products-editor-card span-2">
                                    <div className="products-editor-switch-row">
                                        <div>
                                            <h3>Precisa ser fabricado</h3>
                                            <p>Ative para enviar o item para filas operacionais como cozinha/producao.</p>
                                        </div>
                                        <label className="products-editor-switch">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(form.requires_preparation)}
                                                onChange={(event) =>
                                                    updateField('requires_preparation', event.target.checked)
                                                }
                                            />
                                            <span />
                                        </label>
                                    </div>
                                </article>
                            </section>
                        ) : null}

                    </div>

                    <footer className="products-modal-actions products-editor-actions">
                        {attemptedSubmit && Object.keys(errors).length > 0 ? (
                            <span className="products-editor-submit-error">
                                Revise os campos destacados para concluir o cadastro.
                            </span>
                        ) : (
                            <span className="products-editor-submit-hint">Campos com * sao obrigatorios.</span>
                        )}
                        <div className="products-editor-action-buttons">
                            <button className="ui-button-ghost" type="button" onClick={onClose}>
                                Cancelar
                            </button>
                            <button className="products-primary-button" type="submit" disabled={loading}>
                                {loading ? 'Salvando...' : 'Salvar produto'}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    )
}

import { useEffect, useMemo, useState } from 'react'
import { showErrorPopup } from '@/lib/errorPopup'

const ADD_NEW_OPTION = '__add_new__'

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
        style_reference: product.style_reference ?? '',
        color: product.color ?? '',
        size: product.size ?? '',
        collection: product.collection ?? '',
        catalog_visible: Boolean(product.catalog_visible),
        category_id: product.category_id ? String(product.category_id) : '',
        supplier_id: product.supplier_id ? String(product.supplier_id) : '',
        active: product.active !== false,
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

    if (!String(form.name || '').trim()) errors.name = 'Informe o nome do produto.'
    if (!String(form.barcode || '').trim()) errors.barcode = 'Informe o EAN/codigo de barras.'
    if (form.cost_price === '' || form.cost_price === null || form.cost_price === undefined) errors.cost_price = 'Informe o custo.'
    if (form.sale_price === '' || form.sale_price === null || form.sale_price === undefined) errors.sale_price = 'Informe o preco de venda.'
    if (!String(form.category_id || '').trim()) errors.category_id = 'Selecione uma categoria.'
    if (!String(form.unit || '').trim()) errors.unit = 'Selecione a unidade.'

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

export default function ProductFormModal({
    open,
    product,
    categories,
    suppliers,
    onClose,
    onSubmit,
    loading,
    onQuickCreateCategory,
    onQuickCreateSupplier,
}) {
    const [form, setForm] = useState(emptyForm)
    const [activeTab, setActiveTab] = useState('general')
    const [errors, setErrors] = useState({})
    const [attemptedSubmit, setAttemptedSubmit] = useState(false)
    const [submitError, setSubmitError] = useState('')

    const [showQuickCategory, setShowQuickCategory] = useState(false)
    const [showQuickSupplier, setShowQuickSupplier] = useState(false)
    const [quickCategory, setQuickCategory] = useState({ name: '', description: '' })
    const [quickSupplier, setQuickSupplier] = useState({ name: '', phone: '', email: '' })
    const [quickCategoryError, setQuickCategoryError] = useState('')
    const [quickSupplierError, setQuickSupplierError] = useState('')
    const [creatingCategory, setCreatingCategory] = useState(false)
    const [creatingSupplier, setCreatingSupplier] = useState(false)

    useEffect(() => {
        if (!open) return

        setForm(normalizeFormData(product))
        setActiveTab('general')
        setErrors({})
        setAttemptedSubmit(false)
        setSubmitError('')
        setShowQuickCategory(false)
        setShowQuickSupplier(false)
        setQuickCategory({ name: '', description: '' })
        setQuickSupplier({ name: '', phone: '', email: '' })
        setQuickCategoryError('')
        setQuickSupplierError('')
    }, [open, product])

    const pricingSummary = useMemo(() => {
        const cost = Number(form.cost_price || 0)
        const sale = Number(form.sale_price || 0)
        const marginAmount = sale - cost
        const marginPercent = cost > 0 ? (marginAmount / cost) * 100 : null

        return { marginAmount, marginPercent, isNegative: marginAmount < 0 }
    }, [form.cost_price, form.sale_price])

    const tabWithErrors = useMemo(() => {
        return Object.keys(errors).reduce((set, field) => {
            const tabId = fieldTabMap[field]
            if (tabId) set.add(tabId)
            return set
        }, new Set())
    }, [errors])

    if (!open) return null

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }))
        setErrors((current) => {
            if (!current[field]) return current
            const next = { ...current }
            delete next[field]
            return next
        })
    }

    function tabClassName(tabId) {
        const classes = ['products-editor-tab']
        if (activeTab === tabId) classes.push('active')
        if (tabWithErrors.has(tabId)) classes.push('has-error')
        return classes.join(' ')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setAttemptedSubmit(true)
        setSubmitError('')

        const nextErrors = validateForm(form)
        setErrors(nextErrors)

        if (Object.keys(nextErrors).length > 0) {
            const firstField = Object.keys(nextErrors)[0]
            setActiveTab(fieldTabMap[firstField] ?? 'general')
            showErrorPopup(nextErrors[firstField])
            return
        }

        try {
            await onSubmit(form)
        } catch (error) {
            const message = error.message || 'Nao foi possivel salvar o produto.'
            setSubmitError(message)
            showErrorPopup(message)
        }
    }

    async function handleQuickCategoryCreate() {
        if (!onQuickCreateCategory) return
        if (!quickCategory.name.trim()) {
            const message = 'Informe o nome da categoria.'
            setQuickCategoryError(message)
            showErrorPopup(message)
            return
        }

        setCreatingCategory(true)
        setQuickCategoryError('')
        try {
            const created = await onQuickCreateCategory({
                name: quickCategory.name.trim(),
                description: quickCategory.description.trim() || null,
                active: true,
            })
            updateField('category_id', String(created.id))
            setShowQuickCategory(false)
            setQuickCategory({ name: '', description: '' })
        } catch (error) {
            const message = error.message || 'Falha ao criar categoria.'
            setQuickCategoryError(message)
            showErrorPopup(message)
        } finally {
            setCreatingCategory(false)
        }
    }

    async function handleQuickSupplierCreate() {
        if (!onQuickCreateSupplier) return
        if (!quickSupplier.name.trim()) {
            const message = 'Informe o nome do fornecedor.'
            setQuickSupplierError(message)
            showErrorPopup(message)
            return
        }

        setCreatingSupplier(true)
        setQuickSupplierError('')
        try {
            const created = await onQuickCreateSupplier({
                name: quickSupplier.name.trim(),
                phone: quickSupplier.phone.trim() || null,
                email: quickSupplier.email.trim() || null,
                active: true,
            })
            updateField('supplier_id', String(created.id))
            setShowQuickSupplier(false)
            setQuickSupplier({ name: '', phone: '', email: '' })
        } catch (error) {
            const message = error.message || 'Falha ao criar fornecedor.'
            setQuickSupplierError(message)
            showErrorPopup(message)
        } finally {
            setCreatingSupplier(false)
        }
    }

    function handleCategorySelect(value) {
        if (value === ADD_NEW_OPTION) {
            setShowQuickCategory(true)
            updateField('category_id', '')
            return
        }

        setShowQuickCategory(false)
        updateField('category_id', value)
    }

    function handleSupplierSelect(value) {
        if (value === ADD_NEW_OPTION) {
            setShowQuickSupplier(true)
            updateField('supplier_id', '')
            return
        }

        setShowQuickSupplier(false)
        updateField('supplier_id', value)
    }

    function renderFieldError(fieldName) {
        if (!errors[fieldName]) return null
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
                        <button key={tab.id} type="button" className={tabClassName(tab.id)} onClick={() => setActiveTab(tab.id)}>
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
                                <label className={`products-editor-field span-2 ${errors.name ? 'has-error' : ''}`}>
                                    <span>Nome do produto *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-box" />
                                        <input value={form.name ?? ''} onChange={(event) => updateField('name', event.target.value)} required />
                                    </div>
                                    {renderFieldError('name')}
                                </label>
                                <label className="products-editor-field">
                                    <span>Codigo / SKU</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-hashtag" />
                                        <input value={form.code ?? ''} onChange={(event) => updateField('code', event.target.value)} />
                                    </div>
                                </label>
                                <label className={`products-editor-field ${errors.barcode ? 'has-error' : ''}`}>
                                    <span>EAN / Codigo de barras *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-barcode" />
                                        <input value={form.barcode ?? ''} onChange={(event) => updateField('barcode', event.target.value)} required />
                                    </div>
                                    {renderFieldError('barcode')}
                                </label>
                                <label className={`products-editor-field ${errors.category_id ? 'has-error' : ''}`}>
                                    <span>Categoria *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-layer-group" />
                                        <select value={form.category_id ?? ''} onChange={(event) => handleCategorySelect(event.target.value)} required>
                                            <option value="">Selecione</option>
                                            {categories.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                            <option value={ADD_NEW_OPTION}>+ Adicionar nova categoria</option>
                                        </select>
                                    </div>
                                    {renderFieldError('category_id')}
                                </label>
                                <label className="products-editor-field">
                                    <span>Fornecedor</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-truck-ramp-box" />
                                        <select value={form.supplier_id ?? ''} onChange={(event) => handleSupplierSelect(event.target.value)}>
                                            <option value="">Selecione</option>
                                            {suppliers.map((supplier) => (
                                                <option key={supplier.id} value={supplier.id}>
                                                    {supplier.name}
                                                </option>
                                            ))}
                                            <option value={ADD_NEW_OPTION}>+ Adicionar novo fornecedor</option>
                                        </select>
                                    </div>
                                </label>
                                {showQuickCategory ? (
                                    <article className="products-editor-card span-2 products-inline-create">
                                        <h3>Nova categoria</h3>
                                        <div className="products-inline-create-grid">
                                            <input placeholder="Nome" value={quickCategory.name} onChange={(event) => setQuickCategory((current) => ({ ...current, name: event.target.value }))} />
                                            <input placeholder="Descricao" value={quickCategory.description} onChange={(event) => setQuickCategory((current) => ({ ...current, description: event.target.value }))} />
                                        </div>
                                        {quickCategoryError ? <span className="products-editor-error">{quickCategoryError}</span> : null}
                                        <div className="products-inline-create-actions">
                                            <button type="button" className="ui-button-ghost" onClick={() => setShowQuickCategory(false)}>Cancelar</button>
                                            <button type="button" className="ui-button" onClick={handleQuickCategoryCreate} disabled={creatingCategory}>{creatingCategory ? 'Criando...' : 'Criar categoria'}</button>
                                        </div>
                                    </article>
                                ) : null}
                                {showQuickSupplier ? (
                                    <article className="products-editor-card span-2 products-inline-create">
                                        <h3>Novo fornecedor</h3>
                                        <div className="products-inline-create-grid">
                                            <input placeholder="Nome" value={quickSupplier.name} onChange={(event) => setQuickSupplier((current) => ({ ...current, name: event.target.value }))} />
                                            <input placeholder="Telefone" value={quickSupplier.phone} onChange={(event) => setQuickSupplier((current) => ({ ...current, phone: event.target.value }))} />
                                            <input placeholder="E-mail" type="email" value={quickSupplier.email} onChange={(event) => setQuickSupplier((current) => ({ ...current, email: event.target.value }))} />
                                        </div>
                                        {quickSupplierError ? <span className="products-editor-error">{quickSupplierError}</span> : null}
                                        <div className="products-inline-create-actions">
                                            <button type="button" className="ui-button-ghost" onClick={() => setShowQuickSupplier(false)}>Cancelar</button>
                                            <button type="button" className="ui-button" onClick={handleQuickSupplierCreate} disabled={creatingSupplier}>{creatingSupplier ? 'Criando...' : 'Criar fornecedor'}</button>
                                        </div>
                                    </article>
                                ) : null}
                                <label className={`products-editor-field ${errors.unit ? 'has-error' : ''}`}>
                                    <span>Unidade *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-ruler-combined" />
                                        <select value={form.unit ?? 'UN'} onChange={(event) => updateField('unit', event.target.value)} required>
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
                                    <div className="products-editor-toggle-row">
                                        <button type="button" className={`products-editor-toggle ${form.active ? 'active' : ''}`} onClick={() => updateField('active', true)}>Ativo</button>
                                        <button type="button" className={`products-editor-toggle ${!form.active ? 'active' : ''}`} onClick={() => updateField('active', false)}>Inativo</button>
                                    </div>
                                </article>
                            </section>
                        ) : null}

                        {activeTab === 'description' ? (
                            <section className="products-editor-grid">
                                <label className="products-editor-field span-2">
                                    <span>Descricao detalhada</span>
                                    <textarea rows="5" value={form.description ?? ''} onChange={(event) => updateField('description', event.target.value)} />
                                </label>
                                <label className="products-editor-field span-2">
                                    <span>Observacoes internas</span>
                                    <textarea rows="4" value={form.internal_notes ?? ''} onChange={(event) => updateField('internal_notes', event.target.value)} />
                                </label>
                            </section>
                        ) : null}

                        {activeTab === 'pricing' ? (
                            <section className="products-editor-grid products-editor-grid-compact">
                                <label className={`products-editor-field ${errors.cost_price ? 'has-error' : ''}`}>
                                    <span>Custo *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-coins" />
                                        <input type="number" step="0.01" min="0" value={form.cost_price ?? ''} onChange={(event) => updateField('cost_price', event.target.value)} required />
                                    </div>
                                    {renderFieldError('cost_price')}
                                </label>
                                <label className={`products-editor-field ${errors.sale_price ? 'has-error' : ''}`}>
                                    <span>Preco de venda *</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-receipt" />
                                        <input type="number" step="0.01" min="0" value={form.sale_price ?? ''} onChange={(event) => updateField('sale_price', event.target.value)} required />
                                    </div>
                                    {renderFieldError('sale_price')}
                                </label>
                                <article className={`products-editor-card span-2 ${pricingSummary.isNegative ? 'is-danger' : ''}`}>
                                    <h3>Margem</h3>
                                    <strong>{currencyFormatter.format(pricingSummary.marginAmount)}</strong>
                                    <small>{pricingSummary.marginPercent === null ? 'Defina o custo' : `${pricingSummary.marginPercent.toFixed(2)}%`}</small>
                                </article>
                            </section>
                        ) : null}

                        {activeTab === 'stock' ? (
                            <section className="products-editor-grid products-editor-grid-compact">
                                <label className={`products-editor-field ${errors.stock_quantity ? 'has-error' : ''}`}>
                                    <span>Estoque atual</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-box-open" />
                                        <input type="number" step="0.001" min="0" value={form.stock_quantity ?? ''} onChange={(event) => updateField('stock_quantity', event.target.value)} />
                                    </div>
                                    {renderFieldError('stock_quantity')}
                                </label>
                                <label className={`products-editor-field ${errors.min_stock ? 'has-error' : ''}`}>
                                    <span>Estoque minimo</span>
                                    <div className="products-editor-input-wrap">
                                        <i className="fa-solid fa-triangle-exclamation" />
                                        <input type="number" step="0.001" min="0" value={form.min_stock ?? ''} onChange={(event) => updateField('min_stock', event.target.value)} />
                                    </div>
                                    {renderFieldError('min_stock')}
                                </label>
                            </section>
                        ) : null}
                    </div>

                    <footer className="products-modal-actions products-editor-actions">
                        {submitError ? (
                            <span className="products-editor-submit-error">{submitError}</span>
                        ) : attemptedSubmit && Object.keys(errors).length > 0 ? (
                            <span className="products-editor-submit-error">Revise os campos destacados para concluir o cadastro.</span>
                        ) : (
                            <span className="products-editor-submit-hint">Campos com * sao obrigatorios.</span>
                        )}
                        <div className="products-editor-action-buttons">
                            <button className="ui-button-ghost" type="button" onClick={onClose}>Cancelar</button>
                            <button className="products-primary-button" type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar produto'}</button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    )
}

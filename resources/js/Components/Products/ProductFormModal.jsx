import { useEffect, useMemo, useState } from 'react'
import { confirmPopup, showErrorPopup } from '@/lib/errorPopup'
import useModules from '@/hooks/useModules'

const ADD_NEW_OPTION = '__add_new__'

const emptyForm = {
    id: null,
    code: '',
    barcode: '',
    ncm: '',
    cfop: '',
    cest: '',
    origin_code: '0',
    icms_csosn: '102',
    pis_cst: '49',
    cofins_cst: '49',
    fiscal_enabled: false,
    name: '',
    description: '',
    internal_notes: '',
    active: true,
    category_id: '',
    supplier_id: '',
    unit: 'UN',
    commercial_unit: 'UN',
    taxable_unit: 'UN',
    cost_price: '',
    sale_price: '',
    stock_quantity: '',
    min_stock: '',
    icms_rate: '',
    pis_rate: '',
    cofins_rate: '',
    ipi_rate: '',
}

const numericFieldLabels = {
    cost_price: 'Custo',
    sale_price: 'Preco de venda',
    stock_quantity: 'Estoque atual',
    min_stock: 'Estoque minimo',
    icms_rate: 'Aliquota de ICMS',
    pis_rate: 'Aliquota de PIS',
    cofins_rate: 'Aliquota de COFINS',
    ipi_rate: 'Aliquota de IPI',
}

const icmsOptions = ['101', '102', '103', '201', '202', '203', '300', '400', '500', '900']
const pisOptions = ['01', '02', '04', '05', '06', '07', '08', '09', '49', '99']
const cofinsOptions = ['01', '02', '04', '05', '06', '07', '08', '09', '49', '99']

function normalizeFormData(product) {
    if (!product) {
        return { ...emptyForm }
    }

    return {
        ...emptyForm,
        ...product,
        ncm: product.ncm ?? '',
        cfop: product.cfop ?? '',
        cest: product.cest ?? '',
        origin_code: product.origin_code ?? '0',
        icms_csosn: product.icms_csosn ?? '102',
        pis_cst: product.pis_cst ?? '49',
        cofins_cst: product.cofins_cst ?? '49',
        fiscal_enabled: product.fiscal_enabled === true,
        category_id: product.category_id ? String(product.category_id) : '',
        supplier_id: product.supplier_id ? String(product.supplier_id) : '',
        active: product.active !== false,
        unit: product.unit ?? 'UN',
        commercial_unit: product.commercial_unit ?? product.unit ?? 'UN',
        taxable_unit: product.taxable_unit ?? product.unit ?? 'UN',
        cost_price: product.cost_price ?? '',
        sale_price: product.sale_price ?? '',
        stock_quantity: product.stock_quantity ?? '',
        min_stock: product.min_stock ?? '',
        icms_rate: product.icms_rate ?? '',
        pis_rate: product.pis_rate ?? '',
        cofins_rate: product.cofins_rate ?? '',
        ipi_rate: product.ipi_rate ?? '',
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
    const ncm = String(form.ncm || '').trim()
    const cfop = String(form.cfop || '').trim()
    const cest = String(form.cest || '').trim()

    if (!String(form.name || '').trim()) errors.name = 'Informe o nome do produto.'
    if (form.sale_price === '' || form.sale_price === null || form.sale_price === undefined) errors.sale_price = 'Informe o preco de venda.'
    if (ncm !== '' && !/^\d{8}$/.test(ncm)) errors.ncm = 'NCM deve ter 8 digitos.'
    if (cfop !== '' && !/^\d{4}$/.test(cfop)) errors.cfop = 'CFOP deve ter 4 digitos.'
    if (cest !== '' && !/^\d{7}$/.test(cest)) errors.cest = 'CEST deve ter 7 digitos.'

    Object.entries(numericFieldLabels).forEach(([field, label]) => {
        const numericValue = getNumberValue(form[field])
        if (Number.isNaN(numericValue)) {
            errors[field] = `${label} precisa ser um numero valido.`
            return
        }

        if (numericValue !== null && numericValue < 0) {
            errors[field] = `${label} nao pode ser negativo.`
        }

        if (numericValue !== null && ['icms_rate', 'pis_rate', 'cofins_rate', 'ipi_rate'].includes(field) && numericValue > 100) {
            errors[field] = `${label} nao pode ser maior que 100%.`
        }
    })

    return errors
}

function buildFormDraft(form) {
    return JSON.stringify(form)
}

export default function ProductFormModal({
    open,
    product,
    categories = [],
    suppliers = [],
    onClose,
    onSubmit,
    loading,
    onQuickCreateCategory,
    onQuickCreateSupplier,
}) {
    const moduleState = useModules()
    const [form, setForm] = useState(emptyForm)
    const [initialForm, setInitialForm] = useState(emptyForm)
    const [errors, setErrors] = useState({})
    const [submitError, setSubmitError] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [showFiscal, setShowFiscal] = useState(false)
    const [showQuickCategory, setShowQuickCategory] = useState(false)
    const [showQuickSupplier, setShowQuickSupplier] = useState(false)
    const [quickCategory, setQuickCategory] = useState({ name: '', description: '' })
    const [quickSupplier, setQuickSupplier] = useState({ name: '', phone: '', email: '' })
    const [creatingCategory, setCreatingCategory] = useState(false)
    const [creatingSupplier, setCreatingSupplier] = useState(false)
    const fiscalFieldsEnabled = Boolean(moduleState.modules?.fiscal_basico || moduleState.modules?.fiscal_avancado)

    useEffect(() => {
        if (!open) return

        const nextForm = normalizeFormData(product)

        setForm(nextForm)
        setInitialForm(nextForm)
        setErrors({})
        setSubmitError('')
        setShowAdvanced(false)
        setShowFiscal(fiscalFieldsEnabled && Boolean(product?.fiscal_enabled))
        setShowQuickCategory(false)
        setShowQuickSupplier(false)
        setQuickCategory({ name: '', description: '' })
        setQuickSupplier({ name: '', phone: '', email: '' })
    }, [fiscalFieldsEnabled, open, product])

    const hasUnsavedChanges = useMemo(() => {
        if (!open) return false

        return buildFormDraft(form) !== buildFormDraft(initialForm)
            || showQuickCategory
            || showQuickSupplier
            || quickCategory.name.trim() !== ''
            || quickSupplier.name.trim() !== ''
    }, [form, initialForm, open, quickCategory.name, quickSupplier.name, showQuickCategory, showQuickSupplier])

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

    function renderFieldError(fieldName) {
        if (!errors[fieldName]) return null
        return <span className="products-editor-error">{errors[fieldName]}</span>
    }

    async function requestClose() {
        if (loading) return

        if (!hasUnsavedChanges) {
            onClose()
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Descartar alteracoes',
            message: 'Fechar sem salvar este produto?',
            confirmLabel: 'Descartar',
            cancelLabel: 'Continuar',
        })

        if (confirmed) onClose()
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSubmitError('')

        const nextErrors = validateForm(form)
        setErrors(nextErrors)

        if (Object.keys(nextErrors).length > 0) {
            const firstMessage = nextErrors[Object.keys(nextErrors)[0]]
            showErrorPopup(firstMessage)
            return
        }

        try {
            await onSubmit({
                ...form,
                fiscal_enabled: fiscalFieldsEnabled ? Boolean(form.fiscal_enabled) : false,
                unit: form.unit || 'UN',
                commercial_unit: form.commercial_unit || form.unit || 'UN',
                taxable_unit: form.taxable_unit || form.commercial_unit || form.unit || 'UN',
            })
        } catch (error) {
            const message = error.message || 'Nao foi possivel salvar o produto.'
            setSubmitError(message)
            showErrorPopup(message)
        }
    }

    async function handleQuickCategoryCreate() {
        if (!onQuickCreateCategory) return
        if (!quickCategory.name.trim()) {
            showErrorPopup('Informe o nome da categoria.')
            return
        }

        setCreatingCategory(true)
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
            showErrorPopup(error.message || 'Falha ao criar categoria.')
        } finally {
            setCreatingCategory(false)
        }
    }

    async function handleQuickSupplierCreate() {
        if (!onQuickCreateSupplier) return
        if (!quickSupplier.name.trim()) {
            showErrorPopup('Informe o nome do fornecedor.')
            return
        }

        setCreatingSupplier(true)
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
            showErrorPopup(error.message || 'Falha ao criar fornecedor.')
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

    return (
        <div
            className="products-modal-backdrop"
            onClick={(event) => {
                if (event.target === event.currentTarget) requestClose()
            }}
        >
            <div className="products-modal products-editor-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <header className="products-modal-header products-editor-header">
                    <div>
                        <h2>{product ? 'Editar produto' : 'Novo produto'}</h2>
                        <p>Cadastro rapido para comecar a vender sem complicacao.</p>
                    </div>
                    <button
                        className="products-icon-button ui-tooltip"
                        data-tooltip="Fechar"
                        aria-label="Fechar cadastro"
                        onClick={requestClose}
                        type="button"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </header>

                <form className="products-editor-form products-quick-form" onSubmit={handleSubmit} noValidate>
                    <div className="products-editor-body">
                        <section className="products-editor-grid products-editor-tab-content">
                            <div className="products-editor-section-title span-2">
                                <h3>O produto</h3>
                            </div>

                            <label className={`products-editor-field span-2 ${errors.name ? 'has-error' : ''}`}>
                                <span>Nome do produto *</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-box" />
                                    <input autoFocus value={form.name ?? ''} onChange={(event) => updateField('name', event.target.value)} placeholder="Ex: Coca-Cola 2L" required />
                                </div>
                                {renderFieldError('name')}
                            </label>

                            <label className="products-editor-field">
                                <span>Codigo de barras</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-camera" />
                                    <input value={form.barcode ?? ''} onChange={(event) => updateField('barcode', event.target.value)} placeholder="Opcional" />
                                </div>
                            </label>

                            <label className="products-editor-field">
                                <span>Categoria</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-layer-group" />
                                    <select value={form.category_id ?? ''} onChange={(event) => handleCategorySelect(event.target.value)}>
                                        <option value="">Sem categoria</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                        {onQuickCreateCategory ? <option value={ADD_NEW_OPTION}>+ Criar categoria</option> : null}
                                    </select>
                                </div>
                            </label>

                            {showQuickCategory ? (
                                <article className="products-inline-create-card span-2">
                                    <strong>Nova categoria</strong>
                                    <div className="products-inline-create-grid">
                                        <input placeholder="Nome" value={quickCategory.name} onChange={(event) => setQuickCategory((current) => ({ ...current, name: event.target.value }))} />
                                        <input placeholder="Descricao opcional" value={quickCategory.description} onChange={(event) => setQuickCategory((current) => ({ ...current, description: event.target.value }))} />
                                    </div>
                                    <div className="products-inline-create-actions">
                                        <button type="button" className="ui-button-ghost" onClick={() => setShowQuickCategory(false)}>Cancelar</button>
                                        <button type="button" className="ui-button" onClick={handleQuickCategoryCreate} disabled={creatingCategory}>{creatingCategory ? 'Criando...' : 'Criar categoria'}</button>
                                    </div>
                                </article>
                            ) : null}

                            <div className="products-editor-section-title span-2">
                                <h3>Preco e estoque</h3>
                            </div>

                            <label className={`products-editor-field ${errors.sale_price ? 'has-error' : ''}`}>
                                <span>Preco de venda *</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-receipt" />
                                    <input type="number" step="0.01" min="0" value={form.sale_price ?? ''} onChange={(event) => updateField('sale_price', event.target.value)} required />
                                </div>
                                {renderFieldError('sale_price')}
                            </label>

                            <label className={`products-editor-field ${errors.cost_price ? 'has-error' : ''}`}>
                                <span>Custo</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-coins" />
                                    <input type="number" step="0.01" min="0" value={form.cost_price ?? ''} onChange={(event) => updateField('cost_price', event.target.value)} placeholder="Opcional" />
                                </div>
                                <small className="products-field-help">Usado para calcular seu lucro.</small>
                                {renderFieldError('cost_price')}
                            </label>

                            <label className={`products-editor-field ${errors.stock_quantity ? 'has-error' : ''}`}>
                                <span>Estoque atual</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-boxes-stacked" />
                                    <input type="number" step="0.001" min="0" value={form.stock_quantity ?? ''} onChange={(event) => updateField('stock_quantity', event.target.value)} placeholder="Opcional" disabled={Boolean(product)} />
                                </div>
                                {renderFieldError('stock_quantity')}
                            </label>

                            <label className={`products-editor-field ${errors.min_stock ? 'has-error' : ''}`}>
                                <span>Estoque minimo</span>
                                <div className="products-editor-input-wrap">
                                    <i className="fa-solid fa-triangle-exclamation" />
                                    <input type="number" step="0.001" min="0" value={form.min_stock ?? ''} onChange={(event) => updateField('min_stock', event.target.value)} placeholder="Opcional" />
                                </div>
                                <small className="products-field-help">Avisa quando estiver acabando.</small>
                                {renderFieldError('min_stock')}
                            </label>

                            <button type="button" className="products-advanced-link span-2" onClick={() => setShowAdvanced((current) => !current)}>
                                <i className={`fa-solid ${showAdvanced ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                                <span>{showAdvanced ? 'Ocultar dados avancados' : 'Ver dados avancados'}</span>
                            </button>

                            {showAdvanced ? (
                                <>
                                    <label className="products-editor-field">
                                        <span>Fornecedor - de quem voce compra</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-building" />
                                            <select value={form.supplier_id ?? ''} onChange={(event) => handleSupplierSelect(event.target.value)}>
                                                <option value="">Opcional</option>
                                                {suppliers.map((supplier) => (
                                                    <option key={supplier.id} value={supplier.id}>
                                                        {supplier.name}
                                                    </option>
                                                ))}
                                                {onQuickCreateSupplier ? <option value={ADD_NEW_OPTION}>+ Criar fornecedor</option> : null}
                                            </select>
                                        </div>
                                    </label>

                                    <label className="products-editor-field">
                                        <span>Unidade</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-ruler-combined" />
                                            <select value={form.unit ?? 'UN'} onChange={(event) => updateField('unit', event.target.value)}>
                                                <option value="UN">UN</option>
                                                <option value="CX">CX</option>
                                                <option value="KG">KG</option>
                                                <option value="L">L</option>
                                            </select>
                                        </div>
                                    </label>

                                    <label className="products-editor-field">
                                        <span>Codigo interno</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-hashtag" />
                                            <input value={form.code ?? ''} onChange={(event) => updateField('code', event.target.value)} placeholder="Opcional" />
                                        </div>
                                    </label>

                                    {showQuickSupplier ? (
                                        <article className="products-inline-create-card span-2">
                                            <strong>Novo fornecedor</strong>
                                            <div className="products-inline-create-grid">
                                                <input placeholder="Nome" value={quickSupplier.name} onChange={(event) => setQuickSupplier((current) => ({ ...current, name: event.target.value }))} />
                                                <input placeholder="Telefone" value={quickSupplier.phone} onChange={(event) => setQuickSupplier((current) => ({ ...current, phone: event.target.value }))} />
                                                <input placeholder="E-mail" type="email" value={quickSupplier.email} onChange={(event) => setQuickSupplier((current) => ({ ...current, email: event.target.value }))} />
                                            </div>
                                            <div className="products-inline-create-actions">
                                                <button type="button" className="ui-button-ghost" onClick={() => setShowQuickSupplier(false)}>Cancelar</button>
                                                <button type="button" className="ui-button" onClick={handleQuickSupplierCreate} disabled={creatingSupplier}>{creatingSupplier ? 'Criando...' : 'Criar fornecedor'}</button>
                                            </div>
                                        </article>
                                    ) : null}

                                    <label className="products-editor-field span-2">
                                        <span>Descricao</span>
                                        <textarea rows="3" value={form.description ?? ''} onChange={(event) => updateField('description', event.target.value)} />
                                    </label>

                                    <label className="products-editor-field span-2">
                                        <span>Observacoes internas</span>
                                        <textarea rows="3" value={form.internal_notes ?? ''} onChange={(event) => updateField('internal_notes', event.target.value)} />
                                    </label>

                                    <article className="products-editor-card span-2">
                                        <h3>Status</h3>
                                        <div className="products-editor-toggle-row">
                                            <button type="button" className={`products-editor-toggle ${form.active ? 'active' : ''}`} onClick={() => updateField('active', true)}>Ativo</button>
                                            <button type="button" className={`products-editor-toggle ${!form.active ? 'active' : ''}`} onClick={() => updateField('active', false)}>Inativo</button>
                                        </div>
                                    </article>
                                </>
                            ) : null}

                            {showAdvanced && fiscalFieldsEnabled ? (
                                <button type="button" className="products-advanced-link span-2" onClick={() => setShowFiscal((current) => !current)}>
                                    <i className={`fa-solid ${showFiscal ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                                    <span>{showFiscal ? 'Ocultar dados fiscais' : 'Ver dados fiscais'}</span>
                                </button>
                            ) : null}

                            {showAdvanced && fiscalFieldsEnabled && showFiscal ? (
                                <section className="products-editor-grid span-2">
                                    <article className="products-editor-card span-2">
                                        <h3>Dados fiscais</h3>
                                        <small>Preencha com o seu contador.</small>
                                        <div className="products-editor-toggle-row">
                                            <button type="button" className={`products-editor-toggle ${form.fiscal_enabled ? 'active' : ''}`} onClick={() => updateField('fiscal_enabled', true)}>Usa fiscal</button>
                                            <button type="button" className={`products-editor-toggle ${!form.fiscal_enabled ? 'active' : ''}`} onClick={() => updateField('fiscal_enabled', false)}>Nao usa fiscal</button>
                                        </div>
                                    </article>

                                    <label className={`products-editor-field ${errors.ncm ? 'has-error' : ''}`}>
                                        <span>NCM</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-barcode" />
                                            <input value={form.ncm ?? ''} maxLength={8} onChange={(event) => updateField('ncm', event.target.value.replace(/\D/g, ''))} />
                                        </div>
                                        {renderFieldError('ncm')}
                                    </label>

                                    <label className={`products-editor-field ${errors.cfop ? 'has-error' : ''}`}>
                                        <span>CFOP</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-file-invoice" />
                                            <input value={form.cfop ?? ''} maxLength={4} onChange={(event) => updateField('cfop', event.target.value.replace(/\D/g, ''))} />
                                        </div>
                                        {renderFieldError('cfop')}
                                    </label>

                                    <label className={`products-editor-field ${errors.cest ? 'has-error' : ''}`}>
                                        <span>CEST</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-box-archive" />
                                            <input value={form.cest ?? ''} maxLength={7} onChange={(event) => updateField('cest', event.target.value.replace(/\D/g, ''))} />
                                        </div>
                                        {renderFieldError('cest')}
                                    </label>

                                    <label className="products-editor-field">
                                        <span>CST / CSOSN ICMS</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-shield-halved" />
                                            <select value={form.icms_csosn ?? '102'} onChange={(event) => updateField('icms_csosn', event.target.value)}>
                                                {icmsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    </label>

                                    <label className="products-editor-field">
                                        <span>CST PIS</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-percent" />
                                            <select value={form.pis_cst ?? '49'} onChange={(event) => updateField('pis_cst', event.target.value)}>
                                                {pisOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    </label>

                                    <label className="products-editor-field">
                                        <span>CST COFINS</span>
                                        <div className="products-editor-input-wrap">
                                            <i className="fa-solid fa-percent" />
                                            <select value={form.cofins_cst ?? '49'} onChange={(event) => updateField('cofins_cst', event.target.value)}>
                                                {cofinsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    </label>
                                </section>
                            ) : null}
                        </section>
                    </div>

                    <footer className="products-modal-actions products-editor-actions">
                        {submitError ? (
                            <span className="products-editor-submit-error">{submitError}</span>
                        ) : (
                            <span className="products-editor-submit-hint">Obrigatorio: nome e preco de venda.</span>
                        )}
                        <div className="products-editor-action-buttons">
                            <button className="ui-button-ghost" type="button" onClick={requestClose}>Cancelar</button>
                            <button className="products-primary-button" type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar produto'}</button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    )
}

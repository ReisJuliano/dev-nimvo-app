import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import '../labels.css'
import PageContainer from '@/Components/UI/PageContainer'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'

const SCALE_PX_PER_MM = 8

const TEXT_BINDINGS = {
    static: 'Texto fixo',
    name: 'Nome do produto',
    price: 'Preço',
    promo_old_price: 'Preço promocional (De)',
    promo_new_price: 'Preço promocional (Por)',
}

function newId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `el_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function newTextElement() {
    return {
        id: newId(),
        type: 'text',
        binding: 'static',
        text: 'Texto',
        prefix: '',
        x_mm: 5,
        y_mm: 5,
        width_mm: 30,
        height_mm: 8,
        font_family: 'helvetica',
        font_size_pt: 8,
        bold: false,
        italic: false,
        underline: false,
        color: '#000000',
        align: 'left',
    }
}

function newShapeElement(labelWidth, labelHeight) {
    return {
        id: newId(),
        type: 'shape',
        x_mm: 0,
        y_mm: 0,
        width_mm: labelWidth,
        height_mm: labelHeight,
        fill_color: null,
        stroke_color: '#000000',
        stroke_width_mm: 0.2,
    }
}

function newBarcodeElement(labelWidth, labelHeight) {
    return {
        id: newId(),
        type: 'barcode',
        barcode_type: 'auto',
        show_human_readable: true,
        x_mm: 2,
        y_mm: Math.max(0, labelHeight - 4),
        width_mm: Math.max(1, labelWidth - 4),
        height_mm: 3,
        color: '#000000',
    }
}

export default function LabelLayoutEditor({ templateId }) {
    const [template, setTemplate] = useState(null)
    const [elements, setElements] = useState([])
    const [selectedId, setSelectedId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [previewing, setPreviewing] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const canvasRef = useRef(null)
    const dragState = useRef(null)

    useEffect(() => {
        let cancelled = false

        async function load() {
            setLoading(true)
            try {
                const response = await apiRequest(`/api/labels/templates/${templateId}`)
                if (cancelled) return
                setTemplate(response.template)
                setElements(response.template.layout?.elements || [])
            } catch (error) {
                if (!cancelled) setFeedback({ type: 'error', text: error.message })
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void load()
        return () => {
            cancelled = true
        }
    }, [templateId])

    const selectedElement = useMemo(() => elements.find((element) => element.id === selectedId) || null, [elements, selectedId])

    function updateElement(id, patch) {
        setElements((current) => current.map((element) => (element.id === id ? { ...element, ...patch } : element)))
    }

    function addElement(element) {
        setElements((current) => [...current, element])
        setSelectedId(element.id)
    }

    function removeSelected() {
        if (!selectedId) return
        setElements((current) => current.filter((element) => element.id !== selectedId))
        setSelectedId(null)
    }

    function moveSelected(direction) {
        if (!selectedId) return
        setElements((current) => {
            const index = current.findIndex((element) => element.id === selectedId)
            const targetIndex = index + direction
            if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return current
            const next = [...current]
            const [moved] = next.splice(index, 1)
            next.splice(targetIndex, 0, moved)
            return next
        })
    }

    function onElementPointerDown(event, element) {
        event.stopPropagation()
        setSelectedId(element.id)
        dragState.current = {
            id: element.id,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startXMm: Number(element.x_mm),
            startYMm: Number(element.y_mm),
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    function onElementPointerMove(event) {
        const drag = dragState.current
        if (!drag) return

        const deltaXMm = (event.clientX - drag.startClientX) / SCALE_PX_PER_MM
        const deltaYMm = (event.clientY - drag.startClientY) / SCALE_PX_PER_MM

        updateElement(drag.id, {
            x_mm: Math.round((drag.startXMm + deltaXMm) * 10) / 10,
            y_mm: Math.round((drag.startYMm + deltaYMm) * 10) / 10,
        })
    }

    function onElementPointerUp() {
        dragState.current = null
    }

    async function save() {
        setSaving(true)
        try {
            const response = await apiRequest(`/api/labels/templates/${templateId}/layout`, {
                method: 'put',
                data: { layout: { version: 1, elements } },
            })
            setTemplate(response.template)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function preview() {
        setPreviewing(true)
        try {
            const response = await window.axios({
                url: `/api/labels/templates/${templateId}/layout/preview`,
                method: 'post',
                data: { layout: { version: 1, elements } },
                responseType: 'blob',
            })
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
            window.open(url, '_blank')
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || 'Não foi possível gerar a prévia.' })
        } finally {
            setPreviewing(false)
        }
    }

    if (loading || !template) {
        return (
            <AppLayout title="Editor de layout">
                <PageContainer>
                    <p>Carregando...</p>
                </PageContainer>
            </AppLayout>
        )
    }

    const labelWidth = Number(template.label_width_mm)
    const labelHeight = Number(template.label_height_mm)

    return (
        <AppLayout title={`Layout — ${template.name}`}>
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                <div className="ui-filter-bar">
                    <Link href="/etiquetas/padroes" className="ui-button-ghost">
                        <i className="fa-solid fa-arrow-left" /> Voltar para padrões
                    </Link>
                    <button type="button" className="ui-button-ghost" onClick={() => addElement(newTextElement())}>
                        <i className="fa-solid fa-font" /> Texto
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => addElement(newShapeElement(labelWidth, labelHeight))}>
                        <i className="fa-solid fa-vector-square" /> Forma
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => addElement(newBarcodeElement(labelWidth, labelHeight))}>
                        <i className="fa-solid fa-barcode" /> Código de barras
                    </button>
                    <button type="button" className="ui-button-ghost" disabled={previewing} onClick={preview}>
                        <i className="fa-solid fa-eye" /> {previewing ? 'Gerando...' : 'Visualizar PDF'}
                    </button>
                    <button type="button" className="ui-button" disabled={saving} onClick={save}>
                        <i className="fa-solid fa-floppy-disk" /> {saving ? 'Salvando...' : 'Salvar layout'}
                    </button>
                </div>

                <div className="layout-editor-grid">
                    <div className="layout-editor-canvas-wrap">
                        <div
                            ref={canvasRef}
                            className="layout-editor-canvas"
                            style={{ width: labelWidth * SCALE_PX_PER_MM, height: labelHeight * SCALE_PX_PER_MM }}
                            onPointerDown={() => setSelectedId(null)}
                        >
                            {elements.map((element) => (
                                <div
                                    key={element.id}
                                    className={`layout-editor-element ${element.id === selectedId ? 'is-selected' : ''}`}
                                    style={{
                                        left: element.x_mm * SCALE_PX_PER_MM,
                                        top: element.y_mm * SCALE_PX_PER_MM,
                                        width: element.width_mm * SCALE_PX_PER_MM,
                                        height: element.height_mm * SCALE_PX_PER_MM,
                                    }}
                                    onPointerDown={(event) => onElementPointerDown(event, element)}
                                    onPointerMove={onElementPointerMove}
                                    onPointerUp={onElementPointerUp}
                                >
                                    <span className="layout-editor-element-label">
                                        {element.type === 'text' ? (TEXT_BINDINGS[element.binding] || element.binding) : null}
                                        {element.type === 'shape' ? 'Forma' : null}
                                        {element.type === 'barcode' ? 'Código de barras' : null}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="layout-editor-hint">Arraste os elementos para posicionar. Use o painel ao lado para ajustar tamanho e estilo.</p>
                    </div>

                    <div className="layout-editor-panel">
                        {!selectedElement ? (
                            <p>Selecione um elemento na etiqueta para editar, ou adicione um novo pelo menu acima.</p>
                        ) : (
                            <>
                                <div className="layout-editor-panel-header">
                                    <strong>{selectedElement.type === 'text' ? 'Texto' : selectedElement.type === 'shape' ? 'Forma' : 'Código de barras'}</strong>
                                    <div className="layout-editor-panel-actions">
                                        <button type="button" className="ui-icon-button" title="Trazer para trás" onClick={() => moveSelected(-1)}>
                                            <i className="fa-solid fa-arrow-down-wide-short" />
                                        </button>
                                        <button type="button" className="ui-icon-button" title="Trazer para frente" onClick={() => moveSelected(1)}>
                                            <i className="fa-solid fa-arrow-up-wide-short" />
                                        </button>
                                        <button type="button" className="ui-icon-button tone-danger" title="Excluir elemento" onClick={removeSelected}>
                                            <i className="fa-solid fa-trash" />
                                        </button>
                                    </div>
                                </div>

                                <div className="labels-toolbar">
                                    <label>
                                        <span>X (mm)</span>
                                        <input className="ui-input" type="number" step="0.1" value={selectedElement.x_mm} onChange={(event) => updateElement(selectedElement.id, { x_mm: Number(event.target.value) })} />
                                    </label>
                                    <label>
                                        <span>Y (mm)</span>
                                        <input className="ui-input" type="number" step="0.1" value={selectedElement.y_mm} onChange={(event) => updateElement(selectedElement.id, { y_mm: Number(event.target.value) })} />
                                    </label>
                                    <label>
                                        <span>Largura (mm)</span>
                                        <input className="ui-input" type="number" step="0.1" value={selectedElement.width_mm} onChange={(event) => updateElement(selectedElement.id, { width_mm: Number(event.target.value) })} />
                                    </label>
                                    <label>
                                        <span>Altura (mm)</span>
                                        <input className="ui-input" type="number" step="0.1" value={selectedElement.height_mm} onChange={(event) => updateElement(selectedElement.id, { height_mm: Number(event.target.value) })} />
                                    </label>
                                </div>

                                {selectedElement.type === 'shape' ? (
                                    <>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={selectedElement.fill_color !== null}
                                                onChange={(event) => updateElement(selectedElement.id, { fill_color: event.target.checked ? '#ffffff' : null })}
                                            />
                                            {' '}Preencher fundo
                                        </label>
                                        {selectedElement.fill_color !== null ? (
                                            <label>
                                                <span>Cor de preenchimento</span>
                                                <input type="color" value={selectedElement.fill_color} onChange={(event) => updateElement(selectedElement.id, { fill_color: event.target.value })} />
                                            </label>
                                        ) : null}
                                        <label>
                                            <span>Cor da borda</span>
                                            <input type="color" value={selectedElement.stroke_color} onChange={(event) => updateElement(selectedElement.id, { stroke_color: event.target.value })} />
                                        </label>
                                        <label>
                                            <span>Espessura da borda (mm)</span>
                                            <input className="ui-input" type="number" step="0.1" min="0" value={selectedElement.stroke_width_mm} onChange={(event) => updateElement(selectedElement.id, { stroke_width_mm: Number(event.target.value) })} />
                                        </label>
                                    </>
                                ) : null}

                                {selectedElement.type === 'text' ? (
                                    <>
                                        <label>
                                            <span>Conteúdo</span>
                                            <select value={selectedElement.binding} onChange={(event) => updateElement(selectedElement.id, { binding: event.target.value })}>
                                                {Object.entries(TEXT_BINDINGS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        {selectedElement.binding === 'static' ? (
                                            <label>
                                                <span>Texto fixo</span>
                                                <input className="ui-input" value={selectedElement.text || ''} onChange={(event) => updateElement(selectedElement.id, { text: event.target.value })} />
                                            </label>
                                        ) : (
                                            <label>
                                                <span>Prefixo (opcional)</span>
                                                <input className="ui-input" value={selectedElement.prefix || ''} onChange={(event) => updateElement(selectedElement.id, { prefix: event.target.value })} />
                                            </label>
                                        )}
                                        {selectedElement.binding === 'price' ? (
                                            <>
                                                <label>
                                                    <input type="checkbox" checked={Boolean(selectedElement.show_unit_suffix)} onChange={(event) => updateElement(selectedElement.id, { show_unit_suffix: event.target.checked })} />
                                                    {' '}Mostrar sufixo de unidade (/KG)
                                                </label>
                                                <label>
                                                    <input type="checkbox" checked={Boolean(selectedElement.hide_when_promo_active)} onChange={(event) => updateElement(selectedElement.id, { hide_when_promo_active: event.target.checked })} />
                                                    {' '}Ocultar quando promoção ativa
                                                </label>
                                            </>
                                        ) : null}
                                        <div className="labels-toolbar">
                                            <label>
                                                <span>Fonte</span>
                                                <select value={selectedElement.font_family} onChange={(event) => updateElement(selectedElement.id, { font_family: event.target.value })}>
                                                    <option value="helvetica">Helvetica</option>
                                                    <option value="times">Times</option>
                                                    <option value="courier">Courier</option>
                                                </select>
                                            </label>
                                            <label>
                                                <span>Tamanho (pt)</span>
                                                <input className="ui-input" type="number" min="4" max="72" value={selectedElement.font_size_pt} onChange={(event) => updateElement(selectedElement.id, { font_size_pt: Number(event.target.value) })} />
                                            </label>
                                            <label>
                                                <span>Alinhamento</span>
                                                <select value={selectedElement.align} onChange={(event) => updateElement(selectedElement.id, { align: event.target.value })}>
                                                    <option value="left">Esquerda</option>
                                                    <option value="center">Centro</option>
                                                    <option value="right">Direita</option>
                                                </select>
                                            </label>
                                            <label>
                                                <span>Cor</span>
                                                <input type="color" value={selectedElement.color} onChange={(event) => updateElement(selectedElement.id, { color: event.target.value })} />
                                            </label>
                                        </div>
                                        <div className="labels-toolbar">
                                            <label>
                                                <input type="checkbox" checked={Boolean(selectedElement.bold)} onChange={(event) => updateElement(selectedElement.id, { bold: event.target.checked })} />
                                                {' '}Negrito
                                            </label>
                                            <label>
                                                <input type="checkbox" checked={Boolean(selectedElement.italic)} onChange={(event) => updateElement(selectedElement.id, { italic: event.target.checked })} />
                                                {' '}Itálico
                                            </label>
                                            <label>
                                                <input type="checkbox" checked={Boolean(selectedElement.underline)} onChange={(event) => updateElement(selectedElement.id, { underline: event.target.checked })} />
                                                {' '}Sublinhado
                                            </label>
                                        </div>
                                    </>
                                ) : null}

                                {selectedElement.type === 'barcode' ? (
                                    <>
                                        <label>
                                            <input type="checkbox" checked={Boolean(selectedElement.show_human_readable)} onChange={(event) => updateElement(selectedElement.id, { show_human_readable: event.target.checked })} />
                                            {' '}Mostrar código legível
                                        </label>
                                        <label>
                                            <span>Cor</span>
                                            <input type="color" value={selectedElement.color} onChange={(event) => updateElement(selectedElement.id, { color: event.target.value })} />
                                        </label>
                                        <p className="layout-editor-hint">O tipo de código (EAN-13/Code-128) é definido pelo padrão de etiqueta e pelo código de cada produto.</p>
                                    </>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>
            </PageContainer>
        </AppLayout>
    )
}

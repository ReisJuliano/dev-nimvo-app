import { useEffect, useState } from 'react'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import { apiRequest } from '@/lib/http'

function emptyLayoutForm() {
    return {
        id: null,
        name: '',
        direction: 'import',
        format: 'delimited',
        delimiter: ';',
        decimal_separator: ',',
        has_header: false,
        encoding: 'UTF-8',
        line_ending: 'CRLF',
        fields: [{ name: 'barcode', position: 1, start: 1, length: 14 }, { name: 'quantity', position: 2, start: 15, length: 10 }],
    }
}

export default function LayoutsModal({ open, onClose }) {
    const [layouts, setLayouts] = useState([])
    const [form, setForm] = useState(emptyLayoutForm())
    const [sampleLines, setSampleLines] = useState('')
    const [preview, setPreview] = useState(null)
    const [feedback, setFeedback] = useState(null)

    async function refresh() {
        try {
            const response = await apiRequest('/api/inventory/collector-layouts')
            setLayouts(response.layouts || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    useEffect(() => {
        if (open) void refresh()
    }, [open])

    function updateField(index, key, value) {
        setForm((current) => ({
            ...current,
            fields: current.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, [key]: value } : field)),
        }))
    }

    function addField() {
        setForm((current) => ({ ...current, fields: [...current.fields, { name: 'quantity', position: current.fields.length + 1, start: 1, length: 10 }] }))
    }

    function removeField(index) {
        setForm((current) => ({ ...current, fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index) }))
    }

    function buildConfig() {
        const fields = form.fields.map((field) => (
            form.format === 'fixed_width'
                ? { name: field.name, start: Number(field.start), length: Number(field.length), implied_decimals: field.name === 'quantity' ? Number(field.implied_decimals || 0) : undefined }
                : { name: field.name, position: Number(field.position) }
        ))

        return {
            encoding: form.encoding,
            line_ending: form.line_ending,
            has_header: Boolean(form.has_header),
            delimiter: form.delimiter,
            decimal_separator: form.decimal_separator,
            fields,
        }
    }

    async function runPreview() {
        try {
            const response = await apiRequest('/api/inventory/collector-layouts/preview', {
                method: 'post',
                data: {
                    format: form.format,
                    config: buildConfig(),
                    sample_lines: sampleLines.split('\n').filter((line) => line.trim() !== ''),
                },
            })
            setPreview(response.preview)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function saveLayout(event) {
        event.preventDefault()

        try {
            const payload = { name: form.name, direction: form.direction, format: form.format, config: buildConfig() }
            const response = form.id
                ? await apiRequest(`/api/inventory/collector-layouts/${form.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/inventory/collector-layouts', { method: 'post', data: payload })

            setFeedback({ type: 'success', text: response.message })
            setForm(emptyLayoutForm())
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function editLayout(layout) {
        const config = layout.config || {}
        setForm({
            id: layout.id,
            name: layout.name,
            direction: layout.direction,
            format: layout.format,
            delimiter: config.delimiter || ';',
            decimal_separator: config.decimal_separator || ',',
            has_header: Boolean(config.has_header),
            encoding: config.encoding || 'UTF-8',
            line_ending: config.line_ending || 'CRLF',
            fields: config.fields || [],
        })
    }

    async function removeLayout(layout) {
        try {
            const response = await apiRequest(`/api/inventory/collector-layouts/${layout.id}`, { method: 'delete' })
            setFeedback({ type: 'success', text: response.message })
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <CompactModal open={open} title="Layouts de coletor" icon="fa-sliders" size="lg" onClose={onClose}>
            {feedback ? (
                <div className={`ui-alert ${feedback.type}`}>
                    <p>{feedback.text}</p>
                </div>
            ) : null}

            <DataTable
                columns={[
                    { key: 'name', label: 'Nome' },
                    { key: 'direction', label: 'Direção', render: (row) => (row.direction === 'import' ? 'Importação' : 'Exportação') },
                    { key: 'format', label: 'Formato', render: (row) => (row.format === 'delimited' ? 'Delimitado' : 'Posicional') },
                    { key: 'is_default', label: 'Padrão', render: (row) => (row.is_default ? 'Sim' : 'Não') },
                ]}
                rows={layouts}
                rowKey="id"
                emptyMessage="Nenhum layout cadastrado."
                actions={(row) => [
                    { key: 'edit', icon: 'fa-pen', label: 'Editar', onClick: () => void editLayout(row) },
                    ...(row.is_default ? [] : [{ key: 'delete', icon: 'fa-trash', label: 'Excluir', tone: 'danger', onClick: () => void removeLayout(row) }]),
                ]}
            />

            <h4>{form.id ? 'Editar layout' : 'Novo layout'}</h4>
            <form onSubmit={saveLayout}>
                <label>
                    <span>Nome</span>
                    <input className="ui-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label>
                    <span>Direção</span>
                    <select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}>
                        <option value="import">Importação (contagem)</option>
                        <option value="export">Exportação (carga)</option>
                    </select>
                </label>
                <label>
                    <span>Formato</span>
                    <select value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}>
                        <option value="delimited">Delimitado</option>
                        <option value="fixed_width">Posicional</option>
                    </select>
                </label>
                <label>
                    <span>Codificação</span>
                    <select value={form.encoding} onChange={(event) => setForm((current) => ({ ...current, encoding: event.target.value }))}>
                        <option value="UTF-8">UTF-8</option>
                        <option value="ISO-8859-1">ISO-8859-1</option>
                    </select>
                </label>
                {form.format === 'delimited' ? (
                    <>
                        <label>
                            <span>Delimitador</span>
                            <input className="ui-input" value={form.delimiter} onChange={(event) => setForm((current) => ({ ...current, delimiter: event.target.value }))} />
                        </label>
                        <label>
                            <span>Separador decimal</span>
                            <input className="ui-input" value={form.decimal_separator} onChange={(event) => setForm((current) => ({ ...current, decimal_separator: event.target.value }))} />
                        </label>
                        <label>
                            <input type="checkbox" checked={form.has_header} onChange={(event) => setForm((current) => ({ ...current, has_header: event.target.checked }))} />
                            {' '}Possui cabeçalho
                        </label>
                    </>
                ) : null}

                <h5>Campos</h5>
                <div className="inventory-layout-fields">
                    {form.fields.map((field, index) => (
                        <div key={index} className="inventory-layout-field-row">
                            <select value={field.name} onChange={(event) => updateField(index, 'name', event.target.value)}>
                                <option value="barcode">Código de barras</option>
                                <option value="internal_code">Código interno</option>
                                <option value="quantity">Quantidade</option>
                                <option value="description">Descrição</option>
                            </select>
                            {form.format === 'fixed_width' ? (
                                <>
                                    <input className="ui-input" type="number" placeholder="Início" value={field.start || ''} onChange={(event) => updateField(index, 'start', event.target.value)} />
                                    <input className="ui-input" type="number" placeholder="Tamanho" value={field.length || ''} onChange={(event) => updateField(index, 'length', event.target.value)} />
                                    {field.name === 'quantity' ? (
                                        <input className="ui-input" type="number" placeholder="Decimais implícitas" value={field.implied_decimals || ''} onChange={(event) => updateField(index, 'implied_decimals', event.target.value)} />
                                    ) : <span />}
                                </>
                            ) : (
                                <>
                                    <input className="ui-input" type="number" placeholder="Posição" value={field.position || ''} onChange={(event) => updateField(index, 'position', event.target.value)} />
                                    <span />
                                    <span />
                                </>
                            )}
                            <button type="button" className="ui-icon-button" onClick={() => removeField(index)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" className="ui-button-ghost" onClick={addField}>+ Adicionar campo</button>

                <h5>Pré-visualização</h5>
                <textarea className="ui-input" rows={3} placeholder="Cole 2-3 linhas de exemplo" value={sampleLines} onChange={(event) => setSampleLines(event.target.value)} />
                <button type="button" className="ui-button-ghost" onClick={runPreview}>Testar layout</button>

                {preview ? (
                    <table className="inventory-preview-table">
                        <thead><tr><th>Código</th><th>Código interno</th><th>Quantidade</th></tr></thead>
                        <tbody>
                            {preview.map((line, index) => (
                                <tr key={index}>
                                    <td>{line.barcode}</td>
                                    <td>{line.internal_code}</td>
                                    <td>{line.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}

                <div className="ivs-wizard-actions">
                    <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyLayoutForm())}>Limpar</button>
                    <button type="submit" className="ui-button">{form.id ? 'Salvar alterações' : 'Criar layout'}</button>
                </div>
            </form>
        </CompactModal>
    )
}

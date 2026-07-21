import { useRef, useState } from 'react'
import CompactModal from '@/Components/UI/CompactModal'
import { apiRequest } from '@/lib/http'

const TEMPLATE_HEADERS = 'nome,documento,nome_fantasia,telefone,email'
const TEMPLATE_SAMPLE = 'Distribuidora ABC LTDA,12345678000199,ABC Distribuidora,1140028922,contato@abc.example.com'

function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE_HEADERS}\n${TEMPLATE_SAMPLE}\n`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-importacao-fornecedores.csv'
    link.click()
    URL.revokeObjectURL(url)
}

export default function SupplierImportModal({ open, onClose, onImported }) {
    const fileInputRef = useRef(null)
    const [fileName, setFileName] = useState('')
    const [rows, setRows] = useState(null)
    const [summary, setSummary] = useState(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [committing, setCommitting] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    function reset() {
        setFileName('')
        setRows(null)
        setSummary(null)
        setResult(null)
        setError(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    function handleClose() {
        reset()
        onClose()
    }

    async function handleFileChange(event) {
        const file = event.target.files?.[0]

        if (!file) return

        setFileName(file.name)
        setAnalyzing(true)
        setError(null)
        setRows(null)
        setSummary(null)
        setResult(null)

        try {
            const formData = new FormData()
            formData.append('file', file)
            const response = await apiRequest('/api/suppliers/import/preview', { method: 'post', data: formData })
            setRows(response.rows)
            setSummary(response.summary)
        } catch (submitError) {
            setError(submitError.message)
        } finally {
            setAnalyzing(false)
        }
    }

    async function handleConfirm() {
        if (!rows?.length) return

        setCommitting(true)
        setError(null)

        try {
            const response = await apiRequest('/api/suppliers/import/commit', { method: 'post', data: { rows } })
            setResult(response)
            onImported?.()
        } catch (submitError) {
            setError(submitError.message)
        } finally {
            setCommitting(false)
        }
    }

    const validRows = (rows || []).filter((row) => !row.errors?.length)

    return (
        <CompactModal
            open={open}
            badge="Import"
            title="Importar fornecedores em massa"
            description="Envie uma planilha CSV para cadastrar ou atualizar vários fornecedores de uma vez."
            icon="fa-file-import"
            size="lg"
            onClose={handleClose}
        >
            <div className="proc-ui-modal-stack">
                {!result ? (
                    <>
                        <section className="proc-ui-modal-block">
                            <h3>1. Baixe o modelo</h3>
                            <p className="proc-ui-muted">
                                Colunas aceitas: nome*, documento (CNPJ/CPF), nome_fantasia, telefone, email.
                                Campos com * são obrigatórios.
                            </p>
                            <button type="button" className="ui-button-ghost" onClick={downloadTemplate}>
                                <i className="fa-solid fa-download" />
                                <span>Baixar modelo CSV</span>
                            </button>
                        </section>

                        <section className="proc-ui-modal-block">
                            <h3>2. Envie o arquivo preenchido</h3>
                            <div className="proc-ui-field full">
                                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} />
                                {fileName ? <small>{fileName}</small> : null}
                            </div>
                            {analyzing ? <p className="proc-ui-muted">Analisando arquivo...</p> : null}
                        </section>

                        {error ? (
                            <div className="proc-ui-flash error">
                                <i className="fa-solid fa-triangle-exclamation" />
                                <span>{error}</span>
                            </div>
                        ) : null}

                        {rows ? (
                            <section className="proc-ui-modal-block">
                                <h3>3. Confira antes de importar</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Total de linhas</span><strong>{summary.total}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Prontas para importar</span><strong>{summary.valid}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Com erro</span><strong>{summary.with_errors}</strong></article>
                                </div>

                                <div className="proc-ui-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                                    <table className="proc-ui-table">
                                        <thead>
                                            <tr>
                                                <th>Linha</th>
                                                <th>Ação</th>
                                                <th>Nome</th>
                                                <th>Situação</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={row.row_number}>
                                                    <td>{row.row_number}</td>
                                                    <td>{row.action === 'update' ? 'Atualizar' : 'Criar'}</td>
                                                    <td>{row.preview.name || '-'}</td>
                                                    <td>
                                                        {row.errors?.length ? (
                                                            <span className="proc-ui-badge danger">{row.errors.join(' ')}</span>
                                                        ) : (
                                                            <span className="proc-ui-badge success">OK</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ) : null}

                        <div className="proc-ui-modal-footer">
                            <button type="button" className="ui-button-ghost" onClick={handleClose}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="ui-button"
                                disabled={!validRows.length || committing}
                                onClick={() => void handleConfirm()}
                            >
                                {committing ? 'Importando...' : `Importar ${validRows.length} fornecedor(es)`}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="proc-ui-flash success">
                            <i className="fa-solid fa-circle-check" />
                            <span>{result.message}</span>
                        </div>

                        {result.failures?.length ? (
                            <section className="proc-ui-modal-block">
                                <h3>Falhas na importação</h3>
                                <div className="proc-ui-surface-list">
                                    {result.failures.map((failure) => (
                                        <div key={failure.row} className="proc-ui-surface-item">
                                            <span>Linha {failure.row}</span>
                                            <span>{failure.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <div className="proc-ui-modal-footer">
                            <button type="button" className="ui-button" onClick={handleClose}>
                                Concluir
                            </button>
                        </div>
                    </>
                )}
            </div>
        </CompactModal>
    )
}

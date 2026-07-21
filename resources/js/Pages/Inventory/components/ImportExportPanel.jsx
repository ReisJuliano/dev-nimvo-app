import DataTable from '@/Components/UI/DataTable'
import { formatNumber } from '@/lib/format'

export default function ImportExportPanel({
    exportLayouts,
    importLayouts,
    importForm,
    setImportForm,
    importResult,
    importing,
    onSubmitImport,
    onDownloadExport,
}) {
    return (
        <div className="ivs-import-export">
            <div className="nimvo-card">
                <p className="nimvo-section-label">Exportar carga pro coletor</p>
                <div className="ivs-layout-buttons">
                    {exportLayouts.map((layout) => (
                        <button key={layout.id} type="button" className="ui-button-ghost" onClick={() => onDownloadExport(layout.id)}>
                            <i className="fa-solid fa-file-export" /> {layout.name}
                        </button>
                    ))}
                    {!exportLayouts.length ? <p>Nenhum layout de exportação cadastrado.</p> : null}
                </div>
            </div>

            <div className="nimvo-card">
                <p className="nimvo-section-label">Importar contagem do coletor</p>
                <form className="ivs-import-form" onSubmit={onSubmitImport}>
                    <label>
                        <span>Layout</span>
                        <select value={importForm.layout_id} onChange={(event) => setImportForm((current) => ({ ...current, layout_id: event.target.value }))}>
                            <option value="">Selecione</option>
                            {importLayouts.map((layout) => (
                                <option key={layout.id} value={layout.id}>{layout.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Rodada</span>
                        <input className="ui-input" type="number" min="1" max="5" value={importForm.count_round} onChange={(event) => setImportForm((current) => ({ ...current, count_round: event.target.value }))} />
                    </label>
                    <label>
                        <span>Arquivo (.txt)</span>
                        <input type="file" accept=".txt" onChange={(event) => setImportForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                    </label>
                    <button type="submit" className="ui-button" disabled={importing}>{importing ? 'Processando...' : 'Importar'}</button>
                </form>

                {importResult ? (
                    <div className="ui-alert success">
                        <i className="fa-solid fa-circle-check" />
                        <p>
                            Total: {importResult.total_lines} · Casadas: {importResult.matched_lines} · Somadas: {importResult.duplicate_lines} · Não encontradas: {importResult.unmatched_lines}
                        </p>
                    </div>
                ) : null}

                {importResult?.unmatched_payload?.length ? (
                    <>
                        <p className="nimvo-section-label">Pendências</p>
                        <DataTable
                            columns={[
                                { key: 'barcode', label: 'Código' },
                                { key: 'quantity', label: 'Quantidade', render: (row) => formatNumber(row.quantity, { maximumFractionDigits: 3 }) },
                                { key: 'line_count', label: 'Linhas somadas' },
                            ]}
                            rows={importResult.unmatched_payload}
                            rowKey="barcode"
                            emptyMessage="Sem pendências."
                        />
                    </>
                ) : null}
            </div>
        </div>
    )
}

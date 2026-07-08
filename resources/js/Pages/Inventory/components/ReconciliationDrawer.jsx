import ActionDrawer from '@/Components/UI/ActionDrawer'
import { formatNumber } from '@/lib/format'
import { movementTypeLabel } from '../constants'

export default function ReconciliationDrawer({ open, item, data, loading, onClose }) {
    return (
        <ActionDrawer
            open={open}
            onClose={onClose}
            icon="fa-arrows-turn-to-dots"
            title="Reconciliação da contagem"
            description={item?.product_name}
        >
            {loading ? (
                <p>Calculando...</p>
            ) : data ? (
                <div className="ivs-reconciliation">
                    <div className="ivs-reconciliation-line">
                        <span>Estoque no início da sessão</span>
                        <b>{formatNumber(data.snapshot_quantity, { maximumFractionDigits: 3 })}</b>
                    </div>

                    {Object.entries(data.movement_breakdown).length ? (
                        Object.entries(data.movement_breakdown).map(([type, value]) => (
                            <div key={type} className="ivs-reconciliation-line ivs-reconciliation-line--muted">
                                <span>{movementTypeLabel(type)} durante a contagem</span>
                                <b className={value >= 0 ? 'ivs-text-positive' : 'ivs-text-negative'}>
                                    {value > 0 ? '+' : ''}{formatNumber(value, { maximumFractionDigits: 3 })}
                                </b>
                            </div>
                        ))
                    ) : (
                        <div className="ivs-reconciliation-line ivs-reconciliation-line--muted">
                            <span>Nenhuma venda, entrada ou perda registrada durante a contagem</span>
                        </div>
                    )}

                    <div className="ivs-reconciliation-line ivs-reconciliation-line--total">
                        <span>Esperado agora (estoque + movimentações)</span>
                        <b>{formatNumber(data.expected_quantity, { maximumFractionDigits: 3 })}</b>
                    </div>

                    <div className="ivs-reconciliation-line ivs-reconciliation-line--total">
                        <span>Contado</span>
                        <b>{data.counted_quantity === null ? '-' : formatNumber(data.counted_quantity, { maximumFractionDigits: 3 })}</b>
                    </div>

                    {data.delta !== null ? (
                        <div className="ivs-reconciliation-result">
                            <span>Divergência real (já descontando vendas e entradas)</span>
                            <strong className={data.delta >= 0 ? 'ivs-text-positive' : 'ivs-text-negative'}>
                                {data.delta > 0 ? '+' : ''}{formatNumber(data.delta, { maximumFractionDigits: 3 })}
                            </strong>
                        </div>
                    ) : null}
                </div>
            ) : (
                <p>Sem dados de reconciliação.</p>
            )}
        </ActionDrawer>
    )
}

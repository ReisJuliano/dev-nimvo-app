import DenseTable from '@/Components/UI/DenseTable'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatMoney } from '@/lib/format'

function buildRowMeta(conditionalSale) {
    const meta = []

    if (conditionalSale.days_overdue > 0) {
        meta.push(`${conditionalSale.days_overdue} dia(s) em atraso`)
    }

    if (conditionalSale.sale?.sale_number) {
        meta.push(`Venda ${conditionalSale.sale.sale_number}`)
    }

    return meta.join(' · ') || 'Sem ocorrencias'
}

export default function ConditionalSalesTableCard({
    conditionals,
    selectedConditionalId,
    onSelect,
}) {
    return (
        <section className="products-table-card conditional-list-card">
            <div className="products-table-header conditional-list-head">
                <div>
                    <h2>Carteira</h2>
                    <p>{conditionals.length} registro(s) no filtro atual</p>
                </div>
            </div>

            <DenseTable
                className="conditional-dense-table"
                columns={[
                    {
                        key: 'code',
                        label: 'Condicional',
                        render: (conditionalSale) => (
                            <div className="conditional-row-title">
                                <strong>{conditionalSale.code}</strong>
                                <span>{buildRowMeta(conditionalSale)}</span>
                            </div>
                        ),
                    },
                    {
                        key: 'customer',
                        label: 'Cliente',
                        render: (conditionalSale) => conditionalSale.customer.name,
                    },
                    {
                        key: 'due_at',
                        label: 'Prazo',
                        render: (conditionalSale) => formatDate(conditionalSale.due_at),
                    },
                    {
                        key: 'outstanding_total',
                        label: 'Em aberto',
                        render: (conditionalSale) => formatMoney(conditionalSale.outstanding_total),
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (conditionalSale) => (
                            <StatusBadge compact label={conditionalSale.status_label} tone={conditionalSale.status_tone} />
                        ),
                    },
                ]}
                rows={conditionals}
                selectedRowKey={selectedConditionalId}
                onRowClick={(conditionalSale) => onSelect(conditionalSale.id)}
                emptyState={(
                    <div className="conditional-empty">
                        <i className="fa-solid fa-right-left" />
                        <strong>Sem registros</strong>
                        <span>Nenhuma condicional encontrada neste filtro.</span>
                    </div>
                )}
                getRowActions={(conditionalSale) => [
                    {
                        key: 'view',
                        icon: 'fa-eye',
                        label: 'Ver detalhes',
                        tone: 'primary',
                        onClick: () => onSelect(conditionalSale.id),
                    },
                ]}
            />
        </section>
    )
}

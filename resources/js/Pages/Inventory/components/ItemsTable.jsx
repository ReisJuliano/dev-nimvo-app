import DenseTable from '@/Components/UI/DenseTable'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatMoney, formatNumber } from '@/lib/format'
import { itemStatusLabel, itemStatusTone } from '../constants'

export default function ItemsTable({
    items,
    blind = false,
    selectable = false,
    selectedIds = new Set(),
    onToggleSelect,
    onRowClick,
    getRowActions,
    loading = false,
}) {
    const columns = []

    if (selectable) {
        columns.push({
            key: 'selected',
            label: '',
            className: 'ivs-checkbox-cell',
            render: (row) => (
                <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => onToggleSelect?.(row.id)}
                    onClick={(event) => event.stopPropagation()}
                />
            ),
        })
    }

    columns.push(
        { key: 'product_code', label: 'Código' },
        {
            key: 'product_name',
            label: 'Produto',
            render: (row) => (
                <div className="ivs-product-cell">
                    <strong>{row.product_name}</strong>
                    <small>{row.category_name || 'Sem categoria'}</small>
                </div>
            ),
        },
        {
            key: 'snapshot_quantity',
            label: 'Sistema',
            render: (row) => (blind || row.snapshot_quantity === null ? '•••' : formatNumber(row.snapshot_quantity, { maximumFractionDigits: 3 })),
        },
        {
            key: 'counted_quantity',
            label: 'Contado',
            render: (row) => (row.counted_quantity === null ? '-' : formatNumber(row.counted_quantity, { maximumFractionDigits: 3 })),
        },
    )

    if (!blind) {
        columns.push(
            {
                key: 'delta',
                label: 'Divergência',
                render: (row) => {
                    if (row.delta === null) return '-'
                    const tone = row.delta > 0 ? 'ivs-text-positive' : row.delta < 0 ? 'ivs-text-negative' : ''
                    return <span className={tone}>{row.delta > 0 ? '+' : ''}{formatNumber(row.delta, { maximumFractionDigits: 3 })}</span>
                },
            },
            {
                key: 'delta_value',
                label: 'Valor',
                render: (row) => (row.delta_value === null ? '-' : formatMoney(row.delta_value)),
            },
        )
    }

    columns.push({
        key: 'status',
        label: 'Status',
        render: (row) => <StatusBadge tone={itemStatusTone(row.status)} compact>{itemStatusLabel(row.status)}</StatusBadge>,
    })

    return (
        <DenseTable
            columns={columns}
            rows={items}
            rowKey="id"
            onRowClick={onRowClick}
            getRowActions={getRowActions}
            emptyState={<p>{loading ? 'Carregando...' : 'Nenhum item encontrado.'}</p>}
        />
    )
}

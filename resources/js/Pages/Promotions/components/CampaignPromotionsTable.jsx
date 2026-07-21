import DataTable from '@/Components/UI/DataTable'
import StatusBadge from '@/Components/UI/StatusBadge'
import { promotionStatusTone, typeLabel } from '../constants'

export default function CampaignPromotionsTable({ promotions, loading, onEdit, onDuplicate, onDelete }) {
    const rows = promotions.map((promotion) => ({
        ...promotion,
        target_label: promotion.scope === 'product' ? (promotion.product_name || '-') : (promotion.category_name || '-'),
        type_label: typeLabel(promotion.type),
    }))

    return (
        <DataTable
            columns={[
                { key: 'target_label', label: 'Produto/Categoria' },
                { key: 'type_label', label: 'Tipo' },
                { key: 'offer_summary', label: 'Oferta' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={promotionStatusTone(row.status)} compact>{row.status}</StatusBadge> },
            ]}
            rows={rows}
            rowKey="id"
            onRowClick={(row) => onEdit(row)}
            emptyMessage={loading ? 'Carregando...' : 'Nenhuma oferta neste tabloide ainda. Use a busca acima pra adicionar produtos.'}
            emptyIcon="fa-tag"
            actions={(row) => [
                { key: 'duplicate', icon: 'fa-copy', label: 'Duplicar', onClick: () => onDuplicate(row) },
                { key: 'delete', icon: 'fa-trash', label: 'Excluir', tone: 'danger', onClick: () => onDelete(row) },
            ]}
        />
    )
}

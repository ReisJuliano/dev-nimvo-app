import { useState } from 'react'
import CompactModal from '@/Components/UI/CompactModal'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate } from '@/lib/format'
import { campaignStatusTone } from '../constants'
import BulkAddProductsPanel from './BulkAddProductsPanel'
import CampaignPromotionsTable from './CampaignPromotionsTable'
import CampaignPerformancePanel from './CampaignPerformancePanel'

export default function CampaignDetailModal({
    campaign,
    onClose,
    onRefresh,
    onEditCampaign,
    onDuplicateCampaign,
    onDeleteCampaign,
    onDownloadPdf,
    onNewPromotionInCampaign,
    onEditPromotion,
    onDuplicatePromotion,
    onDeletePromotion,
}) {
    const [tab, setTab] = useState('ofertas')

    if (!campaign) {
        return null
    }

    const promotions = campaign.promotions || []
    const existingProductIds = promotions.filter((p) => p.scope === 'product').map((p) => p.product_id)

    return (
        <CompactModal
            open
            size="full"
            icon="fa-newspaper"
            title={campaign.name}
            badge={campaign.code}
            description={campaign.starts_at || campaign.ends_at
                ? `${campaign.starts_at ? formatDate(campaign.starts_at) : '...'} — ${campaign.ends_at ? formatDate(campaign.ends_at) : '...'}`
                : 'Sem vigência definida'}
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="ui-button-ghost" onClick={() => onDeleteCampaign(campaign)}>
                        <i className="fa-solid fa-trash" /> Excluir
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => onDuplicateCampaign(campaign)}>
                        <i className="fa-solid fa-copy" /> Duplicar
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => onDownloadPdf(campaign)}>
                        <i className="fa-solid fa-file-pdf" /> Baixar PDF
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => onEditCampaign(campaign)}>
                        <i className="fa-solid fa-pen" /> Editar tabloide
                    </button>
                    <button type="button" className="ui-button" onClick={() => onNewPromotionInCampaign(campaign)}>
                        <i className="fa-solid fa-plus" /> Nova oferta
                    </button>
                </>
            )}
        >
            <div className="promo-campaign-detail">
                <div className="promo-campaign-detail-top">
                    <StatusBadge tone={campaignStatusTone(campaign.status)}>{campaign.status}</StatusBadge>
                    <span>{campaign.active_promotions_count} de {campaign.promotions_count} oferta(s) ativa(s)</span>
                    {campaign.description ? <p>{campaign.description}</p> : null}
                </div>

                <div className="ui-tabs promo-detail-tabs">
                    <button type="button" className={`ui-tab ${tab === 'ofertas' ? 'active' : ''}`} onClick={() => setTab('ofertas')}>Ofertas</button>
                    <button type="button" className={`ui-tab ${tab === 'desempenho' ? 'active' : ''}`} onClick={() => setTab('desempenho')}>Desempenho</button>
                </div>

                {tab === 'ofertas' ? (
                    <>
                        <BulkAddProductsPanel
                            campaignId={campaign.id}
                            existingProductIds={existingProductIds}
                            onAdded={onRefresh}
                        />

                        <CampaignPromotionsTable
                            promotions={promotions}
                            onEdit={onEditPromotion}
                            onDuplicate={onDuplicatePromotion}
                            onDelete={onDeletePromotion}
                        />
                    </>
                ) : (
                    <CampaignPerformancePanel campaignId={campaign.id} />
                )}
            </div>
        </CompactModal>
    )
}

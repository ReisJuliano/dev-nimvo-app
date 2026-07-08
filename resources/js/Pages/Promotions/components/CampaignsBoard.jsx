import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate } from '@/lib/format'
import { campaignStatusTone } from '../constants'

function vigencia(campaign) {
    if (!campaign.starts_at && !campaign.ends_at) return 'Sem vigência definida'
    if (campaign.starts_at && campaign.ends_at) return `${formatDate(campaign.starts_at)} — ${formatDate(campaign.ends_at)}`
    if (campaign.starts_at) return `A partir de ${formatDate(campaign.starts_at)}`
    return `Até ${formatDate(campaign.ends_at)}`
}

export default function CampaignsBoard({ campaigns, loading, onOpen, onDuplicate, onDelete, onPdf }) {
    if (!loading && !campaigns.length) {
        return (
            <div className="nimvo-empty">
                <i className="fa-solid fa-newspaper" />
                <h3>Nenhum tabloide criado ainda</h3>
                <p>Crie um tabloide pra agrupar várias ofertas com a mesma vigência e imprimir o encarte de uma vez.</p>
            </div>
        )
    }

    return (
        <div className="promo-campaign-grid">
            {campaigns.map((campaign) => (
                <article key={campaign.id} className="nimvo-action-card promo-campaign-card" onClick={() => onOpen(campaign)}>
                    <div className="promo-campaign-card-top">
                        <span className="promo-campaign-code">{campaign.code}</span>
                        <StatusBadge tone={campaignStatusTone(campaign.status)} compact>{campaign.status}</StatusBadge>
                    </div>
                    <strong className="promo-campaign-name">{campaign.name}</strong>
                    <span className="promo-campaign-vigencia">{vigencia(campaign)}</span>
                    <div className="promo-campaign-stats">
                        <span><i className="fa-solid fa-tags" /> {campaign.active_promotions_count} de {campaign.promotions_count} oferta(s) ativa(s)</span>
                    </div>
                    <div className="promo-campaign-actions">
                        <button type="button" className="ui-icon-button" title="Baixar PDF" onClick={(event) => { event.stopPropagation(); onPdf(campaign) }}>
                            <i className="fa-solid fa-file-pdf" />
                        </button>
                        <button type="button" className="ui-icon-button" title="Duplicar" onClick={(event) => { event.stopPropagation(); onDuplicate(campaign) }}>
                            <i className="fa-solid fa-copy" />
                        </button>
                        <button type="button" className="ui-icon-button tone-danger" title="Excluir" onClick={(event) => { event.stopPropagation(); onDelete(campaign) }}>
                            <i className="fa-solid fa-trash" />
                        </button>
                    </div>
                </article>
            ))}
        </div>
    )
}

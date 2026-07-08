import { formatNumber } from '@/lib/format'

export default function PromotionsHero({ campaigns, promotions, onNewCampaign, onNewPromotion }) {
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'ativo').length
    const scheduledCampaigns = campaigns.filter((campaign) => campaign.status === 'agendado').length
    const activePromotions = promotions.filter((promotion) => promotion.status === 'ativa').length
    const productsOnOffer = promotions.filter((promotion) => promotion.status === 'ativa' && promotion.scope === 'product').length

    const kpis = [
        { key: 'campaigns', color: 'indigo', icon: 'fa-newspaper', label: 'Tabloides ativos', value: activeCampaigns, note: scheduledCampaigns ? `${scheduledCampaigns} agendado(s)` : 'Nenhum agendado' },
        { key: 'promotions', color: 'green', icon: 'fa-tags', label: 'Promoções ativas', value: activePromotions, note: `${promotions.length} no total` },
        { key: 'products', color: 'amber', icon: 'fa-box-open', label: 'Produtos em oferta agora', value: productsOnOffer, note: 'De/Por, leve+pague- e faixas' },
    ]

    return (
        <>
            <div className="page-hero page-hero--indigo">
                <div className="page-hero-left">
                    <div className="page-hero-icon">
                        <i className="fa-solid fa-tags" />
                    </div>
                    <div>
                        <h1 className="page-hero-title">Promoções</h1>
                        <p className="page-hero-sub">Monte tabloides mensais ou crie ofertas avulsas — o PDV sempre aplica a melhor pro cliente.</p>
                    </div>
                </div>
                <div className="promo-hero-actions">
                    <button type="button" className="ui-button-ghost" onClick={onNewPromotion}>
                        <i className="fa-solid fa-tag" /> Nova promoção avulsa
                    </button>
                    <button type="button" className="page-hero-cta" onClick={onNewCampaign}>
                        <i className="fa-solid fa-plus" /> Novo tabloide
                    </button>
                </div>
            </div>

            <div className="promo-kpi-grid">
                {kpis.map((kpi) => (
                    <article key={kpi.key} className={`promo-kpi promo-kpi--${kpi.color}`}>
                        <div className={`promo-kpi-icon promo-kpi-icon--${kpi.color}`}>
                            <i className={`fa-solid ${kpi.icon}`} />
                        </div>
                        <div>
                            <p className="promo-kpi-label">{kpi.label}</p>
                            <strong className="promo-kpi-value">{formatNumber(kpi.value)}</strong>
                            <small className="promo-kpi-note">{kpi.note}</small>
                        </div>
                    </article>
                ))}
            </div>
        </>
    )
}

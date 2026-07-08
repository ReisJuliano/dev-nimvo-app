import { useEffect, useState } from 'react'
import './promotions.css'
import PageContainer from '@/Components/UI/PageContainer'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { emptyCampaignForm, emptyPromotionForm } from './constants'
import PromotionsHero from './components/PromotionsHero'
import CampaignsBoard from './components/CampaignsBoard'
import CampaignFormModal from './components/CampaignFormModal'
import CampaignDetailModal from './components/CampaignDetailModal'
import StandalonePromotionsTable from './components/StandalonePromotionsTable'
import PromotionFormModal from './components/PromotionFormModal'

export default function PromotionsIndex({ categories = [], products = [] }) {
    const [tab, setTab] = useState('campaigns')
    const [campaigns, setCampaigns] = useState([])
    const [promotions, setPromotions] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const [campaignFormOpen, setCampaignFormOpen] = useState(false)
    const [campaignForm, setCampaignForm] = useState(emptyCampaignForm())
    const [savingCampaign, setSavingCampaign] = useState(false)

    const [activeCampaign, setActiveCampaign] = useState(null)

    const [promotionFormOpen, setPromotionFormOpen] = useState(false)
    const [promotionForm, setPromotionForm] = useState(emptyPromotionForm())
    const [savingPromotion, setSavingPromotion] = useState(false)

    function notify(type, text) {
        setFeedback({ type, text })
    }

    async function refreshCampaigns() {
        try {
            const response = await apiRequest('/api/promotion-campaigns')
            setCampaigns(response.campaigns || [])
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function refreshPromotions() {
        try {
            const response = await apiRequest('/api/promotions')
            setPromotions(response.promotions || [])
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function refreshAll() {
        setLoading(true)
        await Promise.all([refreshCampaigns(), refreshPromotions()])
        setLoading(false)
    }

    useEffect(() => {
        void refreshAll()
    }, [])

    async function openCampaignDetail(campaign) {
        try {
            const response = await apiRequest(`/api/promotion-campaigns/${campaign.id}`)
            setActiveCampaign(response.campaign)
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function refreshActiveCampaign() {
        if (!activeCampaign) return
        await openCampaignDetail(activeCampaign)
        await refreshCampaigns()
        await refreshPromotions()
    }

    function openNewCampaign() {
        setCampaignForm(emptyCampaignForm())
        setCampaignFormOpen(true)
    }

    function openEditCampaign(campaign) {
        setCampaignForm({
            id: campaign.id,
            name: campaign.name,
            description: campaign.description || '',
            cover_note: campaign.cover_note || '',
            starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 10) : '',
            ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 10) : '',
            active: campaign.active,
        })
        setCampaignFormOpen(true)
    }

    async function submitCampaign(event) {
        event.preventDefault()
        setSavingCampaign(true)

        try {
            const payload = {
                name: campaignForm.name,
                description: campaignForm.description || null,
                cover_note: campaignForm.cover_note || null,
                starts_at: campaignForm.starts_at || null,
                ends_at: campaignForm.ends_at || null,
                active: Boolean(campaignForm.active),
            }

            const response = campaignForm.id
                ? await apiRequest(`/api/promotion-campaigns/${campaignForm.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/promotion-campaigns', { method: 'post', data: payload })

            notify('success', response.message)
            setCampaignFormOpen(false)
            await refreshCampaigns()

            if (activeCampaign && campaignForm.id === activeCampaign.id) {
                await refreshActiveCampaign()
            }
        } catch (error) {
            notify('error', error.message)
        } finally {
            setSavingCampaign(false)
        }
    }

    async function duplicateCampaign(campaign) {
        try {
            const response = await apiRequest(`/api/promotion-campaigns/${campaign.id}/duplicate`, { method: 'post' })
            notify('success', response.message)
            await refreshCampaigns()
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function deleteCampaign(campaign) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Excluir tabloide',
            message: `Excluir "${campaign.name}"? As ofertas dele continuam ativas como promoções avulsas.`,
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) return

        try {
            const response = await apiRequest(`/api/promotion-campaigns/${campaign.id}`, { method: 'delete' })
            notify('success', response.message)
            setActiveCampaign(null)
            await refreshAll()
        } catch (error) {
            notify('error', error.message)
        }
    }

    function downloadCampaignPdf(campaign) {
        window.open(`/api/promotion-campaigns/${campaign.id}/pdf`, '_blank', 'noopener,noreferrer')
    }

    function openNewPromotion() {
        setPromotionForm(emptyPromotionForm())
        setPromotionFormOpen(true)
    }

    function openNewPromotionInCampaign(campaign) {
        setPromotionForm({ ...emptyPromotionForm(), campaign_id: String(campaign.id) })
        setPromotionFormOpen(true)
    }

    function openEditPromotion(promotion) {
        setPromotionForm({
            id: promotion.id,
            campaign_id: promotion.campaign_id ? String(promotion.campaign_id) : '',
            name: promotion.name,
            description: promotion.description || '',
            type: promotion.type,
            scope: promotion.scope,
            product_id: promotion.product_id || '',
            category_id: promotion.category_id || '',
            discount_value: promotion.discount_value ?? '',
            tiers: promotion.config?.tiers?.length ? promotion.config.tiers : [{ min_quantity: '', unit_price: '' }],
            buy_quantity: promotion.config?.buy_quantity ?? '',
            pay_quantity: promotion.config?.pay_quantity ?? '',
            highlight_text: promotion.highlight_text || '',
            start_at: promotion.start_at || '',
            end_at: promotion.end_at || '',
            weekdays: promotion.weekdays || [],
            active: promotion.active,
        })
        setPromotionFormOpen(true)
    }

    function buildPromotionPayload() {
        const scope = promotionForm.type === 'category_discount' ? 'category' : 'product'

        const config = promotionForm.type === 'buy_x_pay_y'
            ? { buy_quantity: Number(promotionForm.buy_quantity), pay_quantity: Number(promotionForm.pay_quantity) }
            : promotionForm.type === 'quantity_discount'
                ? { tiers: promotionForm.tiers.filter((tier) => tier.min_quantity !== '' && tier.unit_price !== '').map((tier) => ({ min_quantity: Number(tier.min_quantity), unit_price: Number(tier.unit_price) })) }
                : null

        return {
            campaign_id: promotionForm.campaign_id || null,
            name: promotionForm.name,
            description: promotionForm.description || null,
            type: promotionForm.type,
            scope,
            product_id: scope === 'product' ? Number(promotionForm.product_id) || null : null,
            category_id: scope === 'category' ? Number(promotionForm.category_id) || null : null,
            discount_value: promotionForm.discount_value === '' ? 0 : Number(promotionForm.discount_value),
            config,
            highlight_text: promotionForm.highlight_text || null,
            start_at: promotionForm.start_at || null,
            end_at: promotionForm.end_at || null,
            weekdays: promotionForm.weekdays.length ? promotionForm.weekdays : null,
            active: Boolean(promotionForm.active),
        }
    }

    async function submitPromotion(event) {
        event.preventDefault()
        setSavingPromotion(true)

        try {
            const payload = buildPromotionPayload()
            const response = promotionForm.id
                ? await apiRequest(`/api/promotions/${promotionForm.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/promotions', { method: 'post', data: payload })

            notify('success', response.message)
            setPromotionFormOpen(false)
            await refreshPromotions()
            await refreshCampaigns()

            if (activeCampaign && (payload.campaign_id === String(activeCampaign.id) || (promotionForm.id && activeCampaign.promotions?.some((p) => p.id === promotionForm.id)))) {
                await refreshActiveCampaign()
            }
        } catch (error) {
            notify('error', error.message)
        } finally {
            setSavingPromotion(false)
        }
    }

    async function duplicatePromotion(promotion) {
        try {
            const response = await apiRequest(`/api/promotions/${promotion.id}/duplicate`, { method: 'post' })
            notify('success', response.message)
            await refreshPromotions()
            await refreshCampaigns()
            if (activeCampaign) await refreshActiveCampaign()
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function deletePromotion(promotion) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Excluir promoção',
            message: `Excluir "${promotion.name}"?`,
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) return

        try {
            const response = await apiRequest(`/api/promotions/${promotion.id}`, { method: 'delete' })
            notify('success', response.message)
            await refreshPromotions()
            await refreshCampaigns()
            if (activeCampaign) await refreshActiveCampaign()
        } catch (error) {
            notify('error', error.message)
        }
    }

    const standalonePromotions = promotions.filter((promotion) => !promotion.campaign_id)

    return (
        <AppLayout title="Promoções">
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                <PromotionsHero
                    campaigns={campaigns}
                    promotions={promotions}
                    onNewCampaign={openNewCampaign}
                    onNewPromotion={openNewPromotion}
                />

                <div className="ui-tabs promo-page-tabs">
                    <button type="button" className={`ui-tab ${tab === 'campaigns' ? 'active' : ''}`} onClick={() => setTab('campaigns')}>
                        Tabloides
                    </button>
                    <button type="button" className={`ui-tab ${tab === 'standalone' ? 'active' : ''}`} onClick={() => setTab('standalone')}>
                        Promoções avulsas
                    </button>
                </div>

                {tab === 'campaigns' ? (
                    <CampaignsBoard
                        campaigns={campaigns}
                        loading={loading}
                        onOpen={openCampaignDetail}
                        onDuplicate={duplicateCampaign}
                        onDelete={deleteCampaign}
                        onPdf={downloadCampaignPdf}
                    />
                ) : (
                    <StandalonePromotionsTable
                        promotions={standalonePromotions}
                        loading={loading}
                        onEdit={openEditPromotion}
                        onDuplicate={duplicatePromotion}
                        onDelete={deletePromotion}
                    />
                )}
            </PageContainer>

            <CampaignFormModal
                open={campaignFormOpen}
                form={campaignForm}
                setForm={setCampaignForm}
                saving={savingCampaign}
                onSubmit={submitCampaign}
                onClose={() => setCampaignFormOpen(false)}
            />

            {activeCampaign ? (
                <CampaignDetailModal
                    campaign={activeCampaign}
                    onClose={() => setActiveCampaign(null)}
                    onRefresh={refreshActiveCampaign}
                    onEditCampaign={openEditCampaign}
                    onDuplicateCampaign={duplicateCampaign}
                    onDeleteCampaign={deleteCampaign}
                    onDownloadPdf={downloadCampaignPdf}
                    onNewPromotionInCampaign={openNewPromotionInCampaign}
                    onEditPromotion={openEditPromotion}
                    onDuplicatePromotion={duplicatePromotion}
                    onDeletePromotion={deletePromotion}
                />
            ) : null}

            <PromotionFormModal
                open={promotionFormOpen}
                form={promotionForm}
                setForm={setPromotionForm}
                categories={categories}
                products={products}
                campaigns={campaigns}
                saving={savingPromotion}
                onSubmit={submitPromotion}
                onClose={() => setPromotionFormOpen(false)}
            />
        </AppLayout>
    )
}

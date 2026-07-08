import CompactModal from '@/Components/UI/CompactModal'

export default function CampaignFormModal({ open, form, setForm, saving, onSubmit, onClose }) {
    return (
        <CompactModal
            open={open}
            title={form.id ? 'Editar tabloide' : 'Novo tabloide'}
            icon="fa-newspaper"
            onClose={onClose}
        >
            <form onSubmit={onSubmit} className="promo-form">
                <label>
                    <span>Nome</span>
                    <input className="ui-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Tabloide de Julho" required />
                </label>

                <label>
                    <span>Descrição (opcional)</span>
                    <textarea className="ui-input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                </label>

                <label>
                    <span>Texto de destaque pro PDF (opcional)</span>
                    <input className="ui-input" value={form.cover_note} onChange={(event) => setForm((current) => ({ ...current, cover_note: event.target.value }))} placeholder="Ex: Ofertas válidas enquanto durarem os estoques" />
                </label>

                <div className="promo-tier-row">
                    <label>
                        <span>Início da vigência</span>
                        <input className="ui-input" type="date" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} />
                    </label>
                    <label>
                        <span>Fim da vigência</span>
                        <input className="ui-input" type="date" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} />
                    </label>
                    <span />
                </div>

                <label className="promo-inline-checkbox">
                    <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                    <span>Ativo</span>
                </label>

                <div className="promo-form-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </form>
        </CompactModal>
    )
}

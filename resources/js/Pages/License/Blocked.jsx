import { router } from '@inertiajs/react'
import './blocked.css'

export default function LicenseBlocked({ license }) {
    function handleLogout() {
        router.post('/logout')
    }

    return (
        <div className="license-blocked-page">
            <div className="license-blocked-backdrop" />
            <section className="license-blocked-card">
                <div className="license-blocked-icon">
                    <i className="fa-solid fa-lock" />
                </div>

                <div className="license-blocked-copy">
                    <span className="license-blocked-kicker">Licenca expirada</span>
                    <h1>Sistema temporariamente bloqueado</h1>
                    <p>{license?.message || 'A licenca deste tenant venceu e precisa ser regularizada para liberar o uso novamente.'}</p>
                </div>

                <div className="license-blocked-grid">
                    <article>
                        <span>Vencimento</span>
                        <strong>{license?.due_date || 'Nao informado'}</strong>
                    </article>
                    <article>
                        <span>Tolerancia ate</span>
                        <strong>{license?.grace_ends_at || 'Nao informado'}</strong>
                    </article>
                    <article>
                        <span>Status</span>
                        <strong>{license?.status || 'blocked'}</strong>
                    </article>
                </div>

                <div className="license-blocked-actions">
                    <button type="button" className="license-blocked-button secondary" onClick={() => window.location.reload()}>
                        <i className="fa-solid fa-rotate-right" />
                        Atualizar status
                    </button>
                    <button type="button" className="license-blocked-button" onClick={handleLogout}>
                        <i className="fa-solid fa-right-from-bracket" />
                        Sair
                    </button>
                </div>
            </section>
        </div>
    )
}

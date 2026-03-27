import { Head } from '@inertiajs/react'
import GuestBrandPanel from '@/Components/Auth/GuestBrandPanel'
import './guest-layout.css'

export default function GuestLayout({ title, heading, description, children }) {
    return (
        <>
            <Head title={title} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
            />
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
            />

            <div className="guest-root">
                <div className="guest-page">
                    <div className="guest-shell">
                        <GuestBrandPanel />

                        <section className="guest-card">
                            <div className="guest-card-header">
                                <div className="guest-card-logo">
                                    <div className="guest-card-logo-badge">
                                        <i className="fas fa-store" />
                                    </div>
                                    <div>
                                        <strong>Nimvo</strong>
                                        <span>Sistema Inteligente</span>
                                    </div>
                                </div>

                                <h2>{heading}</h2>
                                <p>{description}</p>
                            </div>

                            {children}
                        </section>
                    </div>
                </div>
            </div>
        </>
    )
}

import { usePage } from '@inertiajs/react'
import DashboardFlashMessage from '@/Components/Dashboard/DashboardFlashMessage'
import DashboardHero from '@/Components/Dashboard/DashboardHero'
import DashboardSummaryCard from '@/Components/Dashboard/DashboardSummaryCard'
import AppLayout from '@/Layouts/AppLayout'

const summaryCards = [
    {
        label: 'Status',
        value: 'Online',
        helpText: 'Fluxo de autenticacao e dashboard configurados para navegar corretamente.',
    },
    {
        label: 'Arquitetura',
        value: 'Modular',
        helpText: 'Layout, autenticacao e blocos do painel foram divididos em componentes menores.',
    },
    {
        label: 'Proximo passo',
        value: 'Escalar',
        helpText: 'A base agora esta preparada para expandir cadastros, relatorios e modulos do PDV.',
    },
]

export default function Dashboard() {
    const { auth, flash } = usePage().props

    return (
        <AppLayout title="Dashboard">
            <div className="dashboard-grid">
                <DashboardFlashMessage message={flash?.success} />
                <DashboardHero userName={auth?.user?.name || 'Usuario'} />

                <section className="dashboard-summary">
                    {summaryCards.map((card) => (
                        <DashboardSummaryCard
                            key={card.label}
                            label={card.label}
                            value={card.value}
                            helpText={card.helpText}
                        />
                    ))}
                </section>
            </div>
        </AppLayout>
    )
}

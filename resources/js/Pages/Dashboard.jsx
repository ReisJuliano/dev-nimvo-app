import AppLayout from '@/Layouts/AppLayout'

export default function Dashboard({ auth }) {
    return (
        <AppLayout title="Início">
            <div style={{ padding: '8px 0' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
                    Bem-vindo, {auth?.user?.name}! 👋
                </h2>
                <p style={{ color: '#64748b' }}>Seu sistema está funcionando perfeitamente.</p>
            </div>
        </AppLayout>
    )
}

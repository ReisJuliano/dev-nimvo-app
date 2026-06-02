import { Head, Link } from '@inertiajs/react'

export default function Error({ status }) {
    const messages = {
        403: {
            title: 'Acesso negado',
            description: 'Você não tem permissão para acessar este recurso.',
        },
        404: {
            title: 'Página não encontrada',
            description: 'O endereço que você acessou não existe ou foi removido.',
        },
        500: {
            title: 'Erro interno',
            description: 'Algo saiu do esperado no servidor. Tente novamente em instantes.',
        },
    }

    const { title, description } = messages[status] ?? messages[500]

    return (
        <main className="error-page-shell">
            <Head title={`${status} - ${title}`} />
            <img
                className="error-page-watermark"
                src="/assets/img/logo.png"
                alt=""
                aria-hidden="true"
            />
            <div className="error-page-container">
                <div className="error-page-code">{status}</div>
                <h1 className="error-page-title">{title}</h1>
                <p className="error-page-description">{description}</p>
                <Link href="/dashboard" className="ui-button">
                    Voltar ao início
                </Link>
            </div>
        </main>
    )
}

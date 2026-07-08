import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { formatMoney, formatNumber } from '@/lib/format'
import { movementTypeLabel, statusLabel } from '../constants'

const DONUT_COLORS = ['#10b981', '#ef4444']

function AccuracyDonut({ accuracy }) {
    if (accuracy === null || accuracy === undefined) {
        return (
            <div className="ivs-donut-shell ivs-donut-shell--empty">
                <i className="fa-solid fa-lock" />
                <span>Cego até revisão</span>
            </div>
        )
    }

    const data = [
        { name: 'Acertos', value: accuracy },
        { name: 'Divergência', value: Math.max(0, 100 - accuracy) },
    ]

    return (
        <div className="ivs-donut-shell">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={52} paddingAngle={2} strokeWidth={0}>
                        {data.map((entry, index) => (
                            <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="ivs-donut-overlay">
                <strong>{formatNumber(accuracy, { maximumFractionDigits: 1 })}%</strong>
                <span>acurácia</span>
            </div>
        </div>
    )
}

export default function SessionHero({ session, movementBreakdown = {}, actions }) {
    const blind = session.blind_count && session.status === 'counting'
    const summary = session.divergence_summary
    const progress = session.progress_summary

    const kpis = [
        {
            key: 'progress',
            color: 'indigo',
            icon: 'fa-list-check',
            label: 'Itens contados',
            value: `${formatNumber(progress?.counted_items ?? 0)}/${formatNumber(progress?.total_items ?? 0)}`,
            note: `${formatNumber(progress?.progress_percent ?? 0, { maximumFractionDigits: 0 })}% da sessão`,
        },
    ]

    if (!blind && summary) {
        kpis.push(
            {
                key: 'divergent',
                color: summary.divergent_items > 0 ? 'amber' : 'green',
                icon: 'fa-triangle-exclamation',
                label: 'Itens divergentes',
                value: formatNumber(summary.divergent_items),
                note: `de ${formatNumber(summary.counted_items)} contados`,
            },
            {
                key: 'net',
                color: summary.net_value >= 0 ? 'green' : 'rose',
                icon: 'fa-scale-balanced',
                label: 'Divergência líquida',
                value: formatMoney(summary.net_value),
                note: `sobra ${formatMoney(summary.surplus_value)} · falta ${formatMoney(summary.shortage_value)}`,
            },
        )
    }

    const movementEntries = Object.entries(movementBreakdown).filter(([, value]) => Math.abs(value) > 0.0009)

    return (
        <>
            <div className="page-hero page-hero--indigo">
                <div className="page-hero-left">
                    <div className="page-hero-icon">
                        <i className="fa-solid fa-clipboard-list" />
                    </div>
                    <div>
                        <h1 className="page-hero-title">{session.code}</h1>
                        <p className="page-hero-sub">
                            {session.type === 'general' ? 'Geral' : 'Parcial'} · {session.mode === 'frozen' ? 'Congelado' : 'Snapshot (loja aberta)'}
                            {session.blind_count ? ' · Contagem cega' : ''} · {statusLabel(session.status)}
                        </p>
                    </div>
                </div>
                {actions ? <div className="ivs-hero-actions">{actions}</div> : null}
            </div>

            <div className="ivs-kpi-grid">
                <article className="ivs-kpi ivs-kpi--donut">
                    <AccuracyDonut accuracy={blind ? null : summary?.accuracy_percent ?? null} />
                    <div className="ivs-kpi-donut-copy">
                        <p className="ivs-kpi-label">Acuracidade</p>
                        <small className="ivs-kpi-note">
                            {blind ? 'Números liberados após encerrar a contagem' : `${formatNumber(progress?.total_items ?? 0)} itens na sessão`}
                        </small>
                    </div>
                </article>

                {kpis.map((kpi) => (
                    <article key={kpi.key} className={`ivs-kpi ivs-kpi--${kpi.color}`}>
                        <div className="ivs-kpi-top">
                            <div className={`ivs-kpi-icon ivs-kpi-icon--${kpi.color}`}>
                                <i className={`fa-solid ${kpi.icon}`} />
                            </div>
                        </div>
                        <p className="ivs-kpi-label">{kpi.label}</p>
                        <strong className="ivs-kpi-value">{kpi.value}</strong>
                        <small className="ivs-kpi-note">{kpi.note}</small>
                    </article>
                ))}

                {!blind && movementEntries.length > 0 ? (
                    <article className="ivs-kpi ivs-kpi--movements">
                        <p className="ivs-kpi-label">Movimentação durante a contagem</p>
                        <div className="ivs-movement-list">
                            {movementEntries.map(([type, value]) => (
                                <div key={type} className="ivs-movement-row">
                                    <span>{movementTypeLabel(type)}</span>
                                    <b className={value >= 0 ? 'ivs-text-positive' : 'ivs-text-negative'}>
                                        {value > 0 ? '+' : ''}{formatNumber(value, { maximumFractionDigits: 3 })}
                                    </b>
                                </div>
                            ))}
                        </div>
                        <small className="ivs-kpi-note">A loja continuou vendendo e recebendo mercadoria normalmente</small>
                    </article>
                ) : null}
            </div>

            <div className="ivs-progress-track">
                <span className="ivs-progress-fill" style={{ width: `${Math.min(100, progress?.progress_percent ?? 0)}%` }} />
            </div>
        </>
    )
}

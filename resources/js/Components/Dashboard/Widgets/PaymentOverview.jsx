import DashboardChartTooltip from '@/Components/Dashboard/DashboardChartTooltip'
import { formatMoney, formatNumber } from '@/lib/format'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const paymentColors = ['#2563eb', '#7c3aed', '#14b8a6', '#f59e0b', '#ec4899', '#64748b']

export default function PaymentOverview({ paymentBreakdown = [], total = 0 }) {
    const hasData = paymentBreakdown.length > 0

    return (
        <section className="dashboard-surface dashboard-surface-side">
            <header className="dashboard-surface-header">
                <div className="dashboard-surface-title">
                    <strong>Pagamentos</strong>
                    <span>Mes</span>
                </div>
                <span className="dashboard-surface-pill">{formatNumber(paymentBreakdown.length)}</span>
            </header>

            <div className="dashboard-donut-shell">
                {hasData ? (
                    <>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    cursor={false}
                                    content={(props) => (
                                        <DashboardChartTooltip
                                            {...props}
                                            valueTypes={{ total: 'money' }}
                                            resolveLabel={(payload) => payload?.[0]?.name ?? ''}
                                        />
                                    )}
                                />
                                <Pie
                                    data={paymentBreakdown}
                                    dataKey="total"
                                    nameKey="label"
                                    innerRadius={64}
                                    outerRadius={88}
                                    paddingAngle={3}
                                    strokeWidth={0}
                                >
                                    {paymentBreakdown.map((entry, index) => (
                                        <Cell
                                            key={`${entry.method}-${entry.label}`}
                                            fill={paymentColors[index % paymentColors.length]}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="dashboard-donut-overlay">
                            <span>Total</span>
                            <strong>{formatMoney(total)}</strong>
                        </div>
                    </>
                ) : (
                    <div className="dashboard-empty-state">
                        <i className="fa-solid fa-wallet" />
                        <span>Sem giro</span>
                    </div>
                )}
            </div>

            <div className="dashboard-payment-list">
                {hasData ? (
                    paymentBreakdown.map((payment, index) => (
                        <div key={payment.method} className="dashboard-payment-row">
                            <div className="dashboard-payment-copy">
                                <span className={`dashboard-color-dot dashboard-color-${index % paymentColors.length}`} />
                                <div>
                                    <strong>{payment.label}</strong>
                                    <small>{formatNumber(payment.qty)} mov.</small>
                                </div>
                            </div>
                            <b>{formatMoney(payment.total)}</b>
                        </div>
                    ))
                ) : null}
            </div>
        </section>
    )
}

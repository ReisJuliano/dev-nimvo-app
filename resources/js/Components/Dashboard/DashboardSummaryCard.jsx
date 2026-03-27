export default function DashboardSummaryCard({ label, value, helpText }) {
    return (
        <article className="dashboard-summary-card">
            <div className="dashboard-summary-label">{label}</div>
            <div className="dashboard-summary-value">{value}</div>
            <div className="dashboard-summary-help">{helpText}</div>
        </article>
    )
}

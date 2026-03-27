export default function DashboardFlashMessage({ message }) {
    if (!message) {
        return null
    }

    return (
        <div className="dashboard-flash">
            <i className="fas fa-circle-check" />
            <span>{message}</span>
        </div>
    )
}

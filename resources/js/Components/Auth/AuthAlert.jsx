export default function AuthAlert({ message }) {
    if (!message) {
        return null
    }

    return (
        <div className="guest-alert">
            <i className="fas fa-circle-xmark" />
            <span>{message}</span>
        </div>
    )
}

export default function AuthTextField({
    id,
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    autoComplete,
    autoFocus = false,
    icon,
    error,
}) {
    return (
        <div className="guest-form-group">
            <label className="guest-form-label" htmlFor={id}>
                {label}
            </label>

            <div className="guest-input-wrap">
                <i className={`fas ${icon} guest-input-icon`} />
                <input
                    id={id}
                    type={type}
                    className="guest-form-control"
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    required
                />
            </div>

            {error && <div className="guest-field-error">{error}</div>}
        </div>
    )
}

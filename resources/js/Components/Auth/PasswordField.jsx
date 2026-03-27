export default function PasswordField({
    id,
    label,
    value,
    onChange,
    placeholder,
    autoComplete,
    showPassword,
    onToggleVisibility,
    error,
}) {
    return (
        <div className="guest-form-group">
            <label className="guest-form-label" htmlFor={id}>
                {label}
            </label>

            <div className="guest-input-wrap">
                <i className="fas fa-lock guest-input-icon" />
                <input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    className="guest-form-control with-action"
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    required
                />
                <button
                    type="button"
                    className="guest-input-action"
                    onClick={onToggleVisibility}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
            </div>

            {error && <div className="guest-field-error">{error}</div>}
        </div>
    )
}

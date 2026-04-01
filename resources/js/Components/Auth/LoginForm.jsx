import AuthAlert from '@/Components/Auth/AuthAlert'
import AuthTextField from '@/Components/Auth/AuthTextField'
import PasswordField from '@/Components/Auth/PasswordField'
import { useErrorMapPopup } from '@/lib/errorPopup'

export default function LoginForm({
    data,
    errors,
    processing,
    showPassword,
    onSubmit,
    onFieldChange,
    onTogglePassword,
}) {
    useErrorMapPopup(errors)

    return (
        <>
            <AuthAlert message={errors.username} />

            <form className="guest-form" onSubmit={onSubmit}>
                <AuthTextField
                    id="username"
                    label="Usuario"
                    value={data.username}
                    onChange={(value) => onFieldChange('username', value)}
                    placeholder="admin"
                    autoComplete="username"
                    autoFocus
                    icon="fa-user"
                />

                <PasswordField
                    id="password"
                    label="Senha"
                    value={data.password}
                    onChange={(value) => onFieldChange('password', value)}
                    placeholder="********"
                    autoComplete="current-password"
                    showPassword={showPassword}
                    onToggleVisibility={onTogglePassword}
                    error={errors.password}
                />

                <div className="guest-form-footer">
                    <label className="guest-remember" htmlFor="remember">
                        <input
                            id="remember"
                            type="checkbox"
                            checked={data.remember}
                            onChange={(event) => onFieldChange('remember', event.target.checked)}
                        />
                        Permanecer conectado
                    </label>

                    <span className="guest-inline-note">Login administrativo</span>
                </div>

                <button type="submit" className="guest-submit" disabled={processing}>
                    {processing ? (
                        <>
                            <i className="fas fa-spinner fa-spin" />
                            Entrando...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-right-to-bracket" />
                            Entrar
                        </>
                    )}
                </button>
            </form>

            <div className="guest-card-note">
                Use seu usuario e senha cadastrados para acessar o sistema.
            </div>
        </>
    )
}

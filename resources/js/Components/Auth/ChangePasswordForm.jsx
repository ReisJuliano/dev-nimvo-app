import PasswordField from '@/Components/Auth/PasswordField'
import { useErrorMapPopup } from '@/lib/errorPopup'

export default function ChangePasswordForm({
    data,
    errors,
    processing,
    showPassword,
    showConfirmation,
    onSubmit,
    onFieldChange,
    onTogglePassword,
    onToggleConfirmation,
}) {
    useErrorMapPopup(errors)

    return (
        <>
            <form className="guest-form" onSubmit={onSubmit}>
                <PasswordField
                    id="password"
                    label="Nova senha"
                    value={data.password}
                    onChange={(value) => onFieldChange('password', value)}
                    placeholder="********"
                    autoComplete="new-password"
                    showPassword={showPassword}
                    onToggleVisibility={onTogglePassword}
                />

                <PasswordField
                    id="password_confirmation"
                    label="Confirmar senha"
                    value={data.password_confirmation}
                    onChange={(value) => onFieldChange('password_confirmation', value)}
                    placeholder="********"
                    autoComplete="new-password"
                    showPassword={showConfirmation}
                    onToggleVisibility={onToggleConfirmation}
                    error={errors.password_confirmation}
                />

                <button type="submit" className="guest-submit" disabled={processing}>
                    {processing ? (
                        <>
                            <i className="fas fa-spinner fa-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-key" />
                            Atualizar senha
                        </>
                    )}
                </button>
            </form>

            <div className="guest-card-note">
                Seu usuario precisa trocar a senha antes de acessar o dashboard, como no sistema antigo.
            </div>
        </>
    )
}

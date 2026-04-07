import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import ChangePasswordForm from '@/Components/Auth/ChangePasswordForm'
import GuestLayout from '@/Layouts/GuestLayout'

const initialFormData = {
    password: '',
    password_confirmation: '',
}

export default function ChangePassword() {
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmation, setShowConfirmation] = useState(false)
    const { data, setData, put, processing, errors } = useForm(initialFormData)

    function handleSubmit(event) {
        event.preventDefault()
        put('/change-password')
    }

    function handleFieldChange(field, value) {
        setData(field, value)
    }

    return (
        <GuestLayout
            title="Atualizar Senha - Nimvo"
            heading="Trocar senha"
            centered
        >
            <ChangePasswordForm
                data={data}
                errors={errors}
                processing={processing}
                showPassword={showPassword}
                showConfirmation={showConfirmation}
                onSubmit={handleSubmit}
                onFieldChange={handleFieldChange}
                onTogglePassword={() => setShowPassword((current) => !current)}
                onToggleConfirmation={() => setShowConfirmation((current) => !current)}
            />
        </GuestLayout>
    )
}

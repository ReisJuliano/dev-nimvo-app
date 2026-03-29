import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import LoginForm from '@/Components/Auth/LoginForm'
import GuestLayout from '@/Layouts/GuestLayout'

const initialFormData = {
    username: '',
    password: '',
    remember: false,
}

export default function Login() {
    const [showPassword, setShowPassword] = useState(false)
    const { data, setData, post, processing, errors } = useForm(initialFormData)

    function handleSubmit(event) {
        event.preventDefault()
        post('/login')
    }

    function handleFieldChange(field, value) {
        setData(field, value)
    }

    function togglePasswordVisibility() {
        setShowPassword((current) => !current)
    }

    return (
        <GuestLayout
            title="Login - Nimvo"
            heading="Entrar no sistema"
            description="Informe suas credenciais para continuar no ambiente de gestao."
            centered
        >
            <LoginForm
                data={data}
                errors={errors}
                processing={processing}
                showPassword={showPassword}
                onSubmit={handleSubmit}
                onFieldChange={handleFieldChange}
                onTogglePassword={togglePasswordVisibility}
            />
        </GuestLayout>
    )
}

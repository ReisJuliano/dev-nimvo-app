import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import LoginForm from '@/Components/Auth/LoginForm'
import GuestLayout from '@/Layouts/GuestLayout'

const initialFormData = {
    username: '',
    password: '',
    remember: false,
}

export default function AdminLogin() {
    const [showPassword, setShowPassword] = useState(false)
    const { data, setData, post, processing, errors } = useForm(initialFormData)

    function handleSubmit(event) {
        event.preventDefault()
        post('/admin/login')
    }

    function handleFieldChange(field, value) {
        setData(field, value)
    }

    function togglePasswordVisibility() {
        setShowPassword((current) => !current)
    }

    return (
        <GuestLayout
            title="Admin Central - Nimvo"
            heading="Admin central"
            description="Seu acesso para criar tenants e ligar ou desligar os modulos de cada um."
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

import { useState } from 'react'
import { useForm, Head } from '@inertiajs/react'

export default function Login() {
    const [showPass, setShowPass] = useState(false)
    const { data, setData, post, processing, errors } = useForm({
        username: '',
        password: '',
    })

    function submit(e) {
        e.preventDefault()
        post('/login')
    }

    return (
        <>
            <Head title="Login — Nimvo" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .login-box { width: 100%; max-width: 420px; }
                .login-logo { text-align: center; margin-bottom: 32px; }
                .login-logo-icon img { width: 70px; height: 70px; object-fit: contain; }
                .login-title { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
                .login-sub { font-size: 14px; color: rgba(255,255,255,0.45); margin-top: 6px; }
                .login-card {
                    background: #ffffff;
                    border-radius: 20px;
                    padding: 36px;
                    box-shadow: 0 32px 64px rgba(0,0,0,0.4);
                }
                .card-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
                .card-sub { font-size: 13px; color: #94a3b8; margin-bottom: 28px; }
                .alert-danger {
                    background: #fef2f2; border: 1px solid #fecaca;
                    border-radius: 8px; padding: 11px 14px;
                    font-size: 13px; color: #dc2626;
                    margin-bottom: 20px;
                    display: flex; align-items: center; gap: 8px;
                }
                .form-group { margin-bottom: 18px; }
                .form-label {
                    display: block; font-size: 12px; font-weight: 700;
                    color: #475569; margin-bottom: 7px;
                    text-transform: uppercase; letter-spacing: 0.5px;
                }
                .input-wrap { position: relative; }
                .input-icon {
                    position: absolute; left: 13px; top: 50%;
                    transform: translateY(-50%);
                    color: #fff; font-size: 13px; pointer-events: none;
                }
                .form-control {
                    width: 100%; padding: 11px 12px 11px 38px;
                    border: 1.5px solid #e2e8f0; border-radius: 8px;
                    font-size: 14px; font-family: inherit;
                    color: #fff; background: #cfcfcf;
                    transition: all .2s; outline: none;
                }
                .form-control:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,0.1); }
                .form-control::placeholder { color: #fff; }
                .form-control.pr { padding-right: 44px; }
                .eye-btn {
                    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; color: #94a3b8;
                    cursor: pointer; font-size: 14px; padding: 4px;
                    transition: color .2s;
                }
                .eye-btn:hover { color: #475569; }
                .btn-submit {
                    width: 100%; padding: 14px;
                    background: #1a56db; color: #fff;
                    border: none; border-radius: 10px;
                    font-size: 15px; font-weight: 700;
                    font-family: inherit; cursor: pointer;
                    margin-top: 8px; transition: all .2s;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
                .btn-submit:hover { background: #1e429f; box-shadow: 0 4px 16px rgba(26,86,219,0.4); }
                .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>

            <div className="login-box">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <img
                            src="https://nimvo.com.br/pdv/assets/img/logo.png"
                            alt="Nimvo"
                            onError={e => {
                                e.target.style.display = 'none'
                                e.target.parentElement.innerHTML = '<i class="fas fa-store" style="color:white;font-size:28px"></i>'
                            }}
                        />
                    </div>
                    <div className="login-title">Nimvo</div>
                    <div className="login-sub">Sistema Inteligente</div>
                </div>

                <div className="login-card">
                    <h2 className="card-title">Entrar no sistema</h2>
                    <p className="card-sub">Informe suas credenciais de acesso</p>

                    {errors.username && (
                        <div className="alert-danger">
                            <i className="fas fa-circle-xmark"></i>
                            {errors.username}
                        </div>
                    )}

                    <form onSubmit={submit}>
                        <div className="form-group">
                            <label className="form-label">Usuário</label>
                            <div className="input-wrap">
                                <i className="fas fa-user input-icon"></i>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="admin"
                                    value={data.username}
                                    onChange={e => setData('username', e.target.value)}
                                    required autoFocus
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Senha</label>
                            <div className="input-wrap">
                                <i className="fas fa-lock input-icon"></i>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className="form-control pr"
                                    placeholder="••••••••"
                                    value={data.password}
                                    onChange={e => setData('password', e.target.value)}
                                    required
                                />
                                <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                                    <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn-submit" disabled={processing}>
                            {processing
                                ? <><i className="fas fa-spinner fa-spin"></i> Entrando...</>
                                : <><i className="fas fa-right-to-bracket"></i> Entrar</>
                            }
                        </button>
                    </form>
                </div>
            </div>
        </>
    )
}

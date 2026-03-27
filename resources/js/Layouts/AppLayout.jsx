import { useState, useEffect } from 'react'
import { Link, usePage, router } from '@inertiajs/react'

const navItems = [
    {
        section: 'Gerencial',
        items: [
            { href: '/', label: 'Início', icon: 'fa-chart-pie' },
        ]
    },
    {
        section: 'Vendas / Pedidos',
        items: [
            { href: '/pdv', label: 'Caixa', icon: 'fa-cash-register' },
            { href: '/pedidos', label: 'Pedidos / Comandas', icon: 'fa-clipboard-list' },
            { href: '/caixa', label: 'Abertura / Fechamento', icon: 'fa-cash-register' },
        ]
    },
    {
        section: 'Fiado',
        items: [
            { href: '/fiado', label: 'Fiado / A Receber', icon: 'fa-handshake' },
        ]
    },
    {
        section: 'Cadastros',
        items: [
            { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked' },
            { href: '/fornecedores', label: 'Fornecedores', icon: 'fa-building' },
            { href: '/categorias', label: 'Categorias', icon: 'fa-tags' },
            { href: '/clientes', label: 'Clientes', icon: 'fa-users' },
        ]
    },
    {
        section: 'Estoque',
        items: [
            { href: '/estoque/entrada', label: 'Entrada de Estoque', icon: 'fa-arrow-down' },
            { href: '/estoque/ajuste', label: 'Ajuste de Estoque', icon: 'fa-sliders' },
            { href: '/estoque/historico', label: 'Histórico Estoque', icon: 'fa-timeline' },
        ]
    },
    {
        section: 'Relatórios',
        items: [
            { href: '/relatorios', label: 'Relatórios', icon: 'fa-chart-bar' },
            { href: '/faltas', label: 'Faltas & Giro', icon: 'fa-cart-plus' },
            { href: '/vendas', label: 'Vendas Gerais', icon: 'fa-receipt' },
            { href: '/demanda', label: 'Vendas por Produto', icon: 'fa-chart-line' },
        ]
    },
]

const adminItems = {
    section: 'Admin',
    items: [
        { href: '/usuarios', label: 'Usuários', icon: 'fa-user-gear' },
    ]
}

export default function AppLayout({ children, title = 'Início' }) {
    const { auth } = usePage().props
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const [currentTime, setCurrentTime] = useState('')
    const [currentDate, setCurrentDate] = useState('')
    const url = usePage().url

    useEffect(() => {
        const tick = () => {
            const now = new Date()
            setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
            setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }))
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [])

    function handleLogout() {
        router.post('/logout')
    }

    function isActive(href) {
        if (href === '/') return url === '/'
        return url.startsWith(href)
    }

    const allNav = [...navItems]
    if (auth?.user?.role === 'admin') allNav.push(adminItems)

    const userInitials = auth?.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

    return (
        <>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

            <style>{`
                *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
                :root {
                    --primary:#1a56db; --primary-light:#eff6ff; --primary-dark:#1e429f;
                    --success:#059669; --warning:#d97706; --danger:#dc2626;
                    --bg:#f8fafc; --card:#fff; --border:#e2e8f0; --border-light:#f1f5f9;
                    --text-primary:#0f172a; --text-secondary:#475569; --text-muted:#94a3b8;
                    --sidebar-bg:#0f172a; --sidebar-width:260px; --topbar-height:64px;
                    --radius:12px; --shadow-sm:0 1px 3px rgba(0,0,0,.06);
                    --transition:all .2s cubic-bezier(.4,0,.2,1);
                }
                html, body { font-family:'Plus Jakarta Sans',sans-serif; background:var(--bg); color:var(--text-primary); }
                .layout { display:flex; min-height:100vh; }

                /* SIDEBAR */
                .sidebar {
                    width:var(--sidebar-width); background:var(--sidebar-bg);
                    height:100vh; position:fixed; left:0; top:0; z-index:1000;
                    display:flex; flex-direction:column;
                    transition:var(--transition); overflow-y:auto;
                    scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.1) transparent;
                }
                .sidebar.collapsed { width:68px; }
                .sidebar::-webkit-scrollbar { width:4px; }
                .sidebar::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:4px; }

                .sidebar-header {
                    display:flex; align-items:center; justify-content:space-between;
                    padding:20px 16px 16px; border-bottom:1px solid rgba(255,255,255,.07);
                    flex-shrink:0;
                }
                .logo { display:flex; align-items:center; gap:10px; overflow:hidden; }
                .logo-icon {
                    width:38px; height:38px; background:var(--primary); border-radius:10px;
                    display:flex; align-items:center; justify-content:center; flex-shrink:0;
                }
                .logo-icon img { width:28px; height:28px; object-fit:contain; }
                .logo-text { overflow:hidden; transition:var(--transition); }
                .collapsed .logo-text { opacity:0; width:0; }
                .logo-name { display:block; font-weight:700; font-size:15px; color:#fff; white-space:nowrap; }
                .logo-sub { display:block; font-size:10px; color:rgba(255,255,255,.4); text-transform:uppercase; letter-spacing:1px; white-space:nowrap; }

                .sidebar-toggle {
                    background:none; border:none; color:rgba(255,255,255,.4); cursor:pointer;
                    padding:6px; border-radius:6px; transition:var(--transition); font-size:14px; flex-shrink:0;
                }
                .sidebar-toggle:hover { color:#fff; background:rgba(255,255,255,.08); }

                .sidebar-user {
                    display:flex; align-items:center; gap:10px; padding:14px 16px;
                    border-bottom:1px solid rgba(255,255,255,.07); flex-shrink:0; overflow:hidden;
                }
                .user-avatar {
                    width:36px; height:36px; background:var(--primary); border-radius:9px;
                    display:flex; align-items:center; justify-content:center;
                    color:#fff; font-weight:700; font-size:12px; flex-shrink:0;
                }
                .user-info { overflow:hidden; transition:var(--transition); }
                .collapsed .user-info { opacity:0; width:0; }
                .user-name { display:block; color:#fff; font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .user-role { display:block; color:rgba(255,255,255,.4); font-size:11px; }

                .sidebar-nav { flex:1; padding:10px 8px; }
                .nav-section-label {
                    font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;
                    color:rgba(255,255,255,.25); padding:12px 8px 6px;
                    white-space:nowrap; overflow:hidden;
                    transition:var(--transition);
                }
                .collapsed .nav-section-label { opacity:0; height:0; padding:0; }

                .nav-item {
                    display:flex; align-items:center; gap:10px; padding:9px 10px;
                    border-radius:8px; color:rgba(255,255,255,.6); text-decoration:none;
                    font-size:13px; font-weight:500; margin-bottom:1px; transition:var(--transition);
                    white-space:nowrap; overflow:hidden;
                }
                .nav-item:hover { background:rgba(255,255,255,.07); color:#fff; }
                .nav-item.active { background:var(--primary); color:#fff; }
                .nav-item i { width:18px; text-align:center; font-size:14px; flex-shrink:0; }
                .nav-item span { transition:var(--transition); }
                .collapsed .nav-item span { opacity:0; width:0; }
                .collapsed .nav-item { justify-content:center; }

                .sidebar-footer { padding:10px 8px; border-top:1px solid rgba(255,255,255,.07); flex-shrink:0; }
                .logout-btn {
                    display:flex; align-items:center; gap:10px; padding:9px 10px;
                    border-radius:8px; color:rgba(255,255,255,.5); background:none; border:none;
                    font-size:13px; font-weight:500; cursor:pointer; transition:var(--transition);
                    width:100%; font-family:inherit; white-space:nowrap; overflow:hidden;
                }
                .logout-btn:hover { background:rgba(220,38,38,.15); color:#f87171; }
                .logout-btn i { width:18px; text-align:center; font-size:14px; flex-shrink:0; }
                .collapsed .logout-btn { justify-content:center; }
                .collapsed .logout-btn span { opacity:0; width:0; }

                /* MAIN */
                .main-wrapper {
                    margin-left:var(--sidebar-width); flex:1; min-height:100vh;
                    display:flex; flex-direction:column; transition:var(--transition);
                }
                .main-wrapper.collapsed { margin-left:68px; }

                /* TOPBAR */
                .topbar {
                    height:var(--topbar-height); background:#fff; border-bottom:1px solid var(--border);
                    display:flex; align-items:center; justify-content:space-between;
                    padding:0 24px; position:sticky; top:0; z-index:100; box-shadow:var(--shadow-sm);
                }
                .topbar-left { display:flex; align-items:center; gap:16px; }
                .topbar-right { display:flex; align-items:center; gap:20px; }
                .topbar-toggle {
                    display:none; background:none; border:none; color:var(--text-secondary);
                    cursor:pointer; padding:8px; border-radius:8px; font-size:16px;
                }
                .page-title { font-size:16px; font-weight:700; color:var(--text-primary); }
                .topbar-info { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-secondary); font-weight:500; }
                .topbar-info i { color:var(--primary); font-size:12px; }

                .page-content { flex:1; padding:24px; }

                /* MOBILE */
                .sidebar-overlay {
                    display:none; position:fixed; inset:0; background:rgba(0,0,0,.5);
                    z-index:999; backdrop-filter:blur(2px);
                }
                @media(max-width:768px) {
                    .sidebar { transform:translateX(-100%); width:260px !important; }
                    .sidebar.mobile-open { transform:translateX(0); }
                    .main-wrapper { margin-left:0 !important; }
                    .topbar-toggle { display:flex !important; }
                    .sidebar-overlay.open { display:block; }
                    .page-content { padding:16px; }
                    .collapsed .logo-text, .collapsed .user-info,
                    .collapsed .nav-item span, .collapsed .logout-btn span,
                    .collapsed .nav-section-label { opacity:1 !important; width:auto !important; height:auto !important; padding:12px 8px 6px !important; }
                }
            `}</style>

            <div className="layout">
                {/* Overlay mobile */}
                <div
                    className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                />

                {/* SIDEBAR */}
                <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${sidebarOpen ? 'mobile-open' : ''}`}>
                    <div className="sidebar-header">
                        <div className="logo">
                            <div className="logo-icon">
                                <img src="/assets/img/logo.png" alt="Logo"
                                    onError={e => { e.target.style.display='none'; e.target.parentElement.innerHTML='<i class="fas fa-store" style="color:white;font-size:16px"></i>'; }} />
                            </div>
                            <div className="logo-text">
                                <span className="logo-name">Nimvo</span>
                                <span className="logo-sub">Sistema Inteligente</span>
                            </div>
                        </div>
                        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
                            <i className="fas fa-bars"></i>
                        </button>
                    </div>

                    <div className="sidebar-user">
                        <div className="user-avatar">{userInitials}</div>
                        <div className="user-info">
                            <span className="user-name">{auth?.user?.name || 'Usuário'}</span>
                            <span className="user-role">{auth?.user?.role || 'operador'}</span>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        {allNav.map((group) => (
                            <div key={group.section}>
                                <div className="nav-section-label">{group.section}</div>
                                {group.items.map(item => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                                    >
                                        <i className={`fas ${item.icon}`}></i>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </nav>

                    <div className="sidebar-footer">
                        <button className="logout-btn" onClick={handleLogout}>
                            <i className="fas fa-right-from-bracket"></i>
                            <span>Sair</span>
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <div className={`main-wrapper ${collapsed ? 'collapsed' : ''}`}>
                    <header className="topbar">
                        <div className="topbar-left">
                            <button className="topbar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                <i className="fas fa-bars"></i>
                            </button>
                            <span className="page-title">{title}</span>
                        </div>
                        <div className="topbar-right">
                            <div className="topbar-info">
                                <i className="far fa-calendar"></i>
                                <span>{currentDate}</span>
                            </div>
                            <div className="topbar-info">
                                <i className="far fa-clock"></i>
                                <span>{currentTime}</span>
                            </div>
                        </div>
                    </header>

                    <main className="page-content">
                        {children}
                    </main>
                </div>
            </div>
        </>
    )
}

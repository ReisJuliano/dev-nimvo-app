<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nimvo | Sistema de gestão para o seu negócio</title>
    <meta name="description" content="O Nimvo é o sistema de gestão completo para o seu comércio: vendas, estoque, caixa, usuários, contas e emissão fiscal reunidos em um único ambiente, com aplicativo móvel dedicado.">
    <meta property="og:title" content="Nimvo | Sistema de gestão para o seu negócio">
    <meta property="og:description" content="Vendas, estoque, caixa, usuários, contas a pagar e emissão de NFC-e em um só sistema. Acompanhe o seu negócio em tempo real, do computador ou do celular.">
    <meta property="og:image" content="{{ asset('assets/img/logo.png') }}">
    <meta property="og:type" content="website">
    <link rel="icon" href="{{ asset('assets/img/logo.png') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('assets/css/site.css') }}?v={{ @filemtime(public_path('assets/css/site.css')) ?: 3 }}">
</head>
<body>

    <header class="site-header" data-site-header>
        <div class="container">
            <a href="#top" class="site-brand">
                <img src="{{ asset('assets/img/logo.png') }}" alt="Nimvo">
                <span>Nimvo</span>
            </a>

            <nav class="site-nav" data-site-nav>
                <a href="#recursos">Recursos</a>
                <a href="#como-funciona">Como funciona</a>
                <a href="#app">Aplicativo móvel</a>
                <a href="#contato">Contato</a>
            </nav>

            <div class="site-header-actions">
                <a href="#contato" class="btn btn-outline">Fale conosco</a>
                <button type="button" class="nav-toggle" data-nav-toggle aria-label="Abrir menu">
                    <span class="nav-toggle-lines"></span>
                </button>
            </div>
        </div>
    </header>

    <main id="top">
        <section class="hero" data-hero>
            <div class="hero-photo"></div>
            <div class="hero-spotlight" data-spotlight></div>
            <div class="hero-blob hero-blob--1"></div>
            <div class="hero-blob hero-blob--2"></div>
            <div class="hero-blob hero-blob--3"></div>
            <div class="hero-particles" data-particles></div>

            <div class="container hero-grid">
                <div class="hero-copy">
                    <span class="eyebrow">Gestão completa para o seu negócio</span>
                    <h1>Sua empresa mais organizada, <span>do caixa ao estoque</span>.</h1>
                    <p>O Nimvo reúne vendas, estoque, caixa, usuários, contas e emissão fiscal em um único sistema, simples no dia a dia e completo para quem administra o negócio.</p>

                    <div class="hero-actions">
                        <a href="#contato" class="btn btn-primary btn-lg"><span>Falar com nossa equipe</span></a>
                        <a href="#recursos" class="btn btn-ghost btn-lg">Conhecer os recursos</a>
                    </div>

                    <div class="hero-trust">
                        <span class="hero-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            Emissão fiscal integrada
                        </span>
                        <span class="hero-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            Aplicativo móvel incluso
                        </span>
                        <span class="hero-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            Suporte humano e próximo
                        </span>
                    </div>
                </div>
            </div>

            <a href="#recursos" class="hero-scroll-cue" aria-label="Rolar para conhecer os recursos">
                <span></span>
            </a>
        </section>

        <section class="showcase">
            <div class="showcase-glow showcase-glow--1"></div>
            <div class="showcase-glow showcase-glow--2"></div>

            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow" style="background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:#cbd5f5;">Veja o sistema em ação</span>
                    <h2 style="color:#fff;">Uma tela para cada momento do seu negócio</h2>
                    <p style="color:rgba(226,232,240,0.72);">Do resumo do dia ao financeiro, cada módulo do Nimvo reúne exatamente as informações que importam, sem telas vazias.</p>
                </div>

                <div class="glass-card reveal" data-tilt data-glass-carousel>
                    <div class="glass-card-glare"></div>

                    <div class="glass-device">
                        <div class="glass-dots"><i></i><i></i><i></i></div>
                        <div class="device-screen showcase-screen">
                            <div class="mock-sidebar">
                                <i class="is-active"></i><i></i><i></i><i></i><i></i><i></i>
                            </div>
                            <div class="mock-content">
                                <div class="mock-slide is-active" data-gslide>
                                    <div class="mock-topbar"><strong>Resumo da loja</strong><span>qua., 1 de jul.</span></div>
                                    <div class="mock-body">
                                        <div class="mock-alert">⚠ 1 conta vencida · total em atraso R$ 232,00</div>
                                        <div class="mock-kpis cols-4">
                                            <div class="mock-kpi accent"><span>Vendido hoje</span><strong>R$ 1.240</strong></div>
                                            <div class="mock-kpi success"><span>Lucro</span><strong>R$ 386</strong></div>
                                            <div class="mock-kpi"><span>Caixa aberto</span><strong>R$ 640</strong></div>
                                            <div class="mock-kpi warning"><span>Ticket médio</span><strong>R$ 47</strong></div>
                                        </div>
                                        <div class="mock-chart">
                                            <i style="height:35%"></i><i style="height:55%"></i><i style="height:40%"></i>
                                            <i style="height:70%"></i><i style="height:50%"></i><i style="height:85%"></i>
                                            <i style="height:60%"></i><i style="height:75%"></i>
                                        </div>
                                        <div class="mock-rows">
                                            <div class="mock-row"><b>Maria da Silva</b><span>16:32 · Dinheiro</span><em>R$ 36,72</em></div>
                                            <div class="mock-row"><b>Cliente balcão</b><span>15:07 · Pix</span><em>R$ 89,40</em></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mock-slide" data-gslide>
                                    <div class="mock-topbar"><strong>Vendas de hoje</strong><span>12 vendas</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi accent"><span>Total vendido</span><strong>R$ 1.240</strong></div>
                                            <div class="mock-kpi"><span>Ticket médio</span><strong>R$ 47</strong></div>
                                            <div class="mock-kpi success"><span>Itens vendidos</span><strong>31</strong></div>
                                        </div>
                                        <div class="mock-chips">
                                            <span class="mock-chip is-active">Hoje</span>
                                            <span class="mock-chip">Semana</span>
                                            <span class="mock-chip">Mês</span>
                                        </div>
                                        <div class="mock-rows">
                                            <div class="mock-row"><b>Maria da Silva</b><span>Dinheiro</span><em>R$ 36,72</em></div>
                                            <div class="mock-row"><b>Cliente balcão</b><span>Pix</span><em>R$ 89,40</em></div>
                                            <div class="mock-row"><b>João Pereira</b><span>Cartão</span><em>R$ 124,90</em></div>
                                        </div>
                                        <div class="mock-legend">
                                            <span><i style="background:#4f46e5"></i> Pix 42%</span>
                                            <span><i style="background:#10b981"></i> Dinheiro 33%</span>
                                            <span><i style="background:#06b6d4"></i> Cartão 25%</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="mock-slide" data-gslide>
                                    <div class="mock-topbar"><strong>Estoque</strong><span>48 produtos</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi"><span>Produtos</span><strong>48</strong></div>
                                            <div class="mock-kpi warning"><span>Estoque baixo</span><strong>5</strong></div>
                                            <div class="mock-kpi"><span>Sem estoque</span><strong>1</strong></div>
                                        </div>
                                        <div class="mock-chips">
                                            <span class="mock-chip is-active">Todos</span>
                                            <span class="mock-chip">Mercearia</span>
                                            <span class="mock-chip">Bebidas</span>
                                        </div>
                                        <div class="mock-list">
                                            <div class="mock-row"><b>Arroz Tipo 1 5kg</b><span>32 un.</span></div>
                                            <div class="mock-bar"><i style="width:78%"></i></div>
                                            <div class="mock-row"><b>Feijão Carioca 1kg</b><span>9 un.</span></div>
                                            <div class="mock-bar"><i style="width:22%"></i></div>
                                            <div class="mock-row"><b>Óleo de Soja 900ml</b><span>54 un.</span></div>
                                            <div class="mock-bar"><i style="width:92%"></i></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mock-slide" data-gslide>
                                    <div class="mock-topbar"><strong>Painel financeiro</strong><span>Julho/2026</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi success"><span>A receber</span><strong>R$ 2,1k</strong></div>
                                            <div class="mock-kpi warning"><span>A pagar</span><strong>R$ 1,3k</strong></div>
                                        </div>
                                        <div class="mock-chart">
                                            <i style="height:30%"></i><i style="height:50%"></i><i style="height:38%"></i>
                                            <i style="height:66%"></i><i style="height:44%"></i><i style="height:78%"></i>
                                        </div>
                                        <div class="mock-rows">
                                            <div class="mock-row"><b>Distribuidora Sul</b><span>Venc. 05/07</span><span class="mock-status late">Atrasada</span></div>
                                            <div class="mock-row"><b>Energia elétrica</b><span>Venc. 10/07</span><span class="mock-status ok">Em dia</span></div>
                                            <div class="mock-row"><b>Fornecedor Bebidas</b><span>Venc. 18/07</span><span class="mock-status ok">Em dia</span></div>
                                        </div>
                                        <div class="mock-total"><span>Total em aberto</span><strong>R$ 1.860,00</strong></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="showcase-tabs">
                        <button type="button" class="showcase-tab is-active" data-gtab data-duration="5200">
                            <span class="showcase-tab-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                            </span>
                            <span class="showcase-tab-label">Resumo</span>
                            <span class="showcase-tab-progress"><i></i></span>
                        </button>
                        <button type="button" class="showcase-tab" data-gtab data-duration="5200">
                            <span class="showcase-tab-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                            </span>
                            <span class="showcase-tab-label">Vendas</span>
                            <span class="showcase-tab-progress"><i></i></span>
                        </button>
                        <button type="button" class="showcase-tab" data-gtab data-duration="5200">
                            <span class="showcase-tab-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                            </span>
                            <span class="showcase-tab-label">Estoque</span>
                            <span class="showcase-tab-progress"><i></i></span>
                        </button>
                        <button type="button" class="showcase-tab" data-gtab data-duration="5200">
                            <span class="showcase-tab-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
                            </span>
                            <span class="showcase-tab-label">Financeiro</span>
                            <span class="showcase-tab-progress"><i></i></span>
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section" id="recursos">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Recursos</span>
                    <h2>Tudo o que o seu negócio precisa, em um só lugar</h2>
                    <p>Do balcão ao financeiro, o Nimvo acompanha a rotina do seu estabelecimento sem exigir múltiplas ferramentas.</p>
                </div>

                <div class="features-grid">
                    <div class="feature-card reveal">
                        <div class="feature-icon" style="--feature-color:#4f46e5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        </div>
                        <h3>Vendas e frente de caixa</h3>
                        <p>Frente de caixa ágil, com atalhos que aceleram o atendimento e recibo disponível imediatamente após a venda.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-1">
                        <div class="feature-icon" style="--feature-color:#06b6d4">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                        </div>
                        <h3>Controle de estoque</h3>
                        <p>Entradas, saídas e ajustes registrados com precisão, com alertas automáticos quando um produto está em falta.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-2">
                        <div class="feature-icon" style="--feature-color:#10b981">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg>
                        </div>
                        <h3>Caixa e fluxo de caixa</h3>
                        <p>Abertura, sangria e fechamento de caixa com saldo sempre visível e conferido ao longo do dia.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-3">
                        <div class="feature-icon" style="--feature-color:#f59e0b">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
                        </div>
                        <h3>Usuários e permissões</h3>
                        <p>Defina perfis de acesso para cada integrante da equipe, do administrador ao operador de caixa.</p>
                    </div>

                    <div class="feature-card reveal">
                        <div class="feature-icon" style="--feature-color:#f43f5e">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
                        </div>
                        <h3>Contas a pagar</h3>
                        <p>Organize fornecedores e vencimentos para evitar atrasos e manter o financeiro sob controle.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-1">
                        <div class="feature-icon" style="--feature-color:#8b5cf6">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
                        </div>
                        <h3>Emissão de NFC-e</h3>
                        <p>Nota fiscal de consumidor emitida diretamente no momento da venda, sem sair do sistema.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-2">
                        <div class="feature-icon" style="--feature-color:#4338ca">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                        </div>
                        <h3>Relatórios e indicadores</h3>
                        <p>Acompanhe os produtos mais vendidos, a margem de lucro e a saúde financeira do negócio em gráficos objetivos.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-3">
                        <div class="feature-icon" style="--feature-color:#ec4899">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
                        </div>
                        <h3>Aplicativo móvel</h3>
                        <p>Acompanhe vendas e estoque do seu estabelecimento pelo celular, onde quer que você esteja.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section site-section--tight" id="telas" style="background:var(--surface);">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Conheça o sistema</span>
                    <h2>Mais telas, mais contexto sobre a rotina do seu negócio</h2>
                    <p>Cada módulo do Nimvo foi desenhado para reduzir cliques e apresentar exatamente a informação necessária em cada etapa do trabalho.</p>
                </div>

                <div class="screens-grid">
                    <div class="screen-card reveal">
                        <div class="screen-frame">
                            <div class="device-screen">
                                <div class="mock-sidebar"><i></i><i class="is-active"></i><i></i><i></i></div>
                                <div class="mock-content">
                                    <div class="mock-slide is-active">
                                        <div class="mock-topbar"><strong>Usuários</strong><span>5 ativos</span></div>
                                        <div class="mock-body">
                                            <div class="mock-rows">
                                                <div class="mock-row"><b>Diogo Reis</b><span>Administrador</span><span class="mock-chip is-active">Total</span></div>
                                                <div class="mock-row"><b>Ana Souza</b><span>Operador de caixa</span><span class="mock-chip">Vendas</span></div>
                                                <div class="mock-row"><b>Carlos Lima</b><span>Estoquista</span><span class="mock-chip">Estoque</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3>Usuários e permissões</h3>
                        <p>Cadastre a equipe e defina exatamente o que cada perfil pode acessar no sistema.</p>
                    </div>

                    <div class="screen-card reveal reveal-delay-1">
                        <div class="screen-frame">
                            <div class="device-screen">
                                <div class="mock-sidebar"><i></i><i></i><i class="is-active"></i><i></i></div>
                                <div class="mock-content">
                                    <div class="mock-slide is-active">
                                        <div class="mock-topbar"><strong>Relatórios</strong><span>Últimos 30 dias</span></div>
                                        <div class="mock-body">
                                            <div class="mock-kpis">
                                                <div class="mock-kpi accent"><span>Faturamento</span><strong>R$ 28,4k</strong></div>
                                                <div class="mock-kpi success"><span>Margem</span><strong>24%</strong></div>
                                            </div>
                                            <div class="mock-chart">
                                                <i style="height:30%"></i><i style="height:50%"></i><i style="height:38%"></i>
                                                <i style="height:66%"></i><i style="height:44%"></i><i style="height:78%"></i>
                                                <i style="height:58%"></i><i style="height:90%"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3>Relatórios gerenciais</h3>
                        <p>Visualize faturamento, margem e desempenho de vendas em painéis simples de interpretar.</p>
                    </div>

                    <div class="screen-card reveal reveal-delay-2">
                        <div class="screen-frame">
                            <div class="device-screen">
                                <div class="mock-sidebar"><i></i><i></i><i></i><i class="is-active"></i></div>
                                <div class="mock-content">
                                    <div class="mock-slide is-active">
                                        <div class="mock-topbar"><strong>Entrada de mercadoria</strong><span>Nota 000482</span></div>
                                        <div class="mock-body">
                                            <div class="mock-rows">
                                                <div class="mock-row"><b>Arroz Tipo 1 5kg</b><span>Fornecedor A</span><em>+40 un.</em></div>
                                                <div class="mock-row"><b>Óleo de Soja 900ml</b><span>Fornecedor B</span><em>+60 un.</em></div>
                                            </div>
                                            <div class="mock-total"><span>Total da nota</span><strong>R$ 1.240,00</strong></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3>Entrada de mercadoria</h3>
                        <p>Registre notas de compra e atualize o estoque automaticamente, sem lançamentos manuais duplicados.</p>
                    </div>

                    <div class="screen-card reveal reveal-delay-3">
                        <div class="screen-frame">
                            <div class="device-screen">
                                <div class="mock-sidebar"><i class="is-active"></i><i></i><i></i><i></i></div>
                                <div class="mock-content">
                                    <div class="mock-slide is-active">
                                        <div class="mock-topbar"><strong>Frente de caixa</strong><span>Venda em aberto</span></div>
                                        <div class="mock-body">
                                            <div class="mock-rows">
                                                <div class="mock-row"><b>Arroz Tipo 1 5kg</b><span>1 un.</span><em>R$ 23,31</em></div>
                                                <div class="mock-row"><b>Feijão Carioca 1kg</b><span>2 un.</span><em>R$ 16,85</em></div>
                                                <div class="mock-row"><b>Óleo de Soja 900ml</b><span>1 un.</span><em>R$ 9,90</em></div>
                                            </div>
                                            <div class="mock-total"><span>Total da venda</span><strong>R$ 66,91</strong></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3>Frente de caixa</h3>
                        <p>Registre vendas com poucos toques e finalize com recibo ou NFC-e imediatamente.</p>
                    </div>

                    <div class="screen-card reveal">
                        <div class="screen-frame">
                            <div class="device-screen">
                                <div class="mock-sidebar"><i></i><i class="is-active"></i><i></i><i></i></div>
                                <div class="mock-content">
                                    <div class="mock-slide is-active">
                                        <div class="mock-topbar"><strong>Painel financeiro</strong><span>Julho/2026</span></div>
                                        <div class="mock-body">
                                            <div class="mock-kpis">
                                                <div class="mock-kpi success"><span>A receber</span><strong>R$ 2,1k</strong></div>
                                                <div class="mock-kpi warning"><span>A pagar</span><strong>R$ 1,3k</strong></div>
                                            </div>
                                            <div class="mock-rows">
                                                <div class="mock-row"><b>Distribuidora Sul</b><span>Venc. 05/07</span><span class="mock-status late">Atrasada</span></div>
                                                <div class="mock-row"><b>Energia elétrica</b><span>Venc. 10/07</span><span class="mock-status ok">Em dia</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3>Painel financeiro</h3>
                        <p>Visualize contas a pagar e a receber lado a lado, com vencimentos sempre em vista.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section site-section--tight" id="como-funciona">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Como funciona</span>
                    <h2>Comece a utilizar em poucas etapas</h2>
                    <p>Sem planilhas dispersas e sem depender de múltiplos aplicativos para administrar o mesmo negócio.</p>
                </div>

                <div class="steps">
                    <div class="step-card reveal">
                        <div class="step-number">1</div>
                        <h3>Cadastro da sua loja</h3>
                        <p>Nossa equipe conversa com você, compreende as necessidades do negócio e configura o Nimvo sob medida.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-1">
                        <div class="step-number">2</div>
                        <h3>Configuração de produtos e estoque</h3>
                        <p>Cadastramos produtos, categorias e o estoque inicial com o apoio direto da nossa equipe.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-2">
                        <div class="step-number">3</div>
                        <h3>Início das vendas</h3>
                        <p>Abra o caixa e comece a vender pelo computador, tablet ou smartphone, sem complicação.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-3">
                        <div class="step-number">4</div>
                        <h3>Acompanhamento em tempo real</h3>
                        <p>Vendas, estoque e caixa permanecem atualizados a cada movimento do seu estabelecimento.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section site-section--tight" id="diferenciais" style="background:var(--surface);">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Diferenciais</span>
                    <h2>Por que empresas confiam no Nimvo</h2>
                    <p>Mais do que um sistema, um parceiro dedicado à gestão do seu negócio.</p>
                </div>

                <div class="benefits-grid">
                    <div class="benefit-card reveal">
                        <span class="benefit-number">01</span>
                        <h3>Tudo integrado</h3>
                        <p>Vendas, estoque, caixa e financeiro se comunicam entre si, eliminando retrabalho e divergências de informação.</p>
                    </div>
                    <div class="benefit-card reveal reveal-delay-1">
                        <span class="benefit-number">02</span>
                        <h3>Conformidade fiscal</h3>
                        <p>Emissão de NFC-e alinhada à legislação vigente, integrada diretamente ao fluxo de vendas.</p>
                    </div>
                    <div class="benefit-card reveal reveal-delay-2">
                        <span class="benefit-number">03</span>
                        <h3>Suporte próximo</h3>
                        <p>Equipe acessível por telefone, WhatsApp e e-mail para auxiliar na configuração e no uso diário do sistema.</p>
                    </div>
                    <div class="benefit-card reveal reveal-delay-3">
                        <span class="benefit-number">04</span>
                        <h3>Evolução contínua</h3>
                        <p>O sistema recebe novos recursos e melhorias com regularidade, sem custo adicional para clientes ativos.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section" id="app">
            <div class="container">
                <div class="app-section reveal">
                    <div class="app-section-copy">
                        <span class="eyebrow" style="background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:#cbd5f5;">Aplicativo Nimvo</span>
                        <h2>Acompanhe sua loja também pelo smartphone</h2>
                        <p>O aplicativo Nimvo é voltado ao acompanhamento do negócio: relatórios, indicadores e controle de dados em tempo real, direto do celular, sem depender do computador da loja.</p>
                        <ul class="app-checklist">
                            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Resumo da loja e tendência de vendas em tempo real</li>
                            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Relatórios e indicadores ao alcance de um toque</li>
                            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Incluído sem custo adicional para clientes Nimvo</li>
                        </ul>
                    </div>
                    <div class="app-section-visual">
                        <div class="app-phone-frame">
                            <div class="device-screen">
                                <div class="mock-content">
                                <div class="mock-slide is-active">
                                    <div class="mock-topbar"><strong>Nimvo</strong><span>Admin</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi accent"><span>Hoje</span><strong>R$ 1.240</strong></div>
                                            <div class="mock-kpi success"><span>Lucro</span><strong>R$ 386</strong></div>
                                        </div>
                                        <div class="mock-sparkline">
                                            <span>Tendência de vendas</span>
                                            <svg viewBox="0 0 100 34" preserveAspectRatio="none">
                                                <polyline points="0,26 15,28 30,24 45,20 60,22 75,10 100,4" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </div>
                                        <div class="mock-mini-list">
                                            <p>Top produtos</p>
                                            <div class="mock-row"><b>Arroz Tipo 1 5kg</b><span>1 un.</span><em>R$ 23,31</em></div>
                                            <div class="mock-row"><b>Feijão Carioca 1kg</b><span>2 un.</span><em>R$ 16,85</em></div>
                                        </div>
                                    </div>
                                </div>
                                </div>
                                <div class="app-bottom-nav">
                                    <i class="is-active"></i><i></i><i></i><i></i><i></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section site-section--tight" id="faq" style="background:var(--surface);">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Dúvidas frequentes</span>
                    <h2>Perguntas frequentes</h2>
                    <p>Reunimos as dúvidas mais comuns de quem está conhecendo o Nimvo.</p>
                </div>

                <div class="faq-list reveal">
                    <details class="faq-item" open>
                        <summary>Preciso de conhecimento técnico para utilizar o Nimvo?</summary>
                        <p>Não. A interface foi desenvolvida para a rotina do comércio, sem exigir conhecimento técnico prévio. Nossa equipe também auxilia na configuração inicial.</p>
                    </details>
                    <details class="faq-item">
                        <summary>O sistema emite nota fiscal?</summary>
                        <p>Sim. O Nimvo conta com emissão de NFC-e integrada diretamente ao fluxo de vendas, sem necessidade de sistemas auxiliares.</p>
                    </details>
                    <details class="faq-item">
                        <summary>O Nimvo funciona em qualquer dispositivo?</summary>
                        <p>O sistema funciona em navegadores de computador e tablet, além de contar com aplicativo próprio para Android voltado ao acompanhamento de relatórios e ao controle de dados da loja.</p>
                    </details>
                    <details class="faq-item">
                        <summary>Como funciona o suporte?</summary>
                        <p>Nossa equipe atende diretamente por telefone, WhatsApp e e-mail, de segunda a sexta-feira, das 8h às 18h.</p>
                    </details>
                    <details class="faq-item">
                        <summary>É possível migrar os dados de outro sistema?</summary>
                        <p>Sim. Nossa equipe auxilia na migração inicial de produtos, estoque e clientes durante a implantação do Nimvo.</p>
                    </details>
                </div>
            </div>
        </section>

        <section class="site-section" id="contato">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Contato</span>
                    <h2>Fale com a nossa equipe</h2>
                    <p>Conte um pouco sobre o seu negócio; retornaremos o contato o quanto antes.</p>
                </div>

                <div class="contact-grid reveal">
                    <div class="contact-info">
                        <h3>Nimvo</h3>
                        <p>Atendimento próximo e especializado, diretamente com a equipe responsável pelo sistema.</p>

                        <a href="https://wa.me/5543998157107" target="_blank" rel="noopener" class="contact-line">
                            <span class="contact-line-icon contact-line-icon--whatsapp">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            </span>
                            <span>
                                <strong>(43) 99815-7107</strong>
                                <span>WhatsApp e telefone</span>
                            </span>
                        </a>

                        <a href="mailto:contato@nimvo.com.br" class="contact-line">
                            <span class="contact-line-icon contact-line-icon--email">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            </span>
                            <span>
                                <strong>contato@nimvo.com.br</strong>
                                <span>E-mail</span>
                            </span>
                        </a>

                        <div class="contact-line">
                            <span class="contact-line-icon contact-line-icon--clock">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            </span>
                            <span>
                                <strong>Segunda a sexta-feira, 8h às 18h</strong>
                                <span>Horário de atendimento</span>
                            </span>
                        </div>
                    </div>

                    <div class="contact-form-card">
                        <div class="form-feedback {{ session('contact_sent') ? 'is-visible success' : '' }}" data-form-feedback>
                            @if (session('contact_sent'))
                                Mensagem enviada com sucesso. Em breve entraremos em contato.
                            @endif
                        </div>

                        <form action="/contato" method="POST" data-contact-form novalidate>
                            @csrf
                            <div class="form-honeypot" aria-hidden="true">
                                <label for="website">Deixe em branco</label>
                                <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
                            </div>

                            <div class="form-row">
                                <div class="form-group" data-field="name">
                                    <label for="contact-name">Nome</label>
                                    <input type="text" id="contact-name" name="name" value="{{ old('name') }}" required>
                                    <span class="field-error" data-field-error>{{ $errors->first('name') }}</span>
                                </div>
                                <div class="form-group" data-field="email">
                                    <label for="contact-email">E-mail</label>
                                    <input type="email" id="contact-email" name="email" value="{{ old('email') }}" required>
                                    <span class="field-error" data-field-error>{{ $errors->first('email') }}</span>
                                </div>
                            </div>

                            <div class="form-group" data-field="phone">
                                <label for="contact-phone">Telefone (opcional)</label>
                                <input type="text" id="contact-phone" name="phone" value="{{ old('phone') }}">
                                <span class="field-error" data-field-error>{{ $errors->first('phone') }}</span>
                            </div>

                            <div class="form-group" data-field="message">
                                <label for="contact-message">Mensagem</label>
                                <textarea id="contact-message" name="message" rows="4" required>{{ old('message') }}</textarea>
                                <span class="field-error" data-field-error>{{ $errors->first('message') }}</span>
                            </div>

                            <button type="submit" class="btn btn-primary btn-block btn-lg" data-submit-btn>Enviar mensagem</button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="site-footer">
        <div class="container">
            <div class="footer-grid">
                <div class="footer-about">
                    <div class="footer-brand">
                        <img src="{{ asset('assets/img/logo.png') }}" alt="Nimvo">
                        <span>Nimvo</span>
                    </div>
                    <p>Sistema de gestão completo para comércios: vendas, estoque, caixa, usuários, contas e emissão fiscal em um único ambiente.</p>
                </div>

                <div class="footer-col">
                    <h4 class="footer-heading">Navegação</h4>
                    <ul>
                        <li><a href="#recursos">Recursos</a></li>
                        <li><a href="#como-funciona">Como funciona</a></li>
                        <li><a href="#app">Aplicativo móvel</a></li>
                        <li><a href="#faq">Dúvidas frequentes</a></li>
                    </ul>
                </div>

                <div class="footer-col">
                    <h4 class="footer-heading">Empresa</h4>
                    <ul>
                        <li><a href="#diferenciais">Diferenciais</a></li>
                        <li><a href="#telas">Conheça o sistema</a></li>
                        <li><a href="#contato">Contato</a></li>
                    </ul>
                </div>

                <div class="footer-col">
                    <h4 class="footer-heading">Contato</h4>
                    <address>
                        <span>contato@nimvo.com.br</span>
                        <span>(43) 99815-7107</span>
                        <span>Segunda a sexta-feira, 8h às 18h</span>
                    </address>
                </div>
            </div>
            <div class="footer-bottom">
                <span>&copy; {{ date('Y') }} Nimvo. Todos os direitos reservados.</span>
            </div>
        </div>
    </footer>

    <script src="{{ asset('assets/js/site.js') }}?v={{ @filemtime(public_path('assets/js/site.js')) ?: 3 }}"></script>
</body>
</html>

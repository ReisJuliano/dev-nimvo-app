<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nimvo — Sistema de gestão para o seu negócio</title>
    <meta name="description" content="Nimvo é o sistema de gestão completo para o seu comércio: vendas, estoque, caixa, fiado, contas e emissão fiscal em um só lugar, com app mobile.">
    <meta property="og:title" content="Nimvo — Sistema de gestão para o seu negócio">
    <meta property="og:description" content="Vendas, estoque, caixa, fiado, contas a pagar e emissão de NFC-e em um só sistema. Acompanhe sua loja em tempo real, do computador ou do celular.">
    <meta property="og:image" content="{{ asset('assets/img/logo.png') }}">
    <meta property="og:type" content="website">
    <link rel="icon" href="{{ asset('assets/img/logo.png') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('assets/css/site.css') }}?v=1">
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
                <a href="#app">App mobile</a>
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
        <section class="hero">
            <div class="hero-bg-grid"></div>
            <div class="hero-blob hero-blob--1"></div>
            <div class="hero-blob hero-blob--2"></div>
            <div class="hero-blob hero-blob--3"></div>
            <div class="hero-particles" data-particles></div>

            <div class="container hero-grid">
                <div class="hero-copy">
                    <span class="eyebrow">Gestão completa para o seu negócio</span>
                    <h1>Sua loja mais organizada, <span>do caixa ao estoque</span>.</h1>
                    <p>O Nimvo reúne vendas, estoque, caixa, fiado, contas e emissão fiscal em um único sistema — simples para o dia a dia e completo para quem cuida do negócio.</p>

                    <div class="hero-actions">
                        <a href="#contato" class="btn btn-primary btn-lg">Falar com a gente</a>
                        <a href="#recursos" class="btn btn-ghost btn-lg">Ver como funciona</a>
                    </div>

                    <div class="hero-trust">
                        <span class="hero-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            Emissão fiscal integrada
                        </span>
                        <span class="hero-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            App mobile incluso
                        </span>
                        <span class="hero-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            Suporte humano
                        </span>
                    </div>
                </div>

                <div class="hero-showcase">
                    <div class="device-stack">
                        <div class="device-monitor">
                            <div class="device-screen">
                                <div class="mock-slide is-active" data-slide>
                                    <div class="mock-topbar"><strong>Resumo da loja</strong><span>qua., 1 de jul.</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi accent"><span>Vendido hoje</span><strong>R$ 1.240</strong></div>
                                            <div class="mock-kpi success"><span>Lucro</span><strong>R$ 386</strong></div>
                                            <div class="mock-kpi"><span>Caixa aberto</span><strong>R$ 640</strong></div>
                                        </div>
                                        <div class="mock-chart">
                                            <i style="height:35%"></i><i style="height:55%"></i><i style="height:40%"></i>
                                            <i style="height:70%"></i><i style="height:50%"></i><i style="height:85%"></i>
                                            <i style="height:60%"></i>
                                        </div>
                                    </div>
                                </div>

                                <div class="mock-slide" data-slide>
                                    <div class="mock-topbar"><strong>Vendas de hoje</strong><span>12 vendas</span></div>
                                    <div class="mock-body">
                                        <div class="mock-rows">
                                            <div class="mock-row"><b>Maria da Silva</b><span>Dinheiro</span><em>R$ 36,72</em></div>
                                            <div class="mock-row"><b>Não identificado</b><span>Pix</span><em>R$ 89,40</em></div>
                                            <div class="mock-row"><b>João Pereira</b><span>Cartão</span><em>R$ 124,90</em></div>
                                            <div class="mock-row"><b>Não identificado</b><span>Dinheiro</span><em>R$ 14,90</em></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mock-slide" data-slide>
                                    <div class="mock-topbar"><strong>Estoque</strong><span>48 produtos</span></div>
                                    <div class="mock-body">
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
                            </div>
                        </div>

                        <div class="device-phone">
                            <div class="device-screen">
                                <div class="mock-slide is-active">
                                    <div class="mock-topbar"><strong>Nimvo</strong><span>Admin</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi accent"><span>Hoje</span><strong>R$ 1.240</strong></div>
                                            <div class="mock-kpi success"><span>Lucro</span><strong>R$ 386</strong></div>
                                        </div>
                                        <div class="mock-chart">
                                            <i style="height:40%"></i><i style="height:65%"></i><i style="height:50%"></i><i style="height:80%"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="showcase-dots">
                        <button type="button" class="showcase-dot is-active" data-dot aria-label="Resumo da loja"></button>
                        <button type="button" class="showcase-dot" data-dot aria-label="Vendas"></button>
                        <button type="button" class="showcase-dot" data-dot aria-label="Estoque"></button>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section" id="recursos">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Recursos</span>
                    <h2>Tudo que sua loja precisa, em um só lugar</h2>
                    <p>Do balcão ao financeiro, o Nimvo acompanha a rotina do seu negócio sem complicação.</p>
                </div>

                <div class="features-grid">
                    <div class="feature-card reveal">
                        <div class="feature-icon" style="--feature-color:#4f46e5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        </div>
                        <h3>Vendas &amp; PDV</h3>
                        <p>Frente de caixa rápida, com atalhos para vender em poucos toques e recibo pronto na hora.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-1">
                        <div class="feature-icon" style="--feature-color:#06b6d4">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                        </div>
                        <h3>Controle de estoque</h3>
                        <p>Entradas, saídas e ajustes com alerta automático quando um produto está acabando.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-2">
                        <div class="feature-icon" style="--feature-color:#10b981">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg>
                        </div>
                        <h3>Caixa e fluxo de caixa</h3>
                        <p>Abertura, sangria e fechamento de caixa com saldo sempre visível e conferido.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-3">
                        <div class="feature-icon" style="--feature-color:#f59e0b">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <h3>Fiado</h3>
                        <p>Controle o que cada cliente deve, com histórico de pagamentos e cobrança facilitada.</p>
                    </div>

                    <div class="feature-card reveal">
                        <div class="feature-icon" style="--feature-color:#f43f5e">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
                        </div>
                        <h3>Contas a pagar</h3>
                        <p>Organize fornecedores e vencimentos para nunca perder uma data importante.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-1">
                        <div class="feature-icon" style="--feature-color:#8b5cf6">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
                        </div>
                        <h3>Emissão de NFC-e</h3>
                        <p>Nota fiscal de consumidor emitida direto da venda, sem sair do sistema.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-2">
                        <div class="feature-icon" style="--feature-color:#4338ca">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                        </div>
                        <h3>Relatórios e indicadores</h3>
                        <p>Veja o que está vendendo bem, sua margem e a saúde do negócio em gráficos simples.</p>
                    </div>

                    <div class="feature-card reveal reveal-delay-3">
                        <div class="feature-icon" style="--feature-color:#ec4899">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
                        </div>
                        <h3>App mobile</h3>
                        <p>Acompanhe as vendas e o estoque da sua loja pelo celular, onde você estiver.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section site-section--tight" id="como-funciona" style="background:var(--surface);">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Como funciona</span>
                    <h2>Comece a usar em poucos passos</h2>
                    <p>Sem planilhas soltas e sem depender de vários aplicativos diferentes.</p>
                </div>

                <div class="steps">
                    <div class="step-card reveal">
                        <div class="step-number">1</div>
                        <h3>Cadastre sua loja</h3>
                        <p>Falamos com você, entendemos seu negócio e preparamos o Nimvo do seu jeito.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-1">
                        <div class="step-number">2</div>
                        <h3>Configure produtos e estoque</h3>
                        <p>Cadastre produtos, categorias e o estoque inicial com apoio da nossa equipe.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-2">
                        <div class="step-number">3</div>
                        <h3>Comece a vender</h3>
                        <p>Abra o caixa e comece a vender pelo computador, tablet ou celular.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-3">
                        <div class="step-number">4</div>
                        <h3>Acompanhe tudo em tempo real</h3>
                        <p>Veja vendas, estoque e caixa atualizados a cada movimento da loja.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section" id="app">
            <div class="container">
                <div class="app-section reveal">
                    <div class="app-section-copy">
                        <span class="eyebrow" style="background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:#cbd5f5;">App Nimvo</span>
                        <h2>Sua loja também no seu bolso</h2>
                        <p>Com o app Nimvo você acompanha vendas, estoque e caixa direto do celular, sem precisar estar no computador da loja.</p>
                        <ul class="app-checklist">
                            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Resumo da loja em tempo real</li>
                            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Mesmo login usado no sistema web</li>
                            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Gratuito para clientes Nimvo</li>
                        </ul>
                        <a href="/app/baixar" class="btn btn-primary btn-lg">Baixar o app</a>
                    </div>
                    <div class="app-section-visual">
                        <div class="app-phone-frame">
                            <div class="device-screen">
                                <div class="mock-slide is-active">
                                    <div class="mock-topbar"><strong>Nimvo</strong><span>Admin</span></div>
                                    <div class="mock-body">
                                        <div class="mock-kpis">
                                            <div class="mock-kpi accent"><span>Hoje</span><strong>R$ 1.240</strong></div>
                                            <div class="mock-kpi success"><span>Lucro</span><strong>R$ 386</strong></div>
                                        </div>
                                        <div class="mock-rows">
                                            <div class="mock-row"><b>Arroz Tipo 1 5kg</b><span>1 un.</span><em>R$ 23,31</em></div>
                                            <div class="mock-row"><b>Feijão Carioca 1kg</b><span>2 un.</span><em>R$ 16,85</em></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="site-section" id="contato" style="background:var(--surface);">
            <div class="container">
                <div class="section-head reveal">
                    <span class="eyebrow">Contato</span>
                    <h2>Fale com a gente</h2>
                    <p>Conte um pouco sobre a sua loja e retornamos o mais rápido possível.</p>
                </div>

                <div class="contact-grid reveal">
                    <div class="contact-info">
                        <h3>Nimvo</h3>
                        <p>Atendimento direto com quem cuida do sistema, sem burocracia.</p>

                        <a href="https://wa.me/5543998157107" target="_blank" rel="noopener" class="contact-line">
                            <span class="contact-line-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            </span>
                            <span>
                                <strong>(43) 99815-7107</strong>
                                <span>WhatsApp / telefone</span>
                            </span>
                        </a>

                        <a href="mailto:contato@nimvo.com.br" class="contact-line">
                            <span class="contact-line-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/></svg>
                            </span>
                            <span>
                                <strong>contato@nimvo.com.br</strong>
                                <span>E-mail</span>
                            </span>
                        </a>

                        <div class="contact-line">
                            <span class="contact-line-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            </span>
                            <span>
                                <strong>Seg. a sex., 8h às 18h</strong>
                                <span>Horário de atendimento</span>
                            </span>
                        </div>
                    </div>

                    <div class="contact-form-card">
                        <div class="form-feedback {{ session('contact_sent') ? 'is-visible success' : '' }}" data-form-feedback>
                            @if (session('contact_sent'))
                                Mensagem enviada! Em breve entramos em contato.
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
            <div class="footer-top">
                <div class="footer-brand">
                    <img src="{{ asset('assets/img/logo.png') }}" alt="Nimvo">
                    <span>Nimvo</span>
                </div>
                <div class="footer-links">
                    <a href="#recursos">Recursos</a>
                    <a href="#como-funciona">Como funciona</a>
                    <a href="#app">App mobile</a>
                    <a href="#contato">Contato</a>
                </div>
            </div>
            <div class="footer-bottom">
                <span>&copy; {{ date('Y') }} Nimvo. Todos os direitos reservados.</span>
                <span>contato@nimvo.com.br · (43) 99815-7107</span>
            </div>
        </div>
    </footer>

    <script src="{{ asset('assets/js/site.js') }}?v=1"></script>
</body>
</html>

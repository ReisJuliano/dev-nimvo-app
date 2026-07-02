<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baixar o app Nimvo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --guest-accent: #2f7cf6;
            --guest-accent-soft: #57a1ff;
            --guest-strong: #192538;
            --guest-muted: #78849a;
            --guest-text: #162235;
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif;
            color: var(--guest-text);
            background:
                radial-gradient(circle at top left, rgba(47, 124, 246, 0.16), transparent 24%),
                radial-gradient(circle at right center, rgba(7, 165, 201, 0.12), transparent 18%),
                linear-gradient(180deg, #f7f9fc 0%, #eff3f8 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 20px;
        }

        .card {
            width: 100%;
            max-width: 460px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.78);
            border-radius: 32px;
            box-shadow: 0 28px 60px rgba(15, 23, 42, 0.14);
            padding: 40px 36px;
            text-align: center;
        }

        .logo-badge {
            width: 60px;
            height: 60px;
            margin: 0 auto 18px;
            border-radius: 18px;
            background: rgba(47, 124, 246, 0.08);
            box-shadow: 0 16px 26px rgba(47, 124, 246, 0.24);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo-badge img { width: 40px; height: 40px; border-radius: 10px; }

        h1 { font-size: 1.5rem; font-weight: 700; color: var(--guest-strong); margin: 0 0 6px; }

        .subtitle { color: var(--guest-muted); font-size: 0.92rem; margin-bottom: 28px; }

        .qr-frame {
            background: #fff;
            border-radius: 20px;
            padding: 18px;
            display: inline-block;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
            margin-bottom: 22px;
        }

        .qr-frame img { display: block; width: 220px; height: 220px; }

        .download-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 15px 18px;
            border-radius: 18px;
            background: linear-gradient(135deg, var(--guest-accent), var(--guest-accent-soft));
            color: #fff;
            font-weight: 700;
            font-size: 0.98rem;
            text-decoration: none;
            box-shadow: 0 18px 30px rgba(47, 124, 246, 0.24);
            margin-bottom: 24px;
        }

        .instructions {
            text-align: left;
            background: rgba(248, 250, 254, 0.96);
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 18px;
            padding: 18px 20px;
            font-size: 0.86rem;
            color: var(--guest-text);
            line-height: 1.6;
        }

        .instructions strong { color: var(--guest-strong); }

        .unavailable {
            background: #fff1f3;
            border: 1px solid rgba(216, 78, 97, 0.2);
            color: #b23a4f;
            border-radius: 18px;
            padding: 14px 16px;
            font-size: 0.88rem;
            margin-bottom: 22px;
        }

        .version {
            margin-top: 18px;
            font-size: 0.78rem;
            color: var(--guest-muted);
        }

        .download-button[disabled] {
            opacity: 0.75;
            pointer-events: none;
        }

        .progress-wrap {
            display: none;
            margin-bottom: 24px;
        }

        .progress-wrap.is-active { display: block; }

        .progress-track {
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background: rgba(47, 124, 246, 0.12);
            overflow: hidden;
            margin-bottom: 8px;
        }

        .progress-fill {
            height: 100%;
            width: 0%;
            border-radius: 999px;
            background: linear-gradient(90deg, var(--guest-accent), var(--guest-accent-soft));
            transition: width 0.15s ease;
        }

        .progress-label {
            font-size: 0.78rem;
            color: var(--guest-muted);
        }

        .progress-error {
            display: none;
            background: #fff1f3;
            border: 1px solid rgba(216, 78, 97, 0.2);
            color: #b23a4f;
            border-radius: 14px;
            padding: 10px 14px;
            font-size: 0.82rem;
            margin-bottom: 18px;
        }

        .progress-error.is-active { display: block; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo-badge">
            <img src="{{ asset('assets/img/logo.png') }}" alt="Nimvo">
        </div>
        <h1>App Nimvo</h1>
        <p class="subtitle">Painel gerencial para acompanhar sua loja em tempo real.</p>

        @if ($available)
            <div class="qr-frame">
                <img src="{{ route('app.download.qr', $store !== '' ? ['store' => $store] : []) }}" alt="QR code para baixar o app">
            </div>

            <div id="progressError" class="progress-error">
                Nao foi possivel iniciar o download automatico. Toque em "Baixar o APK" novamente ou use o link direto.
            </div>

            <div id="progressWrap" class="progress-wrap">
                <div class="progress-track">
                    <div id="progressFill" class="progress-fill"></div>
                </div>
                <div id="progressLabel" class="progress-label">Preparando o download...</div>
            </div>

            <button type="button" id="downloadButton" class="download-button" data-url="{{ $downloadUrl }}">
                Baixar o APK
            </button>

            <div class="instructions">
                <strong>Como instalar no Android:</strong><br>
                1. Toque em "Baixar o APK" ou escaneie o QR code acima.<br>
                2. Se aparecer um aviso, permita a instalacao de apps de fontes desconhecidas para o navegador.<br>
                3. Abra o app instalado e entre com o mesmo usuario e senha que voce ja usa no site Nimvo{{ $store !== '' ? " (loja: {$store})" : '' }}.
            </div>

            @if ($versionLabel)
                <p class="version">Ultima atualizacao: {{ $versionLabel }}</p>
            @endif
        @else
            <div class="unavailable">
                O app ainda nao foi publicado neste servidor. Fale com o suporte Nimvo.
            </div>
        @endif
    </div>

    @if ($available)
        <script>
            (function () {
                const button = document.getElementById('downloadButton');
                const wrap = document.getElementById('progressWrap');
                const fill = document.getElementById('progressFill');
                const label = document.getElementById('progressLabel');
                const errorBox = document.getElementById('progressError');

                function formatMb(bytes) {
                    return (bytes / (1024 * 1024)).toFixed(1);
                }

                async function downloadWithProgress(url) {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok || !response.body) {
                        throw new Error('resposta invalida');
                    }

                    const total = parseInt(response.headers.get('Content-Length') || '0', 10);
                    const reader = response.body.getReader();
                    const chunks = [];
                    let received = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        chunks.push(value);
                        received += value.length;

                        if (total) {
                            const percent = Math.min(100, Math.round((received / total) * 100));
                            fill.style.width = percent + '%';
                            label.textContent = `Baixando... ${percent}% (${formatMb(received)} MB de ${formatMb(total)} MB)`;
                        } else {
                            label.textContent = `Baixando... ${formatMb(received)} MB`;
                        }
                    }

                    fill.style.width = '100%';
                    label.textContent = 'Finalizando...';

                    return new Blob(chunks, { type: 'application/vnd.android.package-archive' });
                }

                button.addEventListener('click', async function () {
                    errorBox.classList.remove('is-active');
                    button.setAttribute('disabled', 'disabled');
                    wrap.classList.add('is-active');
                    fill.style.width = '0%';
                    label.textContent = 'Preparando o download...';

                    try {
                        const blob = await downloadWithProgress(button.dataset.url);
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = 'nimvo-app.apk';
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                        label.textContent = 'Download concluido! Abra o arquivo pra instalar.';
                    } catch (error) {
                        errorBox.classList.add('is-active');
                        wrap.classList.remove('is-active');
                    } finally {
                        button.removeAttribute('disabled');
                    }
                });
            })();
        </script>
    @endif
</body>
</html>

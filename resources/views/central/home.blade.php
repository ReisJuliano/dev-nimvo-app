<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nimvo Central</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f4efe7;
            --panel: #fffaf2;
            --text: #1f2937;
            --muted: #6b7280;
            --accent: #c26a2d;
            --border: #e7d7c7;
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: "Segoe UI", sans-serif;
            background:
                radial-gradient(circle at top right, rgba(194, 106, 45, 0.18), transparent 24rem),
                linear-gradient(180deg, #fbf6ee 0%, var(--bg) 100%);
            color: var(--text);
        }

        .shell {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 2rem;
        }

        .card {
            width: min(56rem, 100%);
            background: rgba(255, 250, 242, 0.96);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 2rem;
            box-shadow: 0 24px 60px rgba(31, 41, 55, 0.12);
        }

        h1 {
            margin: 0 0 0.75rem;
            font-size: clamp(2rem, 4vw, 3rem);
        }

        p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
        }

        .grid {
            display: grid;
            gap: 1rem;
            grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
            margin-top: 2rem;
        }

        .panel {
            background: white;
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 1rem 1.25rem;
        }

        .eyebrow {
            display: inline-flex;
            margin-bottom: 1rem;
            padding: 0.4rem 0.75rem;
            border-radius: 999px;
            background: rgba(194, 106, 45, 0.12);
            color: var(--accent);
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            font-size: 0.75rem;
        }

        ul {
            padding-left: 1.1rem;
            color: var(--muted);
        }

        code {
            font-family: Consolas, monospace;
            color: var(--accent);
        }
    </style>
</head>
<body>
    <main class="shell">
        <section class="card">
            <span class="eyebrow">Central App</span>
            <h1>Nimvo Central</h1>
            <p>
                Este domínio central administra os clientes, o vínculo com o <code>tenant_id</code>
                e o provisionamento dos bancos isolados do sistema.
            </p>

            <div class="grid">
                <article class="panel">
                    <strong>Banco central</strong>
                    <p>{{ $centralDatabase }}</p>
                </article>

                <article class="panel">
                    <strong>Domínios centrais</strong>
                    <ul>
                        @foreach ($centralDomains as $domain)
                            <li>{{ $domain }}</li>
                        @endforeach
                    </ul>
                </article>

                <article class="panel">
                    <strong>Fluxo esperado</strong>
                    <ul>
                        <li>Central salva o cliente e o <code>tenant_id</code>.</li>
                        <li>Cada tenant recebe um domínio e banco próprios.</li>
                        <li>Login, sessão e dados operacionais ficam isolados por tenant.</li>
                    </ul>
                </article>
            </div>
        </section>
    </main>
</body>
</html>

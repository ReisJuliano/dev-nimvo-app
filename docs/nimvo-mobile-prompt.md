# NIMVO MOBILE — App Flutter de Dashboard para Proprietários/Gerentes

## Contexto do projeto
O Nimvo é um sistema SaaS POS (Point of Sale) em Laravel 11 + React + Inertia.js com
multitenancy por domínio (pacote stancl/tenancy). Cada tenant tem seu próprio subdomínio
(ex: loja.nimvo.com.br). O sistema já possui usuários com campo `role` e senha em bcrypt.

Preciso criar um app mobile em Flutter que funcione como painel gerencial (estilo
"eDirector") para proprietários e gerentes de loja acessarem métricas e relatórios do
dia a dia, de forma bonita, fluída e moderna.

---

## PARTE 1 — Backend Laravel (preparar API para o app)

### 1.1 Instalar e configurar Laravel Sanctum para o tenant

```bash
composer require laravel/sanctum
```

- Publicar migrations do Sanctum
- A migration de `personal_access_tokens` deve rodar no banco do **tenant** (não central),
  pois cada loja tem seu próprio banco. Usar o provider de tenancy para garantir isso.
- No model `App\Models\Tenant\User`, adicionar o trait `HasApiTokens` do Sanctum.
- Garantir que o guard `sanctum` funcione no contexto do tenant.

### 1.2 Criar grupo de rotas API para o app mobile

Em `routes/tenant.php`, adicionar grupo protegido por Sanctum:

```php
Route::prefix('mobile-api/v1')->group(function () {

    // Rota pública — login
    Route::post('/auth/login', [MobileAuthController::class, 'login']);

    // Rotas protegidas por token Sanctum
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [MobileAuthController::class, 'logout']);
        Route::get('/auth/me', [MobileAuthController::class, 'me']);

        Route::get('/dashboard', [MobileDashboardController::class, 'index']);
        Route::get('/sales', [MobileSalesController::class, 'index']);         // listagem com filtros
        Route::get('/sales/by-seller', [MobileSalesController::class, 'bySeller']);
        Route::get('/reports/cmv', [MobileReportsController::class, 'cmv']);
        Route::get('/reports/period', [MobileReportsController::class, 'period']);
        Route::get('/reports/top-products', [MobileReportsController::class, 'topProducts']);
        Route::get('/reports/payment-methods', [MobileReportsController::class, 'paymentMethods']);
        Route::get('/stock/alerts', [MobileStockController::class, 'alerts']);
        Route::get('/cash-register/status', [MobileCashRegisterController::class, 'status']);
    });
});
```

### 1.3 Criar MobileAuthController

`app/Http/Controllers/Tenant/Mobile/MobileAuthController.php`

- `login`: recebe `username` + `password` + `device_name`
  - Busca usuário ativo no tenant (`where('active', true)`)
  - Verifica senha com `Hash::check`
  - Só permite login se `role` for `admin`, `manager` ou `owner` (bloquear operadores comuns)
  - Retorna JSON: `{ token, user: { id, name, role, is_supervisor } }`
- `logout`: revoga token atual (`$request->user()->currentAccessToken()->delete()`)
- `me`: retorna dados do usuário autenticado + info da loja (nome do tenant)

### 1.4 Criar MobileDashboardController

`app/Http/Controllers/Tenant/Mobile/MobileDashboardController.php`

Reutilizar lógica do `DashboardService` existente e adicionar:

Retornar JSON com:
```json
{
  "summary": {
    "today_sales_total": 0.0,
    "today_sales_qty": 0,
    "today_profit": 0.0,
    "today_growth": 0.0,
    "month_sales_total": 0.0,
    "month_sales_qty": 0,
    "month_profit": 0.0,
    "month_growth": 0.0,
    "average_ticket": 0.0,
    "profit_margin": 0.0,
    "low_stock_count": 0,
    "inventory_health": 0.0
  },
  "sales_trend": [],
  "hourly_sales": [],
  "top_products": [],
  "payment_breakdown": [],
  "recent_sales": [],
  "by_seller": []
}
```

- `sales_trend`: 7 últimos dias — `{ date, label, total, profit, qty }`
- `hourly_sales`: vendas por hora do dia de hoje
- `top_products`: top 5 produtos (7 dias) — `{ name, qty_sold, total_sold }`
- `payment_breakdown`: por método de pagamento (mês) — `{ method, label, qty, total }`
- `recent_sales`: últimas 6 vendas — `{ id, sale_number, customer_name, user_name, total, created_at }`
- `by_seller`: vendas por vendedor (hoje + mês) — `{ user_name, qty, total, profit }`

### 1.5 Criar MobileSalesController

Listagem de vendas com filtros por query string:
- `?from=2024-01-01&to=2024-01-31` — filtro de período
- `?seller_id=X` — filtro por vendedor
- `?payment_method=pix` — filtro por método
- Paginação: `?page=1&per_page=20`
- Retornar: `{ data: [...], meta: { total, per_page, current_page } }`

Endpoint `by-seller`:
- Agrupa vendas por `user_id` no período (padrão: mês atual)
- Retorna: `{ seller_id, seller_name, qty, total, profit, average_ticket }`

### 1.6 Criar MobileReportsController

- `cmv`: Custo da Mercadoria Vendida — período configurável
  - Retornar: `{ period: { from, to }, revenue, cost, gross_profit, cmv_percentage, margin_percentage }`
  - Também por semana dos últimos 8 semanas para gráfico de tendência
- `period`: resumo de qualquer período customizado (from/to)
- `top-products`: top produtos por período, com qty e receita
- `payment-methods`: breakdown por método no período

### 1.7 Criar MobileStockController

- `alerts`: produtos com estoque ≤ min_stock
  - Retornar: `{ id, name, stock_quantity, min_stock, unit, alert_level: "critical"|"warning" }`
  - `critical` = estoque zerado ou negativo, `warning` = abaixo do mínimo

### 1.8 Criar MobileCashRegisterController

- `status`: caixas abertos agora
  - Retornar: `{ open_registers: [{ id, name, opened_at, opened_by, opening_balance }] }`

---

## PARTE 2 — App Flutter

### 2.1 Setup do projeto

```bash
flutter create nimvo_app --org br.com.nimvo --platforms android,ios
```

Dependências (`pubspec.yaml`):
```yaml
dependencies:
  flutter:
    sdk: flutter
  # HTTP & estado
  dio: ^5.4.0
  flutter_riverpod: ^2.5.0
  # Armazenamento seguro do token
  flutter_secure_storage: ^9.0.0
  # Gráficos
  fl_chart: ^0.68.0
  # UI
  google_fonts: ^6.2.1
  shimmer: ^3.0.0
  intl: ^0.19.0
  # Navegação
  go_router: ^13.0.0
  # Ícones extras
  hugeicons: ^0.0.7
```

### 2.2 Arquitetura

Usar arquitetura em camadas simples:

```
lib/
  core/
    api/          # DioClient, interceptors de token
    storage/      # SecureStorage wrapper
    theme/        # AppTheme, cores, tipografia
    utils/        # formatadores de moeda, data
  features/
    auth/
      data/       # AuthRepository, AuthService
      providers/  # authProvider (Riverpod)
      screens/    # LoginScreen
    dashboard/
      data/       # DashboardRepository
      providers/  # dashboardProvider
      screens/    # DashboardScreen
      widgets/    # KpiCard, SalesTrendChart, etc.
    sales/
      ...
    reports/
      ...
    stock/
      ...
  shared/
    widgets/      # AppBar customizada, LoadingWidget, ErrorWidget
  main.dart
  router.dart
```

### 2.3 Design System

Paleta de cores (dark-friendly, moderna):

| Token | Hex | Uso |
|---|---|---|
| Primary | `#6C63FF` | Roxo vibrante — identidade Nimvo |
| Background | `#0F0F14` | Dark profundo |
| Surface | `#1A1A24` | Superfícies secundárias |
| Card | `#22223A` | Cards e painéis |
| Success | `#10D9A0` | Crescimento, positivo |
| Warning | `#F5A623` | Alertas de atenção |
| Danger | `#FF4D6A` | Crítico, queda |
| Text Primary | `#FFFFFF` | Texto principal |
| Text Secondary | `#8A8AA8` | Labels e subtítulos |

Tipografia: Google Fonts — `Inter` para dados numéricos, `Plus Jakarta Sans` para títulos

Estilo visual:
- Cards com bordas arredondadas (16px) e sombra sutil
- Gradientes suaves nos cards de KPI principais
- Animações de entrada com `AnimationController` (fade + slide up)
- Números com contador animado ao carregar
- Pull-to-refresh em todas as telas
- Skeleton loading (shimmer) enquanto carrega dados

### 2.4 Tela de Login

- Campo: URL da loja (subdomínio, ex: `minha-loja`) — salvar no `SecureStorage` para não precisar redigitar
- Campo: usuário
- Campo: senha (com toggle mostrar/ocultar)
- Botão "Entrar" com loading state
- Validação local antes de chamar a API
- Em caso de erro, mostrar mensagem descritiva (usuário inativo, sem permissão, senha errada)
- Salvar token no `SecureStorage` após login bem-sucedido
- Auto-login se token válido já existir

### 2.5 Tela principal — Dashboard

Layout: `CustomScrollView` com `SliverAppBar` + seções

**Seção 1 — Header**
- Saudação dinâmica: "Bom dia, João 👋" (baseado no horário)
- Nome da loja
- Ícone de notificação (futuro) + avatar com inicial do usuário

**Seção 2 — Cards KPI principais** (scroll horizontal)
- Venda de Hoje (R$ + variação % vs ontem com seta colorida)
- Lucro de Hoje
- Venda do Mês (R$ + variação % vs mês anterior)
- Lucro do Mês
- Ticket Médio
- Margem de Lucro (%)

Cada card: gradiente sutil, número com animação counter, badge de variação (verde/vermelho)

**Seção 3 — Gráfico de Tendência (7 dias)**
- `LineChart` do fl_chart
- Linha de receita + linha de lucro
- Tooltips ao tocar
- Selector: Receita | Lucro | Qtd vendas

**Seção 4 — Vendas por hora (hoje)**
- `BarChart` horizontal compacto
- Mostra pico de venda do dia

**Seção 5 — Top 5 Produtos (semana)**
- Lista com barra de progresso proporcional
- Nome + quantidade + valor

**Seção 6 — Formas de Pagamento (mês)**
- `PieChart` / `DonutChart` com legenda
- Pix, Dinheiro, Crédito, Débito, etc.

**Seção 7 — Últimas Vendas**
- Lista compacta: número da venda, cliente, vendedor, valor, horário
- Tap para ver detalhes (modal bottom sheet)

**Seção 8 — Alertas de Estoque**
- Badge vermelho se tiver itens críticos
- Lista com chip colorido: CRÍTICO / ATENÇÃO

### 2.6 Tela de Vendas

- Filtros: período (date picker range), vendedor, forma de pagamento
- Lista paginada de vendas
- Card por venda: número, cliente, valor, método, vendedor, data/hora
- Total do período no topo (sticky)
- Chip rápido: Hoje | Semana | Mês

### 2.7 Tela de Vendas por Vendedor

- Cards ranqueados (1º, 2º, 3º com destaque visual tipo pódio)
- Por vendedor: nome, qtd vendas, receita total, lucro, ticket médio
- Período selecionável: Hoje | Semana | Mês | Personalizado
- `BarChart` comparativo entre vendedores

### 2.8 Tela de CMV e Margens

- Cards: Receita, Custo, Lucro Bruto
- Gauge circular de CMV% (quanto do faturamento é custo)
- Margem de lucro em %
- Gráfico de tendência semanal (8 semanas)
- Interpretação textual automática: "Sua margem está X% acima/abaixo da média do período"

### 2.9 Tela de Relatório por Período

- Date picker de intervalo
- Ao confirmar, carregar resumo:
  - Total vendido, Qtd vendas, Lucro, CMV%, Ticket médio
  - Gráfico diário do período
  - Top produtos do período
  - Breakdown por forma de pagamento

### 2.10 Tela de Estoque

- Lista de alertas ordenada por criticidade
- Chip: ZERADO | CRÍTICO | ATENÇÃO
- Nome, estoque atual, mínimo, unidade
- Contador de alertas no ícone da tab

### 2.11 Navegação

Bottom navigation bar com 5 tabs:

1. 🏠 Dashboard
2. 📊 Vendas
3. 📈 Relatórios (sub-menu: CMV, Período, Por vendedor)
4. 📦 Estoque
5. ⚙️ Configurações (logout, trocar loja, sobre)

### 2.12 Configurações / Perfil

- Nome e role do usuário logado
- Nome da loja
- Botão "Trocar de loja" (limpa token e subdomínio, volta ao login)
- Botão "Sair" (logout via API + limpa storage)
- Versão do app

### 2.13 Tratamento de erros e estados

- Sem internet: banner persistente + dados em cache (usar `dio_cache_interceptor`)
- Token expirado (401): logout automático + redirect para login
- Erro de servidor (500): tela de erro com botão "Tentar novamente"
- Dados vazios: empty states com ilustração e texto descritivo

### 2.14 Detalhes de implementação

**DioClient** (`lib/core/api/dio_client.dart`):
- `baseUrl` dinâmico: `https://{subdomain}.nimvo.com.br/mobile-api/v1`
  - Para debug local: `http://10.0.2.2:8000/mobile-api/v1`
- Interceptor que injeta `Authorization: Bearer {token}` em todas as requisições
- Interceptor que captura 401 e dispara logout automático
- Timeout: connect 10s, receive 30s

**Formatadores** (`lib/core/utils/`):
- `formatCurrency(double value)` → "R$ 1.250,00" (locale pt-BR)
- `formatPercent(double value)` → "+12,5%" ou "-3,2%" com sinal
- `formatDate(DateTime dt)` → "13/06/2026"
- `formatHour(String hour)` → "09h"

**Providers Riverpod** (AsyncNotifier):
- `dashboardProvider` — busca e cacheia dados do dashboard
- `salesProvider` — lista de vendas com filtros
- `sellerSalesProvider` — vendas por vendedor
- `cmvProvider` — dados de CMV
- `stockAlertsProvider` — alertas de estoque

---

## PARTE 3 — Considerações finais

- O tenant é identificado pelo subdomínio na URL base do Dio — o backend já roteia por domínio via stancl/tenancy
- Não há necessidade de enviar `tenant_id` nos headers, o domínio já resolve
- Roles permitidos no app mobile: `admin`, `manager`, `owner` — operadores de caixa não acessam
- O token Sanctum deve ter nome `nimvo-mobile-{device_name}` para identificação fácil
- Criar FormRequest `MobileLoginRequest` com validação de `username`, `password`, `device_name`
- Todos os controllers mobile ficam em `app/Http/Controllers/Tenant/Mobile/`
- Todos os endpoints retornam JSON com estrutura `{ data: ..., message: ... }` ou erro `{ message: ..., errors: ... }`
- Adicionar middleware de rate limit na rota de login: `throttle:10,1` (10 tentativas por minuto)

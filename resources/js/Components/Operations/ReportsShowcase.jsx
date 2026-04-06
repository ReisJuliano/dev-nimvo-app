import { useState } from 'react'
import DataTable from '@/Components/Operations/DataTable'
import InfoPanels from '@/Components/Operations/InfoPanels'
import MetricGrid from '@/Components/Operations/MetricGrid'

const REPORT_PREVIEWS = [
    {
        key: 'sales',
        label: 'Vendas',
        icon: 'fa-chart-line',
        kicker: 'Receita',
        title: 'Relatorio de vendas por periodo',
        description: 'Visao pronta para acompanhar faturamento, ticket medio, operadores e variacao diaria em uma unica tela.',
        badges: ['Periodo flexivel', 'Operador', 'Pagamento'],
        guides: [
            { icon: 'fa-filter', label: 'Filtros', value: 'Periodo, vendedor, pagamento' },
            { icon: 'fa-layer-group', label: 'Agrupamento', value: 'Dia, semana e mes' },
            { icon: 'fa-table-list', label: 'Saida', value: 'Cards, tendencia e tabela' },
        ],
        metrics: [
            { label: 'Vendas', value: 284, caption: 'Pedidos finalizados no recorte' },
            { label: 'Faturamento', value: 128430.9, format: 'money', caption: 'Receita total do periodo' },
            { label: 'Ticket medio', value: 452.22, format: 'money', caption: 'Media por venda' },
            { label: 'Margem', value: 23.8, format: 'percent', caption: 'Margem consolidada' },
        ],
        panels: [
            {
                title: 'Pagamentos',
                items: [
                    { label: 'Cartao', meta: '162 transacoes', value: 'R$ 68.400,00' },
                    { label: 'Pix', meta: '74 transacoes', value: 'R$ 34.820,00' },
                    { label: 'Dinheiro', meta: '48 transacoes', value: 'R$ 25.210,90' },
                ],
            },
        ],
        tables: [
            {
                title: 'Resumo diario',
                columns: [
                    { key: 'day', label: 'Dia', format: 'date' },
                    { key: 'orders', label: 'Vendas', format: 'number' },
                    { key: 'gross', label: 'Faturamento', format: 'money' },
                    { key: 'profit', label: 'Lucro', format: 'money' },
                ],
                rows: [
                    { day: '2026-04-01', orders: 36, gross: 16820.45, profit: 3910.2 },
                    { day: '2026-04-02', orders: 42, gross: 19410.1, profit: 4522.8 },
                    { day: '2026-04-03', orders: 31, gross: 15134.35, profit: 3488.12 },
                    { day: '2026-04-04', orders: 55, gross: 24980.9, profit: 6120.44 },
                ],
                emptyText: 'Sem linhas para exibir.',
            },
        ],
    },
    {
        key: 'products',
        label: 'Produtos',
        icon: 'fa-boxes-stacked',
        kicker: 'Mix',
        title: 'Relatorio de produtos com giro e margem',
        description: 'Modelo pensado para ranking de itens, participacao na receita e leitura rapida de margem por SKU.',
        badges: ['Top itens', 'Margem', 'Categoria'],
        guides: [
            { icon: 'fa-box-open', label: 'Corte', value: 'Categoria, marca e SKU' },
            { icon: 'fa-arrow-trend-up', label: 'Leitura', value: 'Giro, receita e lucro' },
            { icon: 'fa-chart-pie', label: 'Comparacao', value: 'Curva ABC e mix' },
        ],
        metrics: [
            { label: 'SKUs com giro', value: 112, caption: 'Itens com venda no periodo' },
            { label: 'Qtd. vendida', value: 3488, caption: 'Volume consolidado' },
            { label: 'Receita', value: 97840.55, format: 'money', caption: 'Receita dos itens vendidos' },
            { label: 'Margem media', value: 29.4, format: 'percent', caption: 'Margem do mix' },
        ],
        panels: [
            {
                title: 'Categorias em destaque',
                items: [
                    { label: 'Bebidas', meta: '32 SKUs ativos', value: 'R$ 28.920,00' },
                    { label: 'Mercearia', meta: '41 SKUs ativos', value: 'R$ 24.110,00' },
                    { label: 'Padaria', meta: '18 SKUs ativos', value: 'R$ 17.880,00' },
                ],
            },
        ],
        tables: [
            {
                title: 'Ranking de produtos',
                columns: [
                    { key: 'sku', label: 'SKU' },
                    { key: 'name', label: 'Produto' },
                    { key: 'quantity', label: 'Qtd.', format: 'number' },
                    { key: 'revenue', label: 'Receita', format: 'money' },
                    { key: 'margin', label: 'Margem' },
                ],
                rows: [
                    { sku: '7891001', name: 'Cafe Especial 500g', quantity: 188, revenue: 6204.2, margin: '32,4%' },
                    { sku: '7891002', name: 'Biscoito Integral', quantity: 174, revenue: 4312.8, margin: '28,1%' },
                    { sku: '7891003', name: 'Suco Uva 1L', quantity: 168, revenue: 3890.4, margin: '26,7%' },
                    { sku: '7891004', name: 'Queijo Minas 300g', quantity: 132, revenue: 5844.0, margin: '21,9%' },
                ],
                emptyText: 'Sem linhas para exibir.',
            },
        ],
    },
    {
        key: 'stock',
        label: 'Estoque',
        icon: 'fa-warehouse',
        kicker: 'Posicao',
        title: 'Relatorio de estoque com posicao e giro',
        description: 'Mockup focado em saldo atual, cobertura, ruptura e itens que precisam de reposicao imediata.',
        badges: ['Saldo atual', 'Cobertura', 'Reposicao'],
        guides: [
            { icon: 'fa-boxes-packing', label: 'Base', value: 'Saldo, minimo e maximo' },
            { icon: 'fa-rotate', label: 'Giro', value: 'Cobertura por dias e saida media' },
            { icon: 'fa-triangle-exclamation', label: 'Alertas', value: 'Ruptura e excesso' },
        ],
        metrics: [
            { label: 'Itens ativos', value: 1632, caption: 'Cadastros com saldo acompanhando' },
            { label: 'Valor estocado', value: 218430.75, format: 'money', caption: 'Custo total em estoque' },
            { label: 'Cobertura media', value: 38, caption: 'Dias de estoque disponivel' },
            { label: 'Rupturas', value: 14, caption: 'Itens abaixo do minimo' },
        ],
        panels: [
            {
                title: 'Alertas do estoque',
                items: [
                    { label: 'Ruptura critica', meta: '4 itens sem saldo', value: 'Prioridade alta' },
                    { label: 'Abaixo do minimo', meta: '10 itens com reposicao pendente', value: 'Acao em 24h' },
                    { label: 'Excesso', meta: '7 itens acima da cobertura ideal', value: 'Reduzir compra' },
                ],
            },
        ],
        tables: [
            {
                title: 'Posicao atual',
                columns: [
                    { key: 'code', label: 'Codigo' },
                    { key: 'name', label: 'Produto' },
                    { key: 'balance', label: 'Saldo', format: 'number' },
                    { key: 'coverage', label: 'Cobertura' },
                    { key: 'status', label: 'Status' },
                ],
                rows: [
                    { code: 'EST-015', name: 'Arroz 5kg', balance: 42, coverage: '21 dias', status: 'Saudavel' },
                    { code: 'EST-043', name: 'Leite Integral 1L', balance: 8, coverage: '3 dias', status: 'Reposicao' },
                    { code: 'EST-088', name: 'Acucar Refinado 1kg', balance: 0, coverage: '0 dias', status: 'Ruptura' },
                    { code: 'EST-101', name: 'Detergente 500ml', balance: 64, coverage: '52 dias', status: 'Excesso' },
                ],
                emptyText: 'Sem linhas para exibir.',
            },
        ],
    },
    {
        key: 'cashflow',
        label: 'Fluxo',
        icon: 'fa-arrow-right-arrow-left',
        kicker: 'Financeiro',
        title: 'Relatorio de fluxo de caixa',
        description: 'Tela pensada para cruzar entradas, saidas, saldo acumulado e origem dos lancamentos financeiros.',
        badges: ['Entradas', 'Saidas', 'Saldo'],
        guides: [
            { icon: 'fa-calendar-days', label: 'Recorte', value: 'Dia, semana e mes' },
            { icon: 'fa-money-bill-transfer', label: 'Movimento', value: 'Entradas e despesas' },
            { icon: 'fa-chart-area', label: 'Saida', value: 'Linha diaria e consolidado' },
        ],
        metrics: [
            { label: 'Entradas', value: 145220.35, format: 'money', caption: 'Recebimentos do periodo' },
            { label: 'Saidas', value: 92410.6, format: 'money', caption: 'Despesas e retiradas' },
            { label: 'Saldo', value: 52809.75, format: 'money', caption: 'Resultado liquido' },
            { label: 'Lancamentos', value: 192, caption: 'Movimentos contabilizados' },
        ],
        panels: [
            {
                title: 'Origem dos lancamentos',
                items: [
                    { label: 'Vendas', meta: 'Principal origem', value: 'R$ 121.400,00' },
                    { label: 'Despesas operacionais', meta: 'Custos fixos e variaveis', value: 'R$ 48.220,00' },
                    { label: 'Retiradas', meta: 'Saidas administrativas', value: 'R$ 12.840,00' },
                ],
            },
        ],
        tables: [
            {
                title: 'Fluxo diario',
                columns: [
                    { key: 'day', label: 'Dia', format: 'date' },
                    { key: 'incoming', label: 'Entradas', format: 'money' },
                    { key: 'outgoing', label: 'Saidas', format: 'money' },
                    { key: 'balance', label: 'Saldo', format: 'money' },
                ],
                rows: [
                    { day: '2026-04-01', incoming: 18420.4, outgoing: 9210.0, balance: 9210.4 },
                    { day: '2026-04-02', incoming: 22104.9, outgoing: 11860.3, balance: 10244.6 },
                    { day: '2026-04-03', incoming: 17482.2, outgoing: 13220.8, balance: 4261.4 },
                    { day: '2026-04-04', incoming: 28610.0, outgoing: 14580.1, balance: 14029.9 },
                ],
                emptyText: 'Sem linhas para exibir.',
            },
        ],
    },
    {
        key: 'receivables',
        label: 'Receber',
        icon: 'fa-credit-card',
        kicker: 'Carteira',
        title: 'Relatorio de contas a receber',
        description: 'Visual desenhado para carteira em aberto, atrasos, previsao de recebimento e prioridade de cobranca.',
        badges: ['A vencer', 'Atrasos', 'Carteira'],
        guides: [
            { icon: 'fa-clock', label: 'Faixas', value: 'Hoje, 7, 15 e 30 dias' },
            { icon: 'fa-file-invoice-dollar', label: 'Titulos', value: 'Aberto, parcial e vencido' },
            { icon: 'fa-bell', label: 'Acao', value: 'Cobranca por prioridade' },
        ],
        metrics: [
            { label: 'Titulos', value: 84, caption: 'Registros em aberto' },
            { label: 'A vencer', value: 34120.3, format: 'money', caption: 'Carteira dentro do prazo' },
            { label: 'Em atraso', value: 12884.55, format: 'money', caption: 'Titulos vencidos' },
            { label: 'Inadimplencia', value: 8.6, format: 'percent', caption: 'Percentual da carteira' },
        ],
        panels: [
            {
                title: 'Faixas de vencimento',
                items: [
                    { label: 'Hoje', meta: 'Vencimento imediato', value: 'R$ 4.320,00' },
                    { label: '7 dias', meta: 'Recebimento curto prazo', value: 'R$ 10.840,00' },
                    { label: '+30 dias', meta: 'Carteira longa', value: 'R$ 7.410,00' },
                ],
            },
        ],
        tables: [
            {
                title: 'Carteira em aberto',
                columns: [
                    { key: 'customer', label: 'Cliente' },
                    { key: 'document', label: 'Titulo' },
                    { key: 'due_date', label: 'Vencimento', format: 'date' },
                    { key: 'amount', label: 'Valor', format: 'money' },
                    { key: 'status', label: 'Status' },
                ],
                rows: [
                    { customer: 'Mercado Aurora', document: 'REC-1042', due_date: '2026-04-07', amount: 1820.0, status: 'A vencer' },
                    { customer: 'Padaria Central', document: 'REC-1038', due_date: '2026-04-02', amount: 940.5, status: 'Vencido' },
                    { customer: 'Loja Horizonte', document: 'REC-1029', due_date: '2026-03-28', amount: 2640.0, status: 'Em cobranca' },
                    { customer: 'Restaurante Sol', document: 'REC-1017', due_date: '2026-04-12', amount: 1210.8, status: 'A vencer' },
                ],
                emptyText: 'Sem linhas para exibir.',
            },
        ],
    },
    {
        key: 'customers',
        label: 'Clientes',
        icon: 'fa-users',
        kicker: 'Ranking',
        title: 'Relatorio de clientes e recorrencia',
        description: 'Preview voltado para ranking, recorrencia de compra, ticket medio e leitura rapida da base ativa.',
        badges: ['Ranking', 'Recorrencia', 'Segmentos'],
        guides: [
            { icon: 'fa-user-group', label: 'Base', value: 'Ativos, novos e recorrentes' },
            { icon: 'fa-ranking-star', label: 'Ranking', value: 'Receita por cliente' },
            { icon: 'fa-repeat', label: 'Leitura', value: 'Ticket, frequencia e limite' },
        ],
        metrics: [
            { label: 'Clientes ativos', value: 426, caption: 'Base com compras recentes' },
            { label: 'Recorrentes', value: 162, caption: 'Compraram mais de uma vez' },
            { label: 'Ticket medio', value: 289.7, format: 'money', caption: 'Media por cliente' },
            { label: 'Credito usado', value: 18220.0, format: 'money', caption: 'Saldo em aberto da base' },
        ],
        panels: [
            {
                title: 'Segmentos',
                items: [
                    { label: 'VIP', meta: 'Top 20 por receita', value: 'R$ 48.220,00' },
                    { label: 'Recorrentes', meta: 'Compra mensal ativa', value: '162 clientes' },
                    { label: 'Reativacao', meta: 'Sem compra ha 30 dias', value: '38 clientes' },
                ],
            },
        ],
        tables: [
            {
                title: 'Ranking de clientes',
                columns: [
                    { key: 'customer', label: 'Cliente' },
                    { key: 'orders', label: 'Pedidos', format: 'number' },
                    { key: 'revenue', label: 'Receita', format: 'money' },
                    { key: 'avg_ticket', label: 'Ticket', format: 'money' },
                    { key: 'segment', label: 'Segmento' },
                ],
                rows: [
                    { customer: 'Mercado Aurora', orders: 18, revenue: 12840.4, avg_ticket: 713.35, segment: 'VIP' },
                    { customer: 'Padaria Central', orders: 11, revenue: 6210.0, avg_ticket: 564.54, segment: 'Recorrente' },
                    { customer: 'Loja Horizonte', orders: 9, revenue: 4180.8, avg_ticket: 464.53, segment: 'Recorrente' },
                    { customer: 'Restaurante Sol', orders: 4, revenue: 1290.6, avg_ticket: 322.65, segment: 'Reativacao' },
                ],
                emptyText: 'Sem linhas para exibir.',
            },
        ],
    },
]

function ReportCategoryButton({ report, active, onClick }) {
    return (
        <button
            type="button"
            className={`operations-report-category ${active ? 'active' : ''}`}
            onClick={onClick}
        >
            <span className="operations-report-category-icon">
                <i className={`fa-solid ${report.icon}`} />
            </span>
            <span className="operations-report-category-copy">
                <small>{report.kicker}</small>
                <strong>{report.label}</strong>
            </span>
        </button>
    )
}

export default function ReportsShowcase() {
    const [activeReportKey, setActiveReportKey] = useState(REPORT_PREVIEWS[0].key)
    const currentReport = REPORT_PREVIEWS.find((report) => report.key === activeReportKey) || REPORT_PREVIEWS[0]

    return (
        <div className="operations-reports-showcase">
            <section className="operations-report-category-bar">
                {REPORT_PREVIEWS.map((report) => (
                    <ReportCategoryButton
                        key={report.key}
                        report={report}
                        active={report.key === currentReport.key}
                        onClick={() => setActiveReportKey(report.key)}
                    />
                ))}
            </section>

            <section className="operations-report-preview-hero">
                <div>
                    <span className="operations-section-kicker">Mockup ativo</span>
                    <h2>{currentReport.title}</h2>
                    <p>{currentReport.description}</p>
                </div>
                <div className="operations-report-preview-badges">
                    {currentReport.badges.map((badge) => (
                        <span key={badge} className="ui-badge">
                            {badge}
                        </span>
                    ))}
                </div>
            </section>

            <section className="operations-report-guide-grid">
                {currentReport.guides.map((guide) => (
                    <article key={`${currentReport.key}-${guide.label}`} className="operations-report-guide-card">
                        <span className="operations-report-guide-icon">
                            <i className={`fa-solid ${guide.icon}`} />
                        </span>
                        <div>
                            <small>{guide.label}</small>
                            <strong>{guide.value}</strong>
                        </div>
                    </article>
                ))}
            </section>

            <MetricGrid metrics={currentReport.metrics} />
            <InfoPanels panels={currentReport.panels} />

            <div className="operations-table-grid">
                {currentReport.tables.map((table) => (
                    <DataTable key={`${currentReport.key}-${table.title}`} table={table} />
                ))}
            </div>
        </div>
    )
}

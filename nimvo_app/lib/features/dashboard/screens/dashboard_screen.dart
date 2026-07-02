import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/nimvo_brand.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/kpi_card.dart';
import '../widgets/sales_line_chart.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(dashboardProvider);
    final auth = ref.watch(authControllerProvider).valueOrNull;

    return Scaffold(
      body: SafeArea(
        child: asyncScaffold(
          value: data,
          onRefresh: () => ref.refresh(dashboardProvider.future),
          builder: (dashboard) {
            final summary = dashboard['summary'] as Map<String, dynamic>? ?? {};
            final trend = dashboard['sales_trend'] as List<dynamic>? ?? [];
            final products = dashboard['top_products'] as List<dynamic>? ?? [];
            final recent = dashboard['recent_sales'] as List<dynamic>? ?? [];
            final stock = dashboard['stock_alerts'] as List<dynamic>? ?? [];
            final payment =
                dashboard['payment_breakdown'] as List<dynamic>? ?? [];
            final hourly = dashboard['hourly_sales'] as List<dynamic>? ?? [];

            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: _DashboardHeader(
                      greeting: _greeting(auth?.user?.name),
                      tenantName: auth?.tenant?.name ?? 'Nimvo',
                      userName: auth?.user?.name ?? 'N',
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid.count(
                    crossAxisCount:
                        MediaQuery.sizeOf(context).width >= 720 ? 4 : 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio:
                        MediaQuery.sizeOf(context).width >= 720 ? 2.2 : 1.72,
                    children: [
                      KpiCard(
                          title: 'Venda hoje',
                          value: _num(summary['today_sales_total']),
                          growth: _num(summary['today_growth']),
                          icon: Icons.today_outlined),
                      KpiCard(
                          title: 'Lucro hoje',
                          value: _num(summary['today_profit']),
                          icon: Icons.savings_outlined),
                      KpiCard(
                          title: 'Venda mes',
                          value: _num(summary['month_sales_total']),
                          growth: _num(summary['month_growth']),
                          icon: Icons.calendar_month_outlined),
                      KpiCard(
                          title: 'Ticket medio',
                          value: _num(summary['average_ticket']),
                          icon: Icons.receipt_long_outlined),
                      KpiCard(
                          title: 'Margem mes',
                          value: _num(summary['profit_margin']),
                          icon: Icons.percent_outlined,
                          isMoney: false,
                          suffix: '%'),
                      KpiCard(
                          title: 'Estoque saudavel',
                          value: _num(summary['inventory_health']),
                          icon: Icons.inventory_2_outlined,
                          isMoney: false,
                          suffix: '%'),
                    ],
                  ),
                ),
                _section(
                  context,
                  title: 'Sinais do movimento',
                  actionLabel: 'Ver avisos',
                  onAction: () => context.go('/notifications'),
                  child: _SignalsGrid(summary: summary),
                ),
                _section(
                  context,
                  title: 'Tendencia de vendas',
                  child: SalesLineChart(items: trend),
                ),
                _section(
                  context,
                  title: 'Top produtos',
                  child: _TopProductsList(products: products),
                ),
                _section(
                  context,
                  title: 'Hoje por horario',
                  child: _HourlySalesStrip(items: hourly),
                ),
                _section(
                  context,
                  title: 'Pagamentos do mes',
                  child: _PaymentSummary(items: payment),
                ),
                _section(
                  context,
                  title: 'Ultimas vendas',
                  child: _RecentSalesList(recent: recent),
                ),
                _section(
                  context,
                  title: 'Alertas de estoque',
                  actionLabel: 'Estoque',
                  onAction: () => context.go('/stock'),
                  child: _StockAlertsList(stock: stock),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            );
          },
        ),
      ),
    );
  }

  SliverToBoxAdapter _section(BuildContext context,
      {required String title,
      required Widget child,
      String? actionLabel,
      VoidCallback? onAction}) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    if (actionLabel != null && onAction != null)
                      TextButton(
                        onPressed: onAction,
                        child: Text(actionLabel),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _greeting(String? name) {
    final hour = DateTime.now().hour;
    final prefix =
        hour < 12 ? 'Bom dia' : (hour < 18 ? 'Boa tarde' : 'Boa noite');
    final firstName = (name ?? '').trim().split(' ').first;
    return firstName.isEmpty ? prefix : '$prefix, $firstName';
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader({
    required this.greeting,
    required this.tenantName,
    required this.userName,
  });

  final String greeting;
  final String tenantName;
  final String userName;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const NimvoLogo(size: 32),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greeting,
                style: Theme.of(context).textTheme.headlineSmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                tenantName,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.primary.withValues(alpha: 0.12),
          child: Text(
            userName.characters.first.toUpperCase(),
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}

class _SignalsGrid extends StatelessWidget {
  const _SignalsGrid({required this.summary});

  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final todayGrowth = _num(summary['today_growth']);
    final monthGrowth = _num(summary['month_growth']);
    final lowStock = _num(summary['low_stock_count']).toInt();
    final overdue = _num(summary['overdue_payables_count']).toInt();

    return GridView.count(
      crossAxisCount: MediaQuery.sizeOf(context).width >= 720 ? 4 : 2,
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: MediaQuery.sizeOf(context).width >= 720 ? 2.4 : 2.0,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _SignalTile(
          title: 'Hoje vs. ontem',
          value: formatPercent(todayGrowth),
          icon: todayGrowth >= 0
              ? Icons.trending_up_rounded
              : Icons.trending_down_rounded,
          color: todayGrowth >= 0 ? AppColors.success : AppColors.danger,
        ),
        _SignalTile(
          title: 'Mes vs. anterior',
          value: formatPercent(monthGrowth),
          icon: monthGrowth >= 0
              ? Icons.arrow_upward_rounded
              : Icons.arrow_downward_rounded,
          color: monthGrowth >= 0 ? AppColors.success : AppColors.danger,
        ),
        _SignalTile(
          title: 'Produtos no minimo',
          value: '$lowStock',
          icon: Icons.warning_amber_rounded,
          color: lowStock > 0 ? AppColors.warning : AppColors.success,
        ),
        _SignalTile(
          title: 'Contas vencidas',
          value: '$overdue',
          icon: Icons.event_busy_outlined,
          color: overdue > 0 ? AppColors.danger : AppColors.success,
        ),
      ],
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _SignalTile extends StatelessWidget {
  const _SignalTile({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TopProductsList extends StatelessWidget {
  const _TopProductsList({required this.products});

  final List<dynamic> products;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return const Text(
        'Nenhum produto vendido no periodo.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    final maxValue = products
        .map((item) => _num((item as Map<String, dynamic>)['total_sold']))
        .fold<num>(0, (max, value) => value > max ? value : max);

    return Column(
      children: products.take(5).map((item) {
        final product = item as Map<String, dynamic>;
        final total = _num(product['total_sold']);
        final percent = maxValue > 0 ? total / maxValue : 0.0;

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      product['name'] as String? ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    formatCurrency(total),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: percent.toDouble().clamp(0, 1),
                        minHeight: 6,
                        backgroundColor: AppColors.cardAlt,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${_num(product['qty_sold']).toStringAsFixed(0)} un.',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _HourlySalesStrip extends StatelessWidget {
  const _HourlySalesStrip({required this.items});

  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    final nonZero = items
        .map((item) => item as Map<String, dynamic>)
        .where((item) => _num(item['total']) > 0)
        .toList();
    final rows = nonZero.isEmpty
        ? items
            .map((item) => item as Map<String, dynamic>)
            .where((item) => ['09', '12', '15', '18'].contains(item['label']))
            .toList()
        : nonZero.take(8).toList();

    if (rows.isEmpty) {
      return const Text(
        'Sem vendas por horario hoje.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    final maxValue = rows
        .map((item) => _num(item['total']))
        .fold<num>(0, (max, value) => value > max ? value : max);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: rows.map((item) {
        final total = _num(item['total']);
        final height = maxValue > 0 ? 18 + (total / maxValue * 58) : 18;

        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Column(
              children: [
                Text(
                  formatCompactCurrency(total).replaceFirst('R\$ ', ''),
                  style: const TextStyle(fontSize: 10),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 5),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  height: height.toDouble(),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '${item['label']}h',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _PaymentSummary extends StatelessWidget {
  const _PaymentSummary({required this.items});

  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Text(
        'Nenhum pagamento no mes.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    final rows = items.take(4).map((item) => item as Map<String, dynamic>);
    final total = rows.fold<num>(0, (sum, item) => sum + _num(item['total']));

    return Column(
      children: rows.map((item) {
        final value = _num(item['total']);
        final percent = total > 0 ? value / total * 100 : 0;

        return Padding(
          padding: const EdgeInsets.only(bottom: 9),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  item['label'] as String? ?? item['method'] as String? ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${percent.toStringAsFixed(0)}%',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 92,
                child: Text(
                  formatCurrency(value),
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _RecentSalesList extends StatelessWidget {
  const _RecentSalesList({required this.recent});

  final List<dynamic> recent;

  @override
  Widget build(BuildContext context) {
    if (recent.isEmpty) {
      return const Text(
        'Nenhuma venda recente.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    return Column(
      children: recent.take(5).map((item) {
        final sale = item as Map<String, dynamic>;
        return ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          minLeadingWidth: 0,
          title: Text('#${sale['sale_number'] ?? sale['id']}'),
          subtitle: Text(
            '${sale['customer_name'] ?? 'Cliente'} - ${sale['user_name'] ?? 'Vendedor'}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: Text(
            formatCurrency(_num(sale['total'])),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        );
      }).toList(),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _StockAlertsList extends StatelessWidget {
  const _StockAlertsList({required this.stock});

  final List<dynamic> stock;

  @override
  Widget build(BuildContext context) {
    if (stock.isEmpty) {
      return const Text(
        'Nenhum alerta no momento.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    return Column(
      children: stock.take(5).map((item) {
        final product = item as Map<String, dynamic>;
        return ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.warning_amber, color: AppColors.warning),
          title: Text(product['name'] as String? ?? ''),
          subtitle: Text(
            'Atual ${_num(product['stock_quantity'])} / min ${_num(product['min_stock'])} ${product['unit'] ?? ''}',
          ),
        );
      }).toList(),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

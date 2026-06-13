import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
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

            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_greeting(auth?.user?.name), style: Theme.of(context).textTheme.headlineSmall),
                              const SizedBox(height: 4),
                              Text(auth?.tenant?.name ?? 'Nimvo', style: const TextStyle(color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                        CircleAvatar(
                          backgroundColor: AppColors.primary,
                          child: Text((auth?.user?.name ?? 'N').characters.first.toUpperCase()),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 150,
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      scrollDirection: Axis.horizontal,
                      children: [
                        KpiCard(title: 'Venda hoje', value: _num(summary['today_sales_total']), growth: _num(summary['today_growth']), icon: Icons.today),
                        const SizedBox(width: 12),
                        KpiCard(title: 'Lucro hoje', value: _num(summary['today_profit']), icon: Icons.savings_outlined),
                        const SizedBox(width: 12),
                        KpiCard(title: 'Venda mes', value: _num(summary['month_sales_total']), growth: _num(summary['month_growth']), icon: Icons.calendar_month),
                        const SizedBox(width: 12),
                        KpiCard(title: 'Ticket medio', value: _num(summary['average_ticket']), icon: Icons.receipt_long),
                        const SizedBox(width: 12),
                        KpiCard(title: 'Margem %', value: _num(summary['profit_margin']), icon: Icons.percent, isMoney: false),
                      ],
                    ),
                  ),
                ),
                _section(
                  context,
                  title: 'Tendencia de vendas',
                  child: SalesLineChart(items: trend),
                ),
                _section(
                  context,
                  title: 'Top produtos',
                  child: Column(
                    children: products.take(5).map((item) {
                      final product = item as Map<String, dynamic>;
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(product['name'] as String? ?? ''),
                        subtitle: Text('${_num(product['qty_sold']).toStringAsFixed(0)} un.'),
                        trailing: Text(formatCurrency(_num(product['total_sold']))),
                      );
                    }).toList(),
                  ),
                ),
                _section(
                  context,
                  title: 'Ultimas vendas',
                  child: Column(
                    children: recent.map((item) {
                      final sale = item as Map<String, dynamic>;
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('#${sale['sale_number'] ?? sale['id']}'),
                        subtitle: Text('${sale['customer_name'] ?? 'Cliente'} - ${sale['user_name'] ?? 'Vendedor'}'),
                        trailing: Text(formatCurrency(_num(sale['total']))),
                      );
                    }).toList(),
                  ),
                ),
                _section(
                  context,
                  title: 'Alertas de estoque',
                  child: stock.isEmpty
                      ? const Text('Nenhum alerta no momento.', style: TextStyle(color: AppColors.textSecondary))
                      : Column(
                          children: stock.map((item) {
                            final product = item as Map<String, dynamic>;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.warning_amber, color: AppColors.warning),
                              title: Text(product['name'] as String? ?? ''),
                              subtitle: Text('Atual ${_num(product['stock_quantity'])} / min ${_num(product['min_stock'])}'),
                            );
                          }).toList(),
                        ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            );
          },
        ),
      ),
    );
  }

  SliverToBoxAdapter _section(BuildContext context, {required String title, required Widget child}) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
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
    final prefix = hour < 12 ? 'Bom dia' : (hour < 18 ? 'Boa tarde' : 'Boa noite');
    final firstName = (name ?? '').trim().split(' ').first;
    return firstName.isEmpty ? prefix : '$prefix, $firstName';
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

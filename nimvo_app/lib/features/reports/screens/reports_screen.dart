import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/state_views.dart';
import '../providers/reports_provider.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cmv = ref.watch(cmvProvider);
    final period = ref.watch(periodReportProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Relatorios')),
      body: asyncScaffold(
        value: cmv,
        onRefresh: () async {
          ref.invalidate(cmvProvider);
          ref.invalidate(periodReportProvider);
        },
        builder: (cmvData) {
          final periodData = period.valueOrNull;
          final summary = periodData?['summary'] as Map<String, dynamic>? ?? {};
          final topProducts = periodData?['top_products'] as List<dynamic>? ?? [];

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(child: _metric(context, 'Receita', formatCurrency(_num(cmvData['revenue'])))),
                  const SizedBox(width: 12),
                  Expanded(child: _metric(context, 'Custo', formatCurrency(_num(cmvData['cost'])))),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _metric(context, 'Lucro bruto', formatCurrency(_num(cmvData['gross_profit'])))),
                  const SizedBox(width: 12),
                  Expanded(child: _metric(context, 'Margem', formatPercent(_num(cmvData['margin_percentage'])))),
                ],
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('CMV', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 18),
                      SizedBox(
                        height: 180,
                        child: PieChart(
                          PieChartData(
                            centerSpaceRadius: 52,
                            sectionsSpace: 4,
                            sections: [
                              PieChartSectionData(
                                value: _num(cmvData['cmv_percentage']).toDouble(),
                                title: 'CMV',
                                color: AppColors.warning,
                              ),
                              PieChartSectionData(
                                value: (100 - _num(cmvData['cmv_percentage'])).clamp(0, 100).toDouble(),
                                title: 'Margem',
                                color: AppColors.success,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Resumo do periodo', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              _metric(context, 'Ticket medio', formatCurrency(_num(summary['average_ticket']))),
              const SizedBox(height: 16),
              Text('Top produtos', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              ...topProducts.take(8).map((item) {
                final product = item as Map<String, dynamic>;
                return Card(
                  child: ListTile(
                    title: Text(product['name'] as String? ?? ''),
                    subtitle: Text('${_num(product['qty_sold']).toStringAsFixed(0)} un.'),
                    trailing: Text(formatCurrency(_num(product['revenue']))),
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }

  Widget _metric(BuildContext context, String label, String value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
          ],
        ),
      ),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/state_views.dart';
import '../providers/reports_provider.dart';

class PaymentMethodsTab extends ConsumerWidget {
  const PaymentMethodsTab({super.key});

  static const _palette = [
    AppColors.primary,
    AppColors.success,
    AppColors.warning,
    AppColors.info,
    AppColors.rose,
    AppColors.violet,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payload = ref.watch(paymentMethodsProvider);

    return asyncScaffold(
      value: payload,
      onRefresh: () async => ref.invalidate(paymentMethodsProvider),
      builder: (data) {
        final items = data['items'] as List<dynamic>? ?? [];
        if (items.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(24),
            children: const [
              SizedBox(height: 80),
              Center(child: Text('Nenhum pagamento no periodo')),
            ],
          );
        }

        final total = items.fold<double>(
            0, (sum, item) => sum + _num((item as Map)['total']));

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Formas de pagamento',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 18),
                    SizedBox(
                      height: 200,
                      child: PieChart(
                        PieChartData(
                          centerSpaceRadius: 48,
                          sectionsSpace: 3,
                          sections: [
                            for (var i = 0; i < items.length; i++)
                              PieChartSectionData(
                                value: _num((items[i] as Map)['total']),
                                title: total > 0
                                    ? '${(_num((items[i] as Map)['total']) / total * 100).toStringAsFixed(0)}%'
                                    : '0%',
                                color: _palette[i % _palette.length],
                                radius: 56,
                                titleStyle: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
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
            ...List.generate(items.length, (i) {
              final item = items[i] as Map<String, dynamic>;
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _palette[i % _palette.length],
                    radius: 8,
                  ),
                  title: Text(item['label'] as String? ?? item['method'] as String? ?? ''),
                  subtitle: Text('${item['qty']} pagamentos'),
                  trailing: Text(formatCurrency(_num(item['total']))),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  double _num(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}

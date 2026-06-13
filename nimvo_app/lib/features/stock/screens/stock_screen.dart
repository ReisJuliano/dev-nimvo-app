import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/stock_provider.dart';

class StockScreen extends ConsumerWidget {
  const StockScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(stockAlertsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Estoque')),
      body: asyncScaffold(
        value: alerts,
        onRefresh: () => ref.refresh(stockAlertsProvider.future),
        builder: (items) {
          if (items.isEmpty) {
            return const ListView(
              padding: EdgeInsets.all(24),
              children: [
                SizedBox(height: 120),
                Icon(Icons.check_circle_outline, color: AppColors.success, size: 48),
                SizedBox(height: 16),
                Center(child: Text('Nenhum alerta de estoque')),
              ],
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = items[index] as Map<String, dynamic>;
              final critical = item['alert_level'] == 'critical';

              return Card(
                child: ListTile(
                  leading: Icon(
                    critical ? Icons.error_outline : Icons.warning_amber_outlined,
                    color: critical ? AppColors.danger : AppColors.warning,
                  ),
                  title: Text(item['name'] as String? ?? ''),
                  subtitle: Text('Atual ${item['stock_quantity']} / minimo ${item['min_stock']} ${item['unit'] ?? ''}'),
                  trailing: Chip(
                    label: Text(critical ? 'CRITICO' : 'ATENCAO'),
                    backgroundColor: (critical ? AppColors.danger : AppColors.warning).withOpacity(0.16),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/date_range_bar.dart';
import '../../../shared/widgets/nimvo_brand.dart';
import '../../../shared/widgets/state_views.dart';
import '../providers/sales_provider.dart';

class SalesScreen extends ConsumerWidget {
  const SalesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(salesFilterProvider);
    final sales = ref.watch(salesProvider);
    final sellers = ref.watch(sellerSalesProvider);

    return Scaffold(
      appBar: AppBar(title: const NimvoTitle(label: 'Vendas')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: DateRangeBar(
              value: filter.range,
              onChanged: (range) => ref
                  .read(salesFilterProvider.notifier)
                  .update((state) => state.copyWith(range: range)),
            ),
          ),
          if (filter.sellerId != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: ActiveFilterChip(
                  label: 'Vendedor: ${filter.sellerName ?? filter.sellerId}',
                  onClear: () => ref
                      .read(salesFilterProvider.notifier)
                      .update((state) => state.copyWith(clearSeller: true)),
                ),
              ),
            ),
          Expanded(
            child: asyncScaffold(
              value: sales,
              onRefresh: () async {
                ref.invalidate(salesProvider);
                ref.invalidate(sellerSalesProvider);
              },
              builder: (payload) {
                final items = payload['data'] as List<dynamic>? ?? [];
                final sellerRows =
                    sellers.valueOrNull?['items'] as List<dynamic>? ?? [];
                final total = items.fold<num>(
                    0,
                    (sum, item) =>
                        sum + _num((item as Map<String, dynamic>)['total']));

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Icon(Icons.payments_outlined,
                                color: AppColors.success),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Total carregado',
                                      style: TextStyle(
                                          color: AppColors.textSecondary)),
                                  Text(formatCurrency(total),
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge),
                                ],
                              ),
                            ),
                            Text('${items.length} vendas'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text('Por vendedor',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    if (sellerRows.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text('Nenhuma venda no periodo',
                            style: TextStyle(color: AppColors.textSecondary)),
                      )
                    else
                      ...sellerRows.map((row) {
                        final seller = row as Map<String, dynamic>;
                        final sellerId = seller['seller_id'] as int?;
                        final sellerName =
                            seller['seller_name'] as String? ?? 'Vendedor';
                        final selected = filter.sellerId == sellerId;

                        return Card(
                          color: selected
                              ? AppColors.primary.withValues(alpha: 0.06)
                              : null,
                          child: ListTile(
                            leading: CircleAvatar(
                                child:
                                    Text('${sellerRows.indexOf(row) + 1}')),
                            title: Text(sellerName),
                            subtitle: Text(
                                '${seller['qty']} vendas - ticket ${formatCurrency(_num(seller['average_ticket']))}'),
                            trailing: Text(formatCurrency(_num(seller['total']))),
                            onTap: sellerId == null
                                ? null
                                : () => ref
                                    .read(salesFilterProvider.notifier)
                                    .update((state) => state.copyWith(
                                          sellerId: sellerId,
                                          sellerName: sellerName,
                                        )),
                          ),
                        );
                      }),
                    const SizedBox(height: 16),
                    Text('Ultimas vendas',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    if (items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(child: Text('Nenhuma venda no periodo')),
                      )
                    else
                      ...items.map((item) {
                        final sale = item as Map<String, dynamic>;
                        return Card(
                          child: ListTile(
                            title: Text('#${sale['sale_number'] ?? sale['id']}'),
                            subtitle: Text(
                                '${sale['customer_name'] ?? 'Cliente'} - ${sale['seller_name'] ?? 'Vendedor'}'),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(formatCurrency(_num(sale['total']))),
                                Text('${sale['payment_method'] ?? ''}',
                                    style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 12)),
                              ],
                            ),
                          ),
                        );
                      }),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

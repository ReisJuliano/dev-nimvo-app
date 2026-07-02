import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/date_range_bar.dart';
import '../../../shared/widgets/state_views.dart';
import '../providers/reports_provider.dart';

class ProductReportTab extends ConsumerStatefulWidget {
  const ProductReportTab({super.key});

  @override
  ConsumerState<ProductReportTab> createState() => _ProductReportTabState();
}

class _ProductReportTabState extends ConsumerState<ProductReportTab> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(selectedProductProvider);
    final report = ref.watch(productsReportProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _searchController,
            onChanged: (value) => setState(() => _query = value),
            decoration: InputDecoration(
              hintText: 'Buscar produto por nome ou codigo',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() {
                        _searchController.clear();
                        _query = '';
                      }),
                    ),
            ),
          ),
        ),
        if (_query.trim().length >= 2) _buildSearchResults(),
        if (selected != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: ActiveFilterChip(
                label: 'Produto: ${selected['name']}',
                onClear: () {
                  ref.read(selectedProductProvider.notifier).state = null;
                  _searchController.clear();
                  setState(() => _query = '');
                },
              ),
            ),
          ),
        Expanded(
          child: asyncScaffold(
            value: report,
            onRefresh: () async => ref.invalidate(productsReportProvider),
            builder: (data) {
              final items = data['items'] as List<dynamic>? ?? [];
              if (items.isEmpty) {
                return ListView(
                  padding: const EdgeInsets.all(24),
                  children: const [
                    SizedBox(height: 80),
                    Center(child: Text('Nenhum produto vendido no periodo')),
                  ],
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final product = items[index] as Map<String, dynamic>;
                  return Card(
                    child: ListTile(
                      leading: selected == null
                          ? CircleAvatar(child: Text('${index + 1}'))
                          : const Icon(Icons.inventory_2_outlined,
                              color: AppColors.primary),
                      title: Text(product['name'] as String? ?? ''),
                      subtitle: Text(
                          '${product['category_name'] ?? ''} - ${_num(product['qty_sold']).toStringAsFixed(0)} un.'),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(formatCurrency(_num(product['revenue']))),
                          Text(
                            'Margem ${_num(product['margin']).toStringAsFixed(0)}%',
                            style: const TextStyle(
                                color: AppColors.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSearchResults() {
    final results = ref.watch(productSearchProvider(_query));

    return results.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(16),
        child: LinearProgressIndicator(),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (items) {
        if (items.isEmpty) {
          return const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text('Nenhum produto encontrado',
                style: TextStyle(color: AppColors.textSecondary)),
          );
        }

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          constraints: const BoxConstraints(maxHeight: 220),
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: items.length,
            itemBuilder: (context, index) {
              final product = items[index] as Map<String, dynamic>;
              return ListTile(
                dense: true,
                title: Text(product['name'] as String? ?? ''),
                subtitle: Text(product['code'] as String? ?? ''),
                onTap: () {
                  ref.read(selectedProductProvider.notifier).state = product;
                  _searchController.clear();
                  setState(() => _query = '');
                },
              );
            },
          ),
        );
      },
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

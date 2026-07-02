import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import '../data/sales_repository.dart';

class SalesFilter {
  const SalesFilter({this.range, this.sellerId, this.sellerName});

  final DateTimeRange? range;
  final int? sellerId;
  final String? sellerName;

  SalesFilter copyWith({
    DateTimeRange? range,
    int? sellerId,
    String? sellerName,
    bool clearSeller = false,
  }) {
    return SalesFilter(
      range: range ?? this.range,
      sellerId: clearSeller ? null : (sellerId ?? this.sellerId),
      sellerName: clearSeller ? null : (sellerName ?? this.sellerName),
    );
  }

  String? get fromIso => range?.start.toIso8601String();
  String? get toIso => range?.end.toIso8601String();
}

final salesFilterProvider =
    StateProvider<SalesFilter>((ref) => const SalesFilter());

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepository(ref.watch(dioClientProvider));
});

final salesProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final filter = ref.watch(salesFilterProvider);
  return ref.watch(salesRepositoryProvider).list(
        from: filter.fromIso,
        to: filter.toIso,
        sellerId: filter.sellerId,
      );
});

final sellerSalesProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final filter = ref.watch(salesFilterProvider);
  return ref.watch(salesRepositoryProvider).bySeller(
        from: filter.fromIso,
        to: filter.toIso,
      );
});

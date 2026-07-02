import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import '../../sales/providers/sales_provider.dart' show salesRepositoryProvider;
import '../data/reports_repository.dart';

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref.watch(dioClientProvider));
});

/// Shared date range for every tab in the Relatorios screen. `null` keeps
/// the backend default (current month).
final reportsRangeProvider = StateProvider<DateTimeRange?>((ref) => null);

final cmvProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final range = ref.watch(reportsRangeProvider);
  return ref.watch(reportsRepositoryProvider).cmv(
        from: range?.start.toIso8601String(),
        to: range?.end.toIso8601String(),
      );
});

final periodReportProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final range = ref.watch(reportsRangeProvider);
  return ref.watch(reportsRepositoryProvider).period(
        from: range?.start.toIso8601String(),
        to: range?.end.toIso8601String(),
      );
});

final reportsBySellerProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final range = ref.watch(reportsRangeProvider);
  return ref.watch(salesRepositoryProvider).bySeller(
        from: range?.start.toIso8601String(),
        to: range?.end.toIso8601String(),
      );
});

final paymentMethodsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final range = ref.watch(reportsRangeProvider);
  return ref.watch(reportsRepositoryProvider).paymentMethods(
        from: range?.start.toIso8601String(),
        to: range?.end.toIso8601String(),
      );
});

/// Currently selected product for the "Por produto" tab drill-down.
/// `null` means "show the top-N ranking" instead of a single product.
final selectedProductProvider =
    StateProvider<Map<String, dynamic>?>((ref) => null);

final productsReportProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final range = ref.watch(reportsRangeProvider);
  final selected = ref.watch(selectedProductProvider);
  return ref.watch(reportsRepositoryProvider).products(
        from: range?.start.toIso8601String(),
        to: range?.end.toIso8601String(),
        productId: selected?['id'] as int?,
        limit: selected == null ? 15 : 1,
      );
});

final productSearchProvider =
    FutureProvider.family<List<dynamic>, String>((ref, query) async {
  if (query.trim().length < 2) {
    return [];
  }
  return ref.watch(reportsRepositoryProvider).searchProducts(query.trim());
});

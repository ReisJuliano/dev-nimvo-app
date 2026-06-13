import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import '../data/sales_repository.dart';

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepository(ref.watch(dioClientProvider));
});

final salesProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(salesRepositoryProvider).list();
});

final sellerSalesProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(salesRepositoryProvider).bySeller();
});

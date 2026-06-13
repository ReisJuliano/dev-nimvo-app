import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import 'stock_repository.dart';

final stockRepositoryProvider = Provider<StockRepository>((ref) {
  return StockRepository(ref.watch(dioClientProvider));
});

final stockAlertsProvider = FutureProvider<List<dynamic>>((ref) async {
  return ref.watch(stockRepositoryProvider).alerts();
});

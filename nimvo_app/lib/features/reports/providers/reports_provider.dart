import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import '../data/reports_repository.dart';

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref.watch(dioClientProvider));
});

final cmvProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(reportsRepositoryProvider).cmv();
});

final periodReportProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(reportsRepositoryProvider).period();
});

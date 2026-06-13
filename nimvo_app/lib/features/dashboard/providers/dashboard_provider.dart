import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import '../data/dashboard_repository.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(ref.watch(dioClientProvider));
});

final dashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(dashboardRepositoryProvider).fetch();
});

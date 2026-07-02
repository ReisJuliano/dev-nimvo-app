import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/app_update_repository.dart';

final appUpdateRepositoryProvider = Provider<AppUpdateRepository>((ref) {
  return AppUpdateRepository();
});

final appUpdateProvider = FutureProvider<AppUpdateInfo?>((ref) async {
  return ref.watch(appUpdateRepositoryProvider).checkForUpdate();
});

/// Lets the user dismiss the banner for the rest of the session without
/// disabling the check entirely on the next app launch.
final appUpdateDismissedProvider = StateProvider<bool>((ref) => false);

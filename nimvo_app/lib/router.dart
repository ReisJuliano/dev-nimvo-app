import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/dashboard/screens/dashboard_screen.dart';
import 'features/reports/screens/reports_screen.dart';
import 'features/sales/screens/sales_screen.dart';
import 'features/settings/screens/settings_screen.dart';
import 'features/stock/screens/stock_screen.dart';
import 'shared/widgets/main_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refreshListenable = RouterRefreshNotifier(ref);

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final auth = authState.valueOrNull;
      final loggingIn = state.matchedLocation == '/login';

      if (authState.isLoading || auth?.isLoading == true) {
        return null;
      }

      if (!auth.isAuthenticated && !loggingIn) {
        return '/login';
      }

      if (auth.isAuthenticated && loggingIn) {
        return '/dashboard';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) => const NoTransitionPage(child: DashboardScreen()),
          ),
          GoRoute(
            path: '/sales',
            pageBuilder: (context, state) => const NoTransitionPage(child: SalesScreen()),
          ),
          GoRoute(
            path: '/reports',
            pageBuilder: (context, state) => const NoTransitionPage(child: ReportsScreen()),
          ),
          GoRoute(
            path: '/stock',
            pageBuilder: (context, state) => const NoTransitionPage(child: StockScreen()),
          ),
          GoRoute(
            path: '/settings',
            pageBuilder: (context, state) => const NoTransitionPage(child: SettingsScreen()),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => const Scaffold(
      body: Center(child: Text('Tela nao encontrada')),
    ),
  );
});

class RouterRefreshNotifier extends ChangeNotifier {
  RouterRefreshNotifier(this.ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}

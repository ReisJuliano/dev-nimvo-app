import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../features/dashboard/providers/dashboard_provider.dart';
import 'update_banner.dart';

class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.path;
    final dashboard = ref.watch(dashboardProvider).valueOrNull;
    final summary = dashboard?['summary'] as Map<String, dynamic>? ?? {};
    final stock = dashboard?['stock_alerts'] as List<dynamic>? ?? [];
    final alertCount =
        stock.length + (_num(summary['overdue_payables_count']) > 0 ? 1 : 0);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const UpdateBanner(),
            Expanded(child: child),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        elevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        selectedIndex: _indexFor(location),
        onDestinationSelected: (index) => context.go(_paths[index]),
        destinations: [
          const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Resumo'),
          const NavigationDestination(
              icon: Icon(Icons.bar_chart_outlined),
              selectedIcon: Icon(Icons.bar_chart),
              label: 'Vendas'),
          const NavigationDestination(
              icon: Icon(Icons.trending_up_outlined),
              selectedIcon: Icon(Icons.trending_up),
              label: 'Relatorios'),
          const NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2),
              label: 'Estoque'),
          NavigationDestination(
              icon: _BadgeIcon(
                  count: alertCount,
                  child: const Icon(Icons.notifications_none)),
              selectedIcon: _BadgeIcon(
                  count: alertCount, child: const Icon(Icons.notifications)),
              label: 'Avisos'),
          const NavigationDestination(
              icon: Icon(Icons.settings_outlined),
              selectedIcon: Icon(Icons.settings),
              label: 'Ajustes'),
        ],
      ),
    );
  }

  int _indexFor(String location) {
    final index = _paths.indexWhere((path) => location.startsWith(path));
    return index < 0 ? 0 : index;
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _BadgeIcon extends StatelessWidget {
  const _BadgeIcon({required this.count, required this.child});

  final int count;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) {
      return child;
    }

    return Badge(
      backgroundColor: AppColors.rose,
      label: Text(count > 9 ? '9+' : '$count'),
      child: child,
    );
  }
}

const _paths = [
  '/dashboard',
  '/sales',
  '/reports',
  '/stock',
  '/notifications',
  '/settings',
];

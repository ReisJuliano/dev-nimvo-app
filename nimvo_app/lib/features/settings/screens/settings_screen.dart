import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider).valueOrNull;
    final user = auth?.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Configuracoes')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.primary,
                child: Text((user?.name ?? 'N').characters.first.toUpperCase()),
              ),
              title: Text(user?.name ?? 'Usuario'),
              subtitle: Text('${user?.role ?? ''} - ${auth?.tenant?.name ?? 'Nimvo'}'),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.storefront_outlined),
                  title: const Text('Trocar de loja'),
                  onTap: () async {
                    await ref.read(authControllerProvider.notifier).logout(clearStore: true);
                    if (context.mounted) {
                      context.go('/login');
                    }
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: const Text('Sair'),
                  onTap: () async {
                    await ref.read(authControllerProvider.notifier).logout();
                    if (context.mounted) {
                      context.go('/login');
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Center(
            child: Text('Nimvo Mobile 0.1.0', style: TextStyle(color: AppColors.textSecondary)),
          ),
        ],
      ),
    );
  }
}

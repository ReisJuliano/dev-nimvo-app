import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/nimvo_brand.dart';
import '../../../shared/widgets/state_views.dart';
import '../../dashboard/providers/dashboard_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(dashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const NimvoTitle(label: 'Avisos')),
      body: asyncScaffold(
        value: data,
        onRefresh: () => ref.refresh(dashboardProvider.future),
        builder: (dashboard) {
          final summary = dashboard['summary'] as Map<String, dynamic>? ?? {};
          final stock = dashboard['stock_alerts'] as List<dynamic>? ?? [];
          final cards = _buildCards(summary, stock);

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: cards.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) => cards[index],
          );
        },
      ),
    );
  }

  List<Widget> _buildCards(Map<String, dynamic> summary, List<dynamic> stock) {
    final todaySales = _num(summary['today_sales_total']);
    final todayGrowth = _num(summary['today_growth']);
    final lowStockCount = _num(summary['low_stock_count']).toInt();
    final overdueCount = _num(summary['overdue_payables_count']).toInt();
    final overdueTotal = _num(summary['overdue_payables_total']);

    final cards = <Widget>[
      _NoticeCard(
        icon: todayGrowth >= 0
            ? Icons.trending_up_rounded
            : Icons.trending_down_rounded,
        color: todayGrowth >= 0 ? AppColors.success : AppColors.danger,
        title: 'Venda do dia',
        body:
            '${formatCurrency(todaySales)} vendidos hoje, ${formatPercent(todayGrowth)} vs. ontem.',
        meta: '${_num(summary['today_sales_qty']).toInt()} vendas registradas',
      ),
    ];

    if (stock.isEmpty) {
      cards.add(const _NoticeCard(
        icon: Icons.check_circle_outline,
        color: AppColors.success,
        title: 'Estoque sem alerta',
        body: 'Nenhum produto abaixo do minimo no momento.',
        meta: 'Monitoramento atualizado pelo resumo',
      ));
    } else {
      cards.add(_NoticeCard(
        icon: Icons.warning_amber_rounded,
        color: AppColors.warning,
        title: 'Produtos faltando',
        body:
            '$lowStockCount produtos estao no minimo ou abaixo dele. Priorize reposicao dos itens mais vendidos.',
        meta: stock
            .take(3)
            .map((item) => (item as Map<String, dynamic>)['name'] ?? '')
            .where((name) => '$name'.isNotEmpty)
            .join(', '),
      ));
    }

    if (overdueCount > 0) {
      cards.add(_NoticeCard(
        icon: Icons.event_busy_outlined,
        color: AppColors.danger,
        title: 'Contas vencidas',
        body:
            '$overdueCount contas em atraso somam ${formatCurrency(overdueTotal)}.',
        meta: 'Impacta caixa e margem do periodo',
      ));
    }

    cards.add(_NoticeCard(
      icon: Icons.inventory_2_outlined,
      color: AppColors.info,
      title: 'Saude do estoque',
      body:
          '${_num(summary['inventory_health']).toStringAsFixed(0)}% dos produtos ativos estao acima do estoque minimo.',
      meta: '${_num(summary['total_products']).toInt()} produtos ativos',
    ));

    return cards;
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.body,
    required this.meta,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String body;
  final String meta;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 19),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(body, style: const TextStyle(fontSize: 13)),
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      meta,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

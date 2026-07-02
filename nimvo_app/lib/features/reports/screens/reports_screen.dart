import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/date_range_bar.dart';
import '../../../shared/widgets/nimvo_brand.dart';
import '../../../shared/widgets/state_views.dart';
import '../providers/reports_provider.dart';
import '../widgets/payment_methods_card.dart';
import 'product_report_screen.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(reportsRangeProvider);

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const NimvoTitle(label: 'Relatorios'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Periodo'),
              Tab(text: 'Por vendedor'),
              Tab(text: 'Por produto'),
              Tab(text: 'Pagamentos'),
            ],
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: DateRangeBar(
                value: range,
                onChanged: (value) =>
                    ref.read(reportsRangeProvider.notifier).state = value,
              ),
            ),
            const Expanded(
              child: TabBarView(
                children: [
                  _PeriodTab(),
                  _BySellerTab(),
                  ProductReportTab(),
                  PaymentMethodsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PeriodTab extends ConsumerWidget {
  const _PeriodTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cmv = ref.watch(cmvProvider);
    final period = ref.watch(periodReportProvider);

    return asyncScaffold(
      value: cmv,
      onRefresh: () async {
        ref.invalidate(cmvProvider);
        ref.invalidate(periodReportProvider);
      },
      builder: (cmvData) {
        final periodData = period.valueOrNull;
        final summary = periodData?['summary'] as Map<String, dynamic>? ?? {};
        final topProducts = periodData?['top_products'] as List<dynamic>? ?? [];
        final dailyTrend = periodData?['daily_trend'] as List<dynamic>? ?? [];

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            GridView.count(
              crossAxisCount: MediaQuery.sizeOf(context).width >= 720 ? 4 : 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.15,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _metric(context, 'Receita',
                    formatCurrency(_num(cmvData['revenue']))),
                _metric(context, 'CMV', formatCurrency(_num(cmvData['cost']))),
                _metric(context, 'Lucro bruto',
                    formatCurrency(_num(cmvData['gross_profit']))),
                _metric(context, 'Margem',
                    formatPercent(_num(cmvData['margin_percentage']))),
              ],
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CMV e margem',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(
                      'CMV ${formatPercent(_num(cmvData['cmv_percentage']))} do faturamento',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _CmvTrendChart(
                        items: cmvData['weekly_trend'] as List<dynamic>? ?? []),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Receita diaria',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    _DailyRevenueChart(items: dailyTrend),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _metric(context, 'Ticket medio',
                formatCurrency(_num(summary['average_ticket']))),
            const SizedBox(height: 16),
            Text('Top produtos', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ...topProducts.take(8).map((item) {
              final product = item as Map<String, dynamic>;
              return Card(
                child: ListTile(
                  dense: true,
                  title: Text(product['name'] as String? ?? ''),
                  subtitle: Text(
                      '${_num(product['qty_sold']).toStringAsFixed(0)} un.'),
                  trailing: Text(formatCurrency(_num(product['revenue']))),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  Widget _metric(BuildContext context, String label, String value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 6),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _CmvTrendChart extends StatelessWidget {
  const _CmvTrendChart({required this.items});

  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Text(
        'Sem dados de CMV para o periodo.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    final rows = items.map((item) => item as Map<String, dynamic>).toList();
    final maxValue = rows
        .map((item) => _num(item['revenue']))
        .fold<double>(0, (max, value) => value > max ? value : max);

    return Column(
      children: [
        SizedBox(
          height: 210,
          child: BarChart(
            BarChartData(
              maxY: maxValue <= 0 ? 100 : maxValue * 1.2,
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => const FlLine(
                  color: AppColors.border,
                  strokeWidth: 1,
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 44,
                    getTitlesWidget: (value, meta) => Text(
                      formatCompactCurrency(value).replaceFirst('R\$ ', ''),
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 32,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= rows.length) {
                        return const SizedBox.shrink();
                      }

                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          rows[index]['label'] as String? ?? '',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 9,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barGroups: List.generate(rows.length, (index) {
                final row = rows[index];
                return BarChartGroupData(
                  x: index,
                  barsSpace: 2,
                  barRods: [
                    BarChartRodData(
                      toY: _num(row['revenue']),
                      width: 8,
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    BarChartRodData(
                      toY: _num(row['cost']),
                      width: 8,
                      color: AppColors.warning,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    BarChartRodData(
                      toY: _num(row['gross_profit']),
                      width: 8,
                      color: AppColors.success,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ],
                );
              }),
            ),
          ),
        ),
        const SizedBox(height: 10),
        const Wrap(
          spacing: 12,
          runSpacing: 6,
          children: [
            _LegendDot(color: AppColors.primary, label: 'Receita'),
            _LegendDot(color: AppColors.warning, label: 'CMV'),
            _LegendDot(color: AppColors.success, label: 'Lucro'),
          ],
        ),
      ],
    );
  }

  double _num(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}

class _DailyRevenueChart extends StatefulWidget {
  const _DailyRevenueChart({required this.items});

  final List<dynamic> items;

  @override
  State<_DailyRevenueChart> createState() => _DailyRevenueChartState();
}

class _DailyRevenueChartState extends State<_DailyRevenueChart> {
  int? _selectedIndex;

  @override
  Widget build(BuildContext context) {
    final rows =
        widget.items.map((item) => item as Map<String, dynamic>).toList();
    if (rows.isEmpty) {
      return const Text(
        'Sem vendas no periodo.',
        style: TextStyle(color: AppColors.textSecondary),
      );
    }

    final spots = List.generate(
      rows.length,
      (index) => FlSpot(index.toDouble(), _num(rows[index]['total'])),
    );
    final maxValue = spots.fold<double>(
      0,
      (max, spot) => spot.y > max ? spot.y : max,
    );
    final chartMaxY = maxValue <= 0 ? 100.0 : maxValue * 1.18;
    final yInterval = chartMaxY / 2;
    final selectedIndex =
        (_selectedIndex ?? rows.length - 1).clamp(0, rows.length - 1).toInt();
    final lineBarData = LineChartBarData(
      spots: spots,
      isCurved: true,
      preventCurveOverShooting: true,
      color: AppColors.info,
      barWidth: 2.4,
      showingIndicators: [selectedIndex],
      belowBarData: BarAreaData(
        show: true,
        color: AppColors.info.withValues(alpha: 0.1),
      ),
      dotData: FlDotData(
        show: true,
        getDotPainter: (spot, percent, barData, index) => FlDotCirclePainter(
          radius: index == selectedIndex ? 4.5 : 2.3,
          color: AppColors.info,
          strokeWidth: 2,
          strokeColor: Colors.white,
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ChartSelectionPill(
          label: rows[selectedIndex]['label'] as String? ?? '',
          value:
              '${formatCurrency(spots[selectedIndex].y)} - ${rows[selectedIndex]['qty'] ?? 0} vendas',
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 190,
          child: Padding(
            padding: const EdgeInsets.only(right: 8),
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: chartMaxY,
                showingTooltipIndicators: const [],
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: yInterval,
                  getDrawingHorizontalLine: (_) => const FlLine(
                    color: AppColors.border,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(
                  show: true,
                  border: const Border(
                    left: BorderSide(color: AppColors.borderStrong),
                    bottom: BorderSide(color: AppColors.borderStrong),
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 56,
                      interval: yInterval,
                      getTitlesWidget: (value, meta) {
                        final isMainTick = (value - meta.min).abs() < 0.01 ||
                            (value - meta.max).abs() < 0.01 ||
                            (value - (meta.max / 2)).abs() < yInterval * 0.08;
                        if (!isMainTick) {
                          return const SizedBox.shrink();
                        }

                        return Text(
                          formatCompactCurrency(value).replaceFirst('R\$ ', ''),
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 9,
                          ),
                        );
                      },
                    ),
                  ),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: rows.length > 14 ? 3 : 1,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= rows.length) {
                          return const SizedBox.shrink();
                        }
                        final compact = MediaQuery.sizeOf(context).width < 390;
                        if (compact &&
                            rows.length > 8 &&
                            index != 0 &&
                            index != rows.length - 1 &&
                            index.isOdd) {
                          return const SizedBox.shrink();
                        }

                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            rows[index]['label'] as String? ?? '',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 9,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  handleBuiltInTouches: false,
                  touchCallback: (event, response) {
                    final touched = response?.lineBarSpots?.firstOrNull;
                    if (touched == null) {
                      return;
                    }

                    setState(() => _selectedIndex = touched.spotIndex);
                  },
                ),
                lineBarsData: [lineBarData],
              ),
            ),
          ),
        ),
      ],
    );
  }

  double _num(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}

class _ChartSelectionPill extends StatelessWidget {
  const _ChartSelectionPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.cardAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        '$label  $value',
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }
}

class _BySellerTab extends ConsumerWidget {
  const _BySellerTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sellers = ref.watch(reportsBySellerProvider);

    return asyncScaffold(
      value: sellers,
      onRefresh: () async => ref.invalidate(reportsBySellerProvider),
      builder: (data) {
        final rows = data['items'] as List<dynamic>? ?? [];
        if (rows.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(24),
            children: const [
              SizedBox(height: 80),
              Center(child: Text('Nenhuma venda no periodo')),
            ],
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: rows.length,
          itemBuilder: (context, index) {
            final seller = rows[index] as Map<String, dynamic>;
            return Card(
              child: ListTile(
                leading: CircleAvatar(child: Text('${index + 1}')),
                title: Text(seller['seller_name'] as String? ?? 'Vendedor'),
                subtitle: Text(
                    '${seller['qty']} vendas - ticket ${formatCurrency(_num(seller['average_ticket']))}'),
                trailing: Text(formatCurrency(_num(seller['total']))),
              ),
            );
          },
        );
      },
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

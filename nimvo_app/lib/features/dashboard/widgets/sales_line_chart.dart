import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';

class SalesLineChart extends StatefulWidget {
  const SalesLineChart({super.key, required this.items});

  final List<dynamic> items;

  @override
  State<SalesLineChart> createState() => _SalesLineChartState();
}

class _SalesLineChartState extends State<SalesLineChart> {
  int? _selectedIndex;

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    final labels = <String>[];
    final quantities = <int>[];
    for (var i = 0; i < widget.items.length; i++) {
      final item = widget.items[i] as Map<String, dynamic>;
      spots
          .add(FlSpot(i.toDouble(), ((item['total'] as num?) ?? 0).toDouble()));
      labels.add(item['label'] as String? ?? '');
      quantities.add(((item['qty'] as num?) ?? 0).toInt());
    }

    final values = spots.map((spot) => spot.y).toList();
    final maxValue =
        values.isEmpty ? 0.0 : values.reduce((a, b) => a > b ? a : b);
    final minValue =
        values.isEmpty ? 0.0 : values.reduce((a, b) => a < b ? a : b);
    final padding = maxValue > 0 ? maxValue * 0.16 : 100.0;
    final chartMaxY = maxValue + padding;
    final yInterval = chartMaxY <= 0 ? 100.0 : chartMaxY / 2;
    final last = values.isEmpty ? 0.0 : values.last;
    final total = values.fold<double>(0, (sum, value) => sum + value);
    final bestIndex = values.isEmpty
        ? 0
        : values.indexOf(values.reduce((a, b) => a > b ? a : b));
    final selectedIndex = spots.isEmpty
        ? null
        : (_selectedIndex ?? spots.length - 1).clamp(0, spots.length - 1);
    final selectedSpot =
        selectedIndex == null ? null : spots[selectedIndex.toInt()];
    final lineBarData = LineChartBarData(
      spots: spots,
      isCurved: true,
      preventCurveOverShooting: true,
      color: AppColors.primary,
      barWidth: 2.6,
      showingIndicators: selectedIndex == null ? [] : [selectedIndex.toInt()],
      belowBarData: BarAreaData(
        show: true,
        color: AppColors.primary.withValues(alpha: 0.1),
      ),
      dotData: FlDotData(
        show: true,
        getDotPainter: (spot, percent, barData, index) => FlDotCirclePainter(
          radius: index == selectedIndex ? 4.5 : 2.4,
          color: AppColors.primary,
          strokeWidth: 2,
          strokeColor: Colors.white,
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _MetricPill(label: 'Hoje', value: formatCurrency(last)),
            _MetricPill(label: '7 dias', value: formatCurrency(total)),
            _MetricPill(
              label: selectedIndex == null ? 'Pico' : labels[selectedIndex],
              value: selectedSpot == null
                  ? formatCurrency(0)
                  : '${formatCurrency(selectedSpot.y)} - ${quantities[selectedIndex!]} vendas',
            ),
            _MetricPill(
              label: 'Pico',
              value: labels.isEmpty
                  ? formatCurrency(0)
                  : '${labels[bestIndex]} ${formatCompactCurrency(values[bestIndex])}',
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 210,
          child: Padding(
            padding: const EdgeInsets.only(right: 8),
            child: LineChart(
              LineChartData(
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
                clipData: const FlClipData.all(),
                minX: 0,
                maxX: (spots.length - 1).clamp(0, 100).toDouble(),
                minY: (minValue - padding).clamp(0, double.infinity),
                maxY: chartMaxY,
                showingTooltipIndicators: const [],
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
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= labels.length) {
                          return const SizedBox.shrink();
                        }
                        final compact = MediaQuery.sizeOf(context).width < 380;
                        if (compact &&
                            index != 0 &&
                            index != labels.length - 1 &&
                            index.isOdd) {
                          return const SizedBox.shrink();
                        }

                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            labels[index],
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 10,
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
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.value});

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
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          children: [
            TextSpan(text: '$label  '),
            TextSpan(
              text: value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class SalesLineChart extends StatelessWidget {
  const SalesLineChart({super.key, required this.items});

  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (var i = 0; i < items.length; i++) {
      final item = items[i] as Map<String, dynamic>;
      spots
          .add(FlSpot(i.toDouble(), ((item['total'] as num?) ?? 0).toDouble()));
    }

    final values = spots.map((spot) => spot.y).toList();
    final maxValue = values.isEmpty
        ? 0.0
        : values.reduce((a, b) => a > b ? a : b);
    final minValue = values.isEmpty
        ? 0.0
        : values.reduce((a, b) => a < b ? a : b);
    // Curved lines can bulge past their neighbouring points; padding the
    // Y range (plus preventCurveOverShooting/clipData below) keeps the
    // line from spilling outside the chart's rounded card.
    final padding = maxValue > 0 ? maxValue * 0.18 : 1.0;

    return SizedBox(
      height: 220,
      child: Padding(
        padding: const EdgeInsets.only(top: 12, right: 8),
        child: LineChart(
          LineChartData(
            gridData: const FlGridData(show: false),
            borderData: FlBorderData(show: false),
            clipData: const FlClipData.all(),
            minY: (minValue - padding).clamp(0, double.infinity),
            maxY: maxValue + padding,
            titlesData: const FlTitlesData(
              leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles:
                  AxisTitles(sideTitles: SideTitles(showTitles: false)),
              topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles:
                  AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                preventCurveOverShooting: true,
                color: AppColors.primary,
                barWidth: 3,
                belowBarData: BarAreaData(
                  show: true,
                  color: AppColors.primary.withValues(alpha: 0.12),
                ),
                dotData: const FlDotData(show: false),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

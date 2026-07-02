import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';

class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.title,
    required this.value,
    this.growth,
    this.icon = Icons.insights,
    this.isMoney = true,
    this.suffix = '',
  });

  final String title;
  final num value;
  final num? growth;
  final IconData icon;
  final bool isMoney;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    final positive = (growth ?? 0) >= 0;
    final featured = growth != null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: featured
            ? AppColors.primary.withValues(alpha: 0.06)
            : AppColors.card,
        border: Border.all(
          color: featured
              ? AppColors.primary.withValues(alpha: 0.18)
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 18),
              const Spacer(),
              if (growth != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: (positive ? AppColors.success : AppColors.danger)
                        .withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        positive
                            ? Icons.trending_up_rounded
                            : Icons.trending_down_rounded,
                        size: 13,
                        color: positive ? AppColors.success : AppColors.danger,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        formatPercent(growth!),
                        style: TextStyle(
                          color:
                              positive ? AppColors.success : AppColors.danger,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const Spacer(),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style:
                const TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Text(
            isMoney
                ? formatCompactCurrency(value)
                : '${value.toStringAsFixed(1)}$suffix',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                ),
          ),
        ],
      ),
    );
  }
}

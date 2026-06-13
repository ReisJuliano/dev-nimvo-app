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
  });

  final String title;
  final num value;
  final num? growth;
  final IconData icon;
  final bool isMoney;

  @override
  Widget build(BuildContext context) {
    final positive = (growth ?? 0) >= 0;
    final featured = growth != null;
    final mutedText = featured
        ? Colors.white.withValues(alpha: 0.78)
        : AppColors.textSecondary;

    return Container(
      width: 184,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: growth != null ? AppGradients.brand : AppGradients.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon,
                  color: featured ? Colors.white : AppColors.primary, size: 20),
              const Spacer(),
              if (growth != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (positive ? AppColors.success : AppColors.danger)
                        .withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    formatPercent(growth!),
                    style: TextStyle(
                      color: positive ? AppColors.success : AppColors.danger,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const Spacer(),
          Text(title, style: TextStyle(color: mutedText, fontSize: 12)),
          const SizedBox(height: 8),
          Text(
            isMoney ? formatCurrency(value) : value.toStringAsFixed(1),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class NimvoLogo extends StatelessWidget {
  const NimvoLogo({
    super.key,
    this.size = 44,
    this.showShadow = false,
  });

  final double size;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.22),
        boxShadow: showShadow
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.28),
                  blurRadius: 28,
                  offset: const Offset(0, 14),
                ),
              ]
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        'assets/branding/nimvo-logo.png',
        fit: BoxFit.cover,
      ),
    );
  }
}

class NimvoTitle extends StatelessWidget {
  const NimvoTitle({
    super.key,
    this.label = 'Nimvo',
    this.logoSize = 28,
  });

  final String label;
  final double logoSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        NimvoLogo(size: logoSize),
        const SizedBox(width: 10),
        Text(label),
      ],
    );
  }
}

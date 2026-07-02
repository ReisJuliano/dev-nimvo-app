import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Reusable period picker used by Vendas and the Relatorios tabs: quick
/// preset chips plus a button that opens the native date range picker.
class DateRangeBar extends StatelessWidget {
  const DateRangeBar({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final DateTimeRange? value;
  final ValueChanged<DateTimeRange?> onChanged;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ChoiceChip(
            label: const Text('Hoje'),
            selected: _isSameRange(value, today, today),
            onSelected: (_) => onChanged(DateTimeRange(start: today, end: today)),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: const Text('7 dias'),
            selected: _isSameRange(
                value, today.subtract(const Duration(days: 6)), today),
            onSelected: (_) => onChanged(DateTimeRange(
                start: today.subtract(const Duration(days: 6)), end: today)),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: const Text('Este mes'),
            selected:
                _isSameRange(value, DateTime(now.year, now.month, 1), today),
            onSelected: (_) => onChanged(DateTimeRange(
                start: DateTime(now.year, now.month, 1), end: today)),
          ),
          const SizedBox(width: 8),
          ActionChip(
            avatar: const Icon(Icons.calendar_month_outlined, size: 17),
            label: Text(_customLabel(value)),
            onPressed: () async {
              final picked = await showDateRangePicker(
                context: context,
                firstDate: DateTime(now.year - 2),
                lastDate: today,
                initialDateRange: value,
              );
              if (picked != null) {
                onChanged(picked);
              }
            },
          ),
        ],
      ),
    );
  }

  bool _isSameRange(DateTimeRange? range, DateTime start, DateTime end) {
    if (range == null) return false;
    return _sameDay(range.start, start) && _sameDay(range.end, end);
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String _customLabel(DateTimeRange? range) {
    if (range == null) return 'Periodo customizado';
    return '${_format(range.start)} - ${_format(range.end)}';
  }

  String _format(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}';
}

/// Small helper chip shown when a seller/product filter is active, with a
/// way to clear it.
class ActiveFilterChip extends StatelessWidget {
  const ActiveFilterChip({super.key, required this.label, required this.onClear});

  final String label;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label),
      onDeleted: onClear,
      deleteIcon: const Icon(Icons.close, size: 16),
      backgroundColor: AppColors.primary.withValues(alpha: 0.08),
      side: BorderSide(color: AppColors.primary.withValues(alpha: 0.24)),
    );
  }
}

import 'package:intl/intl.dart';

final _currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
final _date = DateFormat('dd/MM/yyyy', 'pt_BR');
final _dateTime = DateFormat('dd/MM/yyyy HH:mm', 'pt_BR');

String formatCurrency(num value) => _currency.format(value);

String formatCompactCurrency(num value) {
  final abs = value.abs();
  if (abs >= 1000000) {
    return 'R\$ ${(value / 1000000).toStringAsFixed(1).replaceAll('.', ',')} mi';
  }
  if (abs >= 1000) {
    return 'R\$ ${(value / 1000).toStringAsFixed(1).replaceAll('.', ',')} mil';
  }

  return _currency.format(value);
}

String formatPercent(num value) {
  final sign = value > 0 ? '+' : '';
  return '$sign${value.toStringAsFixed(1).replaceAll('.', ',')}%';
}

String formatDate(DateTime value) => _date.format(value);

String formatDateTime(DateTime value) => _dateTime.format(value);

String formatHour(String hour) => hour.replaceFirst(':00', 'h');

import 'package:intl/intl.dart';

final _currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
final _date = DateFormat('dd/MM/yyyy', 'pt_BR');

String formatCurrency(num value) => _currency.format(value);

String formatPercent(num value) {
  final sign = value > 0 ? '+' : '';
  return '$sign${value.toStringAsFixed(1).replaceAll('.', ',')}%';
}

String formatDate(DateTime value) => _date.format(value);

String formatHour(String hour) => hour.replaceFirst(':00', 'h');

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/nimvo_brand.dart';
import '../data/stock_provider.dart';

class StockScreen extends ConsumerStatefulWidget {
  const StockScreen({super.key});

  @override
  ConsumerState<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends ConsumerState<StockScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  Map<String, dynamic>? _selectedProduct;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alerts = ref.watch(stockAlertsProvider);
    final search = ref.watch(stockProductSearchProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const NimvoTitle(label: 'Estoque')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(stockAlertsProvider);
          if (_query.trim().length >= 2) {
            ref.invalidate(stockProductSearchProvider(_query));
          }
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SearchPanel(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              onScan: _openScanner,
              onClear: () => setState(() {
                _searchController.clear();
                _query = '';
                _selectedProduct = null;
              }),
            ),
            if (_query.trim().length >= 2) ...[
              const SizedBox(height: 12),
              _SearchResults(
                value: search,
                selectedProduct: _selectedProduct,
                onSelect: (product) => setState(() {
                  _selectedProduct = product;
                  _searchController.text = product['barcode'] as String? ??
                      product['code'] as String? ??
                      product['name'] as String? ??
                      '';
                  _query = _searchController.text;
                }),
              ),
            ],
            if (_selectedProduct != null) ...[
              const SizedBox(height: 12),
              _ProductDetails(product: _selectedProduct!),
            ],
            const SizedBox(height: 18),
            Text('Alertas de estoque',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            alerts.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const Text(
                'Nao foi possivel carregar os alertas.',
                style: TextStyle(color: AppColors.danger),
              ),
              data: (items) => _StockAlerts(items: items),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openScanner() async {
    final code = await Navigator.of(context, rootNavigator: true).push<String>(
      MaterialPageRoute(builder: (_) => const _BarcodeScannerScreen()),
    );

    if (!mounted || code == null || code.trim().isEmpty) {
      return;
    }

    setState(() {
      _searchController.text = code.trim();
      _query = code.trim();
      _selectedProduct = null;
    });
  }
}

class _SearchPanel extends StatelessWidget {
  const _SearchPanel({
    required this.controller,
    required this.onChanged,
    required this.onScan,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onScan;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Consulta rapida',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              onChanged: onChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Nome, codigo ou codigo de barras',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (controller.text.isNotEmpty)
                      IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: onClear,
                      ),
                    IconButton(
                      icon: const Icon(Icons.qr_code_scanner, size: 20),
                      onPressed: onScan,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchResults extends StatelessWidget {
  const _SearchResults({
    required this.value,
    required this.selectedProduct,
    required this.onSelect,
  });

  final AsyncValue<List<dynamic>> value;
  final Map<String, dynamic>? selectedProduct;
  final ValueChanged<Map<String, dynamic>> onSelect;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => const LinearProgressIndicator(),
      error: (_, __) => const Text(
        'Nao foi possivel buscar produtos.',
        style: TextStyle(color: AppColors.danger),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const Text(
            'Nenhum produto encontrado.',
            style: TextStyle(color: AppColors.textSecondary),
          );
        }

        return Card(
          child: Column(
            children: items.map((item) {
              final product = item as Map<String, dynamic>;
              final selected = product['id'] == selectedProduct?['id'];

              return ListTile(
                dense: true,
                selected: selected,
                selectedTileColor: AppColors.primary.withValues(alpha: 0.06),
                title: Text(product['name'] as String? ?? ''),
                subtitle: Text(
                  [
                    product['code'],
                    product['barcode'],
                    product['category_name'],
                  ]
                      .where((value) => value != null && '$value'.isNotEmpty)
                      .join(' - '),
                ),
                trailing: Text(formatCurrency(_num(product['sale_price']))),
                onTap: () => onSelect(product),
              );
            }).toList(),
          ),
        );
      },
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _ProductDetails extends StatelessWidget {
  const _ProductDetails({required this.product});

  final Map<String, dynamic> product;

  @override
  Widget build(BuildContext context) {
    final stock = _num(product['stock_quantity']);
    final minStock = _num(product['min_stock']);
    final lowStock = stock <= minStock;
    final lastSaleAt = DateTime.tryParse('${product['last_sale_at']}');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    product['name'] as String? ?? '',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Chip(
                  label: Text(lowStock ? 'ATENCAO' : 'OK'),
                  backgroundColor:
                      (lowStock ? AppColors.warning : AppColors.success)
                          .withValues(alpha: 0.14),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                product['code'],
                product['barcode'],
                product['category_name'],
              ]
                  .where((value) => value != null && '$value'.isNotEmpty)
                  .join(' - '),
              style:
                  const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: MediaQuery.sizeOf(context).width >= 720 ? 4 : 2,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 2.2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _InfoTile(
                    label: 'Preco venda',
                    value: formatCurrency(_num(product['sale_price']))),
                _InfoTile(
                    label: 'Custo',
                    value: formatCurrency(_num(product['cost_price']))),
                _InfoTile(
                  label: 'Estoque',
                  value: '${stock.toStringAsFixed(2)} ${product['unit'] ?? ''}',
                ),
                _InfoTile(
                  label: 'Minimo',
                  value:
                      '${minStock.toStringAsFixed(2)} ${product['unit'] ?? ''}',
                ),
                _InfoTile(
                  label: 'Media 30d',
                  value:
                      '${_num(product['avg_daily_qty_30d']).toStringAsFixed(2)} un/dia',
                ),
                _InfoTile(
                  label: 'Ultima venda',
                  value: lastSaleAt == null
                      ? 'Sem registro'
                      : formatDateTime(lastSaleAt),
                ),
                _InfoTile(
                  label: 'Qtd. ultima',
                  value:
                      '${_num(product['last_sale_qty']).toStringAsFixed(2)} ${product['unit'] ?? ''}',
                ),
                _InfoTile(
                  label: 'Valor ultima',
                  value: formatCurrency(_num(product['last_sale_total'])),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.cardAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style:
                const TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}

class _StockAlerts extends StatelessWidget {
  const _StockAlerts({required this.items});

  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(18),
          child: Row(
            children: [
              Icon(Icons.check_circle_outline, color: AppColors.success),
              SizedBox(width: 10),
              Text('Nenhum alerta de estoque'),
            ],
          ),
        ),
      );
    }

    return Column(
      children: items.map((raw) {
        final item = raw as Map<String, dynamic>;
        final critical = item['alert_level'] == 'critical';

        return Card(
          child: ListTile(
            dense: true,
            leading: Icon(
              critical ? Icons.error_outline : Icons.warning_amber_outlined,
              color: critical ? AppColors.danger : AppColors.warning,
            ),
            title: Text(item['name'] as String? ?? ''),
            subtitle: Text(
                'Atual ${item['stock_quantity']} / minimo ${item['min_stock']} ${item['unit'] ?? ''}'),
            trailing: Chip(
              label: Text(critical ? 'CRITICO' : 'ATENCAO'),
              backgroundColor: (critical ? AppColors.danger : AppColors.warning)
                  .withValues(alpha: 0.16),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _BarcodeScannerScreen extends StatefulWidget {
  const _BarcodeScannerScreen();

  @override
  State<_BarcodeScannerScreen> createState() => _BarcodeScannerScreenState();
}

class _BarcodeScannerScreenState extends State<_BarcodeScannerScreen> {
  late final MobileScannerController _scannerController;
  bool _handled = false;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      formats: const [
        BarcodeFormat.ean13,
        BarcodeFormat.ean8,
        BarcodeFormat.upcA,
        BarcodeFormat.upcE,
        BarcodeFormat.code128,
        BarcodeFormat.code39,
        BarcodeFormat.code93,
        BarcodeFormat.codabar,
        BarcodeFormat.itf,
      ],
    );
  }

  @override
  void dispose() {
    unawaited(_scannerController.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(title: const Text('Ler codigo')),
      body: Stack(
        children: [
          MobileScanner(
            controller: _scannerController,
            placeholderBuilder: (context, child) => const ColoredBox(
              color: Colors.black,
              child: Center(child: CircularProgressIndicator()),
            ),
            errorBuilder: (context, error, _) =>
                _ScannerErrorView(error: error),
            onDetect: (capture) {
              if (_handled) {
                return;
              }

              final value = capture.barcodes.firstOrNull?.rawValue?.trim();
              if (value == null || value.isEmpty) {
                return;
              }

              _handled = true;
              Navigator.of(context).pop(value);
            },
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 240,
                height: 150,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 2),
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.black.withValues(alpha: 0.58),
              child: const Text(
                'Aponte a camera para o codigo de barras do produto.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScannerErrorView extends StatelessWidget {
  const _ScannerErrorView({required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final detail = error.errorDetails?.message ?? error.errorCode.name;

    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off_outlined,
                  color: Colors.white, size: 36),
              const SizedBox(height: 12),
              const Text(
                'Nao foi possivel abrir a camera.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                detail,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.keyboard_outlined),
                label: const Text('Digitar codigo'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

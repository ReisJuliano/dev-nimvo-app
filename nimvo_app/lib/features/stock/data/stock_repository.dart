import '../../../core/api/dio_client.dart';

class StockRepository {
  StockRepository(this._client);

  final DioClient _client;

  Future<List<dynamic>> alerts() async {
    final response =
        await _client.dio.get<Map<String, dynamic>>('/stock/alerts');
    return response.data?['data'] as List<dynamic>? ?? [];
  }

  Future<List<dynamic>> searchProducts(String query) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/products/search',
      queryParameters: {
        'q': query,
        'limit': 8,
      },
    );
    final data = response.data?['data'] as Map<String, dynamic>?;
    return data?['items'] as List<dynamic>? ?? [];
  }
}

import '../../../core/api/dio_client.dart';

class ReportsRepository {
  ReportsRepository(this._client);

  final DioClient _client;

  Future<Map<String, dynamic>> cmv({String? from, String? to}) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/reports/cmv',
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      },
    );
    return response.data?['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> period({String? from, String? to}) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/reports/period',
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      },
    );
    return response.data?['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> topProducts({
    String? from,
    String? to,
    int limit = 10,
  }) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/reports/top-products',
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        'limit': limit,
      },
    );
    return response.data?['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> paymentMethods({String? from, String? to}) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/reports/payment-methods',
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      },
    );
    return response.data?['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> products({
    String? from,
    String? to,
    int? productId,
    int? categoryId,
    int limit = 10,
  }) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/reports/products',
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (productId != null) 'product_id': productId,
        if (categoryId != null) 'category_id': categoryId,
        'limit': limit,
      },
    );
    return response.data?['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> searchProducts(String query) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/products/search',
      queryParameters: {'q': query},
    );
    final data = response.data?['data'] as Map<String, dynamic>?;
    return data?['items'] as List<dynamic>? ?? [];
  }
}

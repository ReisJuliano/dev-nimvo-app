import '../../../core/api/dio_client.dart';

class StockRepository {
  StockRepository(this._client);

  final DioClient _client;

  Future<List<dynamic>> alerts() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/stock/alerts');
    return response.data?['data'] as List<dynamic>? ?? [];
  }
}

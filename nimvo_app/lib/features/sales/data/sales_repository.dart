import '../../../core/api/dio_client.dart';

class SalesRepository {
  SalesRepository(this._client);

  final DioClient _client;

  Future<Map<String, dynamic>> list({String? from, String? to}) async {
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/sales',
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        'per_page': 30,
      },
    );

    return response.data ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> bySeller() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/sales/by-seller');
    return response.data?['data'] as Map<String, dynamic>;
  }
}

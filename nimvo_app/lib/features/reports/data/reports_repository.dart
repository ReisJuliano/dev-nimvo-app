import '../../../core/api/dio_client.dart';

class ReportsRepository {
  ReportsRepository(this._client);

  final DioClient _client;

  Future<Map<String, dynamic>> cmv() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/reports/cmv');
    return response.data?['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> period() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/reports/period');
    return response.data?['data'] as Map<String, dynamic>;
  }
}

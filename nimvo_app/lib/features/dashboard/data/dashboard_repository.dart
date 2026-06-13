import '../../../core/api/dio_client.dart';

class DashboardRepository {
  DashboardRepository(this._client);

  final DioClient _client;

  Future<Map<String, dynamic>> fetch() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/dashboard');
    return response.data?['data'] as Map<String, dynamic>;
  }
}

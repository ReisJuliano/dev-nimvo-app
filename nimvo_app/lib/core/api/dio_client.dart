import 'package:dio/dio.dart';

import '../storage/secure_storage.dart';

class DioClient {
  DioClient(this._storage) {
    dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final store = await _storage.readStore();
          final token = await _storage.readToken();

          if (store != null && store.isNotEmpty) {
            options.baseUrl = buildBaseUrl(store);
          }

          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          handler.next(options);
        },
      ),
    );
  }

  final SecureStorage _storage;
  late final Dio dio;

  static String buildBaseUrl(String store) {
    final clean = store.trim().replaceAll(RegExp(r'/+$'), '');

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return '$clean/mobile-api/v1';
    }

    return 'https://$clean.nimvo.com.br/mobile-api/v1';
  }
}

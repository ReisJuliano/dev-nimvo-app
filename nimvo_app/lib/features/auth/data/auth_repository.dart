import 'package:dio/dio.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/storage/secure_storage.dart';

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.username,
    required this.role,
    required this.isSupervisor,
  });

  final int id;
  final String name;
  final String username;
  final String role;
  final bool isSupervisor;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      username: json['username'] as String? ?? '',
      role: json['role'] as String? ?? '',
      isSupervisor: json['is_supervisor'] as bool? ?? false,
    );
  }
}

class TenantInfo {
  const TenantInfo({this.id, this.name});

  final String? id;
  final String? name;

  factory TenantInfo.fromJson(Map<String, dynamic> json) {
    return TenantInfo(
      id: json['id']?.toString(),
      name: json['name'] as String?,
    );
  }
}

class AuthRepository {
  AuthRepository(this._client, this._storage);

  final DioClient _client;
  final SecureStorage _storage;

  Future<AuthUser> login({
    required String store,
    required String username,
    required String password,
    required String deviceName,
  }) async {
    await _storage.saveStore(store);

    final response = await _client.dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {
        'username': username,
        'password': password,
        'device_name': deviceName,
      },
    );

    final data = response.data?['data'] as Map<String, dynamic>;
    await _storage.saveToken(data['token'] as String);

    return AuthUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<({AuthUser user, TenantInfo tenant})> me() async {
    final response = await _client.dio.get<Map<String, dynamic>>('/auth/me');
    final data = response.data?['data'] as Map<String, dynamic>;

    return (
      user: AuthUser.fromJson(data['user'] as Map<String, dynamic>),
      tenant: TenantInfo.fromJson(data['tenant'] as Map<String, dynamic>),
    );
  }

  Future<void> logout() async {
    try {
      await _client.dio.post('/auth/logout');
    } on DioException {
      // Local cleanup still matters if the server is unreachable.
    }

    await _storage.clearSession();
  }
}

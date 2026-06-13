import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  SecureStorage([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const tokenKey = 'nimvo.token';
  static const storeKey = 'nimvo.store';

  Future<String?> readToken() => _storage.read(key: tokenKey);

  Future<void> saveToken(String token) => _storage.write(key: tokenKey, value: token);

  Future<String?> readStore() => _storage.read(key: storeKey);

  Future<void> saveStore(String store) => _storage.write(key: storeKey, value: store);

  Future<void> clearSession() => _storage.delete(key: tokenKey);

  Future<void> clearAll() => _storage.deleteAll();
}

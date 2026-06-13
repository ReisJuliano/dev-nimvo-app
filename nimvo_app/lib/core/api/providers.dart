import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/secure_storage.dart';
import 'dio_client.dart';

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

final dioClientProvider = Provider<DioClient>((ref) {
  return DioClient(ref.watch(secureStorageProvider));
});

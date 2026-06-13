import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import '../../../core/storage/secure_storage.dart';
import '../data/auth_repository.dart';

class AuthState {
  const AuthState({
    this.user,
    this.tenant,
    this.isLoading = false,
    this.store,
  });

  final AuthUser? user;
  final TenantInfo? tenant;
  final bool isLoading;
  final String? store;

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    AuthUser? user,
    TenantInfo? tenant,
    bool? isLoading,
    String? store,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : user ?? this.user,
      tenant: clearUser ? null : tenant ?? this.tenant,
      isLoading: isLoading ?? this.isLoading,
      store: store ?? this.store,
    );
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
      ref.watch(dioClientProvider), ref.watch(secureStorageProvider));
});

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends AsyncNotifier<AuthState> {
  late final AuthRepository _repository;
  late final SecureStorage _storage;

  @override
  Future<AuthState> build() async {
    _repository = ref.watch(authRepositoryProvider);
    _storage = ref.watch(secureStorageProvider);

    final store = await _storage.readStore();
    final token = await _storage.readToken();

    if (token == null || token.isEmpty) {
      return AuthState(store: store);
    }

    try {
      final session = await _repository.me();
      return AuthState(
          user: session.user, tenant: session.tenant, store: store);
    } catch (_) {
      await _storage.clearSession();
      return AuthState(store: store);
    }
  }

  Future<void> login({
    required String store,
    required String username,
    required String password,
  }) async {
    state = AsyncData((state.valueOrNull ?? const AuthState())
        .copyWith(isLoading: true, store: store));

    state = await AsyncValue.guard(() async {
      final user = await _repository.login(
        store: store,
        username: username,
        password: password,
        deviceName: 'flutter-mobile',
      );
      final session = await _repository.me();
      return AuthState(user: user, tenant: session.tenant, store: store);
    });
  }

  Future<void> logout({bool clearStore = false}) async {
    await _repository.logout();

    if (clearStore) {
      await _storage.clearAll();
      state = const AsyncData(AuthState());
      return;
    }

    state = AsyncData(AuthState(store: await _storage.readStore()));
  }
}

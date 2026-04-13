import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStorage {
  SecureTokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  Future<void> writeToken(String token) => _storage.write(key: 'token', value: token);
  Future<String?> readToken() => _storage.read(key: 'token');
  Future<void> clearToken() => _storage.delete(key: 'token');
}

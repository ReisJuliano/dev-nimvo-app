import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// The direct-APK distribution has no store-level auto-update, so the app
/// itself polls a small tenant-agnostic endpoint on the central domain to
/// know a newer build was published.
class AppUpdateInfo {
  const AppUpdateInfo({
    required this.version,
    required this.downloadUrl,
    this.notes,
  });

  final String version;
  final String downloadUrl;
  final String? notes;
}

class AppUpdateRepository {
  static const _versionUrl = 'https://admin.nimvo.com.br/app/version.json';

  Future<AppUpdateInfo?> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(packageInfo.buildNumber) ?? 0;

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ));
      final response = await dio.get<Map<String, dynamic>>(_versionUrl);
      final data = response.data;
      if (data == null || data['available'] != true) {
        return null;
      }

      final remoteBuild = (data['build_number'] as num?)?.toInt() ?? 0;
      if (remoteBuild <= currentBuild) {
        return null;
      }

      return AppUpdateInfo(
        version: data['version'] as String? ?? '',
        downloadUrl: data['download_url'] as String? ?? _defaultDownloadPage,
        notes: data['notes'] as String?,
      );
    } catch (_) {
      // Silent by design: a flaky connection or the endpoint being
      // unreachable should never block or alarm the user.
      return null;
    }
  }

  static const _defaultDownloadPage = 'https://admin.nimvo.com.br/app/baixar';
}

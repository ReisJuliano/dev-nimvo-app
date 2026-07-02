# Nimvo Mobile

Flutter dashboard app for Nimvo tenants.

## Local setup

This workspace has been prepared with:

- Flutter SDK: `B:\Tools\Flutter\flutter`
- Android SDK: `B:\Tools\Android\sdk`
- JDK 17: Microsoft OpenJDK

In a new terminal, if `flutter` is not found yet, close and reopen PowerShell
so it reloads the user `PATH`.

Useful commands:

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

The app accepts either a tenant subdomain such as `minha-loja` or a full local
debug URL such as `http://10.0.2.2:8000`.

## Test build

Generate a debug APK:

```bash
flutter build apk --debug
```

The APK is generated at:

```text
build/app/outputs/flutter-apk/app-debug.apk
```

For the current VPS test tenant, use:

```text
Loja: teste
Usuario: amostra.admin
Senha: 123456
```

## Release build & signing

Release builds fall back to the debug key until a real keystore is
configured, so `flutter build apk --release` always works but is not
production-signed by default.

To sign a real release, once, on a machine you trust (never commit the
result):

```bash
keytool -genkey -v -keystore nimvo-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nimvo
```

Keep `nimvo-release.jks` outside the repo (e.g. a password manager or the
VPS, never in git) and create `android/key.properties` (already gitignored)
next to `android/app/build.gradle.kts`:

```properties
storePassword=...
keyPassword=...
keyAlias=nimvo
storeFile=/absolute/path/to/nimvo-release.jks
```

With that file present, `flutter build apk --release` signs with the real
key automatically. **Do not lose this keystore or its passwords** - Android
requires the same signing key for every future update of an already
installed app; losing it means existing installs can never be updated in
place.

## Publishing a new version (direct-APK distribution)

There is no store, so there is no automatic build/sign/publish pipeline -
every release is a manual runbook:

1. Bump `version` in `pubspec.yaml` (e.g. `0.2.0+2` -> `0.2.1+3`). The
   build number (the part after `+`) is what the in-app update check
   compares against.
2. `flutter build apk --release`.
3. Copy the APK to the Laravel app's public releases folder:
   `storage/app/public/releases/nimvo-app.apk`.
4. Update `storage/app/public/releases/version.json` next to it with the
   new `version`/`build_number` (and optional `notes` shown in the in-app
   banner):
   ```json
   {"version": "0.2.1", "build_number": 3, "notes": "..."}
   ```
5. Copy both files to the VPS at the same path (`scp`), owned by
   `www-data`. This is what `admin.nimvo.com.br/app/version.json` and
   `/app/baixar.apk` serve, and what makes the "nova versao disponivel"
   banner show up for users on an older build.

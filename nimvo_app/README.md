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

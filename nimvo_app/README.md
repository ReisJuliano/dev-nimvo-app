# Nimvo Mobile

Flutter dashboard app for Nimvo tenants.

This repository was scaffolded without running `flutter create` because the
Flutter SDK is not installed in the current environment. On a machine with
Flutter, run:

```bash
flutter create . --org br.com.nimvo --platforms android,ios
flutter pub get
flutter run
```

The app accepts either a tenant subdomain such as `minha-loja` or a full local
debug URL such as `http://10.0.2.2:8000`.

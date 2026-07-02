import 'dart:ui';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/nimvo_brand.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _storeController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  String? _bannerError;

  @override
  void initState() {
    super.initState();
    final store = ref.read(authControllerProvider).valueOrNull?.store;
    if (store != null) {
      _storeController.text = store;
    }
  }

  @override
  void dispose() {
    _storeController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.valueOrNull?.isLoading == true;

    ref.listen(authControllerProvider, (previous, next) {
      final value = next.valueOrNull;
      if (value?.isAuthenticated == true && mounted) {
        context.go('/dashboard');
      }

      if (next.hasError && mounted) {
        setState(() => _bannerError = _errorMessage(next.error));
      }
    });

    return Scaffold(
      body: Stack(
        children: [
          const _LoginBackground(),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 430),
                  child: _GlassCard(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _buildHeader(context),
                          const SizedBox(height: 24),
                          if (_bannerError != null) ...[
                            _ErrorBanner(message: _bannerError!),
                            const SizedBox(height: 18),
                          ],
                          _GlassField(
                            controller: _storeController,
                            label: 'Loja',
                            hint: 'sualoja ou URL',
                            icon: Icons.storefront_outlined,
                            validator: (value) =>
                                value == null || value.trim().isEmpty
                                    ? 'Informe a loja'
                                    : null,
                          ),
                          const SizedBox(height: 16),
                          _GlassField(
                            controller: _usernameController,
                            label: 'Usuario',
                            hint: 'admin',
                            icon: Icons.person_outline,
                            autofocus: true,
                            validator: (value) =>
                                value == null || value.trim().isEmpty
                                    ? 'Informe o usuario'
                                    : null,
                          ),
                          const SizedBox(height: 16),
                          _GlassField(
                            controller: _passwordController,
                            label: 'Senha',
                            hint: '********',
                            icon: Icons.lock_outline,
                            obscureText: _obscure,
                            trailing: IconButton(
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                color: AppColors.textMuted,
                                size: 20,
                              ),
                            ),
                            validator: (value) =>
                                value == null || value.isEmpty
                                    ? 'Informe a senha'
                                    : null,
                          ),
                          const SizedBox(height: 26),
                          _GradientButton(
                            loading: loading,
                            onPressed: loading ? null : _submit,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.loginAccent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(18),
          ),
          padding: const EdgeInsets.all(8),
          child: const NimvoLogo(size: 36),
        ),
        const SizedBox(height: 14),
        const Text(
          'Nimvo',
          style: TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w700,
            color: Color(0xFF192538),
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          'PAINEL GERENCIAL',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: Color(0xFF78849A),
          ),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() => _bannerError = null);
    if (!_formKey.currentState!.validate()) {
      return;
    }

    await ref.read(authControllerProvider.notifier).login(
          store: _storeController.text.trim(),
          username: _usernameController.text.trim(),
          password: _passwordController.text,
        );
  }

  String _errorMessage(Object? error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] is String) {
        return data['message'] as String;
      }
    }

    return 'Nao foi possivel entrar. Verifique os dados e tente novamente.';
  }
}

class _LoginBackground extends StatelessWidget {
  const _LoginBackground();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF7F9FC), Color(0xFFEFF3F8)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -80,
            left: -80,
            child: _blob(280, AppColors.loginAccent.withValues(alpha: 0.16)),
          ),
          Positioned(
            top: 120,
            right: -100,
            child: _blob(260, const Color(0xFF07A5C9).withValues(alpha: 0.12)),
          ),
        ],
      ),
    );
  }

  Widget _blob(double size, Color color) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(32),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(28, 34, 28, 32),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: Colors.white.withValues(alpha: 0.78)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.14),
                blurRadius: 60,
                offset: const Offset(0, 28),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _GlassField extends StatelessWidget {
  const _GlassField({
    required this.controller,
    required this.label,
    required this.icon,
    this.hint,
    this.obscureText = false,
    this.autofocus = false,
    this.trailing,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? hint;
  final bool obscureText;
  final bool autofocus;
  final Widget? trailing;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: Color(0xFF78849A),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          autofocus: autofocus,
          validator: validator,
          style: const TextStyle(color: Color(0xFF192538)),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF9EABBF)),
            prefixIcon: Icon(icon, size: 19, color: const Color(0xFF78849A)),
            suffixIcon: trailing,
            filled: true,
            fillColor: const Color(0xFFF8FAFE),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(
                  color: AppColors.loginAccent.withValues(alpha: 0.44),
                  width: 1.6),
            ),
          ),
        ),
      ],
    );
  }
}

class _GradientButton extends StatelessWidget {
  const _GradientButton({required this.loading, required this.onPressed});

  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: AppGradients.loginButton,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: AppColors.loginAccent.withValues(alpha: 0.24),
                blurRadius: 30,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text(
                  'Entrar',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15.5,
                  ),
                ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F3),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFD84E61).withValues(alpha: 0.2)),
      ),
      child: Text(
        message,
        style: const TextStyle(color: Color(0xFFB23A4F), fontSize: 13.5),
      ),
    );
  }
}

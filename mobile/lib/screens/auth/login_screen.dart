import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _loading = false;
  bool _googleLoading = false;
  bool _isLogin = true;
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();

  Future<void> _googleSignIn() async {
    setState(() => _googleLoading = true);
    try {
      final googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) return;
      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      final result = await FirebaseAuth.instance.signInWithCredential(credential);
      await _upsertUser(result.user!);
      if (mounted) context.go('/');
    } catch (e) {
      _showError('Google sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  Future<void> _emailAuth() async {
    setState(() => _loading = true);
    try {
      UserCredential result;
      if (_isLogin) {
        result = await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: _emailCtrl.text.trim(), password: _passCtrl.text);
      } else {
        result = await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: _emailCtrl.text.trim(), password: _passCtrl.text);
        await result.user?.updateDisplayName(_nameCtrl.text.trim());
      }
      await _upsertUser(result.user!);
      if (mounted) context.go('/');
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _upsertUser(User user) async {
    final ref = FirebaseFirestore.instance.doc('users/${user.uid}');
    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'uid': user.uid, 'email': user.email,
        'displayName': user.displayName ?? user.email?.split('@')[0],
        'photoURL': user.photoURL ?? '',
        'projectIds': [], 'fcmTokens': [],
        'preferences': {'theme': 'dark', 'notifications': true},
        'createdAt': FieldValue.serverTimestamp(),
        'lastActive': FieldValue.serverTimestamp(),
      });
    } else {
      await ref.update({'lastActive': FieldValue.serverTimestamp()});
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: const Color(0xFFEF4444)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.8, -0.8),
            radius: 1.5,
            colors: [Color(0xFF1A1040), Color(0xFF070B14)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo
                  Container(
                    width: 56, height: 56,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.4), blurRadius: 20)],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.asset('assets/images/MSDEV.png', fit: BoxFit.cover),
                    ),
                  ).animate().fadeIn(duration: 600.ms).scale(begin: const Offset(0.8, 0.8)),
                  const SizedBox(height: 16),
                  Text('MSDEV', style: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white))
                    .animate().fadeIn(delay: 200.ms),
                  Text(_isLogin ? 'Welcome back' : 'Create your account',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14))
                    .animate().fadeIn(delay: 300.ms),
                  const SizedBox(height: 32),

                  // Google Sign-In
                  _GoogleButton(loading: _googleLoading, onTap: _googleSignIn)
                    .animate().fadeIn(delay: 400.ms).slideY(begin: 0.2),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(child: Divider(color: Colors.white.withOpacity(0.1))),
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12))),
                    Expanded(child: Divider(color: Colors.white.withOpacity(0.1))),
                  ]).animate().fadeIn(delay: 500.ms),
                  const SizedBox(height: 20),

                  // Form
                  Column(
                    children: [
                      if (!_isLogin) ...[
                        _InputField(controller: _nameCtrl, hint: 'Full Name', icon: Icons.person_outline),
                        const SizedBox(height: 12),
                      ],
                      _InputField(controller: _emailCtrl, hint: 'Email Address', icon: Icons.email_outlined, keyboardType: TextInputType.emailAddress),
                      const SizedBox(height: 12),
                      _InputField(controller: _passCtrl, hint: 'Password', icon: Icons.lock_outline, obscure: true),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: _loading ? null : _emailAuth,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF6366F1),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            elevation: 0,
                          ),
                          child: _loading
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Text(_isLogin ? 'Sign In' : 'Create Account', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        ),
                      ),
                    ],
                  ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.2),

                  const SizedBox(height: 20),
                  TextButton(
                    onPressed: () => setState(() => _isLogin = !_isLogin),
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: _isLogin ? "Don't have an account? " : 'Already have an account? ', style: TextStyle(color: Colors.white.withOpacity(0.4))),
                      TextSpan(text: _isLogin ? 'Sign up' : 'Sign in', style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.w700)),
                    ])),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GoogleButton extends StatelessWidget {
  final bool loading;
  final VoidCallback onTap;
  const _GoogleButton({required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity, height: 50,
      child: OutlinedButton.icon(
        onPressed: loading ? null : onTap,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: Colors.white.withOpacity(0.15)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          foregroundColor: Colors.white,
        ),
        icon: loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Image.network('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/768px-Google_%22G%22_logo.svg.png', width: 18, height: 18, errorBuilder: (_, __, ___) => const Icon(Icons.g_mobiledata)),
        label: const Text('Continue with Google', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboardType;
  const _InputField({required this.controller, required this.hint, required this.icon, this.obscure = false, this.keyboardType});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 14),
        prefixIcon: Icon(icon, color: Colors.white.withOpacity(0.3), size: 18),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}

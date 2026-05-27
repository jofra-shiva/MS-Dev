import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/foundation.dart';
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
  bool _googleLoading = false;

  Future<void> _googleSignIn() async {
    setState(() => _googleLoading = true);
    try {
      // Web requires explicit clientId; Android reads from google-services.json
      final googleSignIn = GoogleSignIn(
        clientId: kIsWeb
            ? '332300816650-j80ocb0atipk2i9u304kgrth5du9f7rd.apps.googleusercontent.com'
            : null,
      );
      final googleUser = await googleSignIn.signIn();
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
                  Text('MSDEV', style: GoogleFonts.raleway(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white))
                    .animate().fadeIn(delay: 200.ms),
                  Text('Sign in to continue',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14))
                    .animate().fadeIn(delay: 300.ms),
                  const SizedBox(height: 32),

                  // Google Sign-In
                  _GoogleButton(loading: _googleLoading, onTap: _googleSignIn)
                    .animate().fadeIn(delay: 400.ms).slideY(begin: 0.2),
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
        icon: loading ? const SizedBox(width: 18, height: 18, child: MsDevLoader(small: true, color: Colors.white)) : Image.network('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/768px-Google_%22G%22_logo.svg.png', width: 18, height: 18, errorBuilder: (_, __, ___) => const Icon(Icons.g_mobiledata)),
        label: const Text('Continue with Google', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

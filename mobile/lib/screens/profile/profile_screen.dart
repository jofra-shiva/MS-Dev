import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameCtrl = TextEditingController();
  bool _isEditing = false;
  bool _isLoading = false;
  String _gender = 'male';

  final _maleAvatars = ['/avatar_m1.png', '/avatar_m2.png', '/avatar_m3.png', '/avatar_m4.png', '/avatar_m5.png'];
  final _femaleAvatars = ['/avatar_f1.png', '/avatar_f2.png', '/avatar_f3.png', '/avatar_f4.png', '/avatar_f5.png'];

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = FirebaseAuth.instance.currentUser?.displayName ?? '';
  }

  Future<void> _saveProfile() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      await FirebaseAuth.instance.currentUser?.updateDisplayName(name);
      setState(() => _isEditing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully!'), backgroundColor: Color(0xFF10B981)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating profile: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateAvatar(String path) async {
    setState(() => _isLoading = true);
    try {
      await FirebaseAuth.instance.currentUser?.updatePhotoURL(path);
      setState(() {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avatar updated!'), backgroundColor: Color(0xFF10B981)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating avatar: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<bool> _onWillPop() async {
    if (!_isEditing) return true;
    final shouldLeave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161B2E),
        title: Text('Unsaved Changes', style: GoogleFonts.raleway(fontWeight: FontWeight.w700, color: Colors.white)),
        content: const Text('You have unsaved changes to your display name. Are you sure you want to leave without saving?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave', style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
    return shouldLeave ?? false;
  }

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
    try {
      await GoogleSignIn().signOut();
    } catch (_) {}
    if (mounted) context.go('/login');
  }

  ImageProvider _getAvatarProvider(String? photoURL) {
    if (photoURL != null && photoURL.startsWith('/')) {
      return AssetImage('assets/images$photoURL');
    } else if (photoURL != null && photoURL.isNotEmpty) {
      return NetworkImage(photoURL);
    }
    return const AssetImage('assets/images/avatar_m1.png');
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final providerId = user?.providerData.isNotEmpty == true ? user!.providerData.first.providerId : 'email';

    final avatars = _gender == 'male' ? _maleAvatars : _femaleAvatars;
    final currentAvatarUrl = user?.photoURL;

    return PopScope(
      canPop: !_isEditing,
      onPopInvoked: (didPop) async {
        if (didPop) return;
        final shouldLeave = await _onWillPop();
        if (shouldLeave && mounted) {
          context.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF070B14),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Text('Profile', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
          centerTitle: false,
        ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('My Profile', style: GoogleFonts.raleway(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5)),
            const SizedBox(height: 6),
            Text('Manage your account and avatar preferences.', style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.5))),
            const SizedBox(height: 32),

            // Profile Card
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 72, height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFFF59E0B), width: 3),
                          image: DecorationImage(
                            image: _getAvatarProvider(currentAvatarUrl),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(width: 20),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(user?.displayName ?? 'User', style: GoogleFonts.raleway(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white)),
                            const SizedBox(height: 4),
                            Text(user?.email ?? '', style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.5))),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _buildInfoRow('Display Name', user?.displayName ?? '—', isEditable: true),
                  _buildInfoRow('Email', user?.email ?? '—'),
                  _buildInfoRow('Provider', providerId),
                ],
              ),
            ),
            
            if (_isEditing) ...[
              const SizedBox(height: 24),
              // Choose Avatar Card
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1117),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Choose Avatar', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _buildGenderTab('male', '👦 Male'),
                        const SizedBox(width: 8),
                        _buildGenderTab('female', '👧 Female'),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 14, runSpacing: 14,
                      children: avatars.map((src) {
                        final isSelected = currentAvatarUrl == src;
                        return GestureDetector(
                          onTap: () => _updateAvatar(src),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 68, height: 68,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: isSelected ? const Color(0xFFF59E0B) : Colors.white.withOpacity(0.1), width: 3),
                              boxShadow: isSelected ? [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.4), blurRadius: 12)] : null,
                              image: DecorationImage(image: AssetImage('assets/images$src'), fit: BoxFit.cover),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity, height: 50,
              child: TextButton.icon(
                onPressed: _logout,
                icon: const Icon(Icons.logout, color: Colors.redAccent),
                label: const Text('Log Out', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.w700)),
                style: TextButton.styleFrom(
                  backgroundColor: Colors.redAccent.withOpacity(0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    ));
  }

  Widget _buildGenderTab(String value, String label) {
    final isSelected = _gender == value;
    return GestureDetector(
      onTap: () => setState(() => _gender = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981) : const Color(0xFF161B2E),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: TextStyle(
          color: isSelected ? Colors.black : Colors.white,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          fontSize: 14,
        )),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isEditable = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05)))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(flex: 2, child: Text(label, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14, fontWeight: FontWeight.w500))),
          if (isEditable && _isEditing)
            Expanded(
              flex: 5,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _nameCtrl,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                      decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 8, horizontal: 12), border: OutlineInputBorder(), focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFF59E0B)))),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (_isLoading)
                    const SizedBox(width: 20, height: 20, child: MsDevLoader(small: true, color: Color(0xFFF59E0B)))
                  else
                    IconButton(icon: const Icon(Icons.check, color: Color(0xFF10B981), size: 20), onPressed: _saveProfile, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
                ],
              ),
            )
          else
            Expanded(
              flex: 4,
              child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700), textAlign: TextAlign.right),
            ),
          if (isEditable && !_isEditing)
            IconButton(icon: const Icon(Icons.edit, size: 16, color: Color(0xFFF59E0B)), onPressed: () => setState(() => _isEditing = true), padding: EdgeInsets.zero, constraints: const BoxConstraints(), alignment: Alignment.centerRight),
        ],
      ),
    );
  }
}

import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _user = FirebaseAuth.instance.currentUser!;
  final _nameCtrl = TextEditingController();
  final _githubCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _isEditing = false;
  bool _emailNotifications = true;
  bool _pushNotifications = false;
  String _message = '';
  bool _messageIsError = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final snap = await FirebaseFirestore.instance.doc('users/${_user.uid}').get();
      final data = snap.data() ?? {};
      _nameCtrl.text = _user.displayName ?? data['displayName'] ?? '';
      _githubCtrl.text = data['githubUsername'] ?? '';
      _bioCtrl.text = data['bio'] ?? '';
      _emailNotifications = data['emailNotifications'] ?? true;
      _pushNotifications = data['pushNotifications'] ?? false;
    } catch (_) {
      _nameCtrl.text = _user.displayName ?? '';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveSettings() async {
    setState(() { _saving = true; _message = ''; });
    try {
      await FirebaseFirestore.instance.doc('users/${_user.uid}').update({
        'githubUsername': _githubCtrl.text.trim(),
        'bio': _bioCtrl.text.trim(),
        'emailNotifications': _emailNotifications,
        'pushNotifications': _pushNotifications,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (_nameCtrl.text.trim().isNotEmpty) {
        await _user.updateDisplayName(_nameCtrl.text.trim());
      }
      setState(() { _isEditing = false; _message = 'Settings saved successfully!'; _messageIsError = false; });
      Future.delayed(const Duration(seconds: 3), () { if (mounted) setState(() => _message = ''); });
    } catch (e) {
      setState(() { _message = 'Failed to save settings.'; _messageIsError = true; });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
    try { await GoogleSignIn().signOut(); } catch (_) {}
    if (mounted) context.go('/login');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _githubCtrl.dispose();
    _bioCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text('Settings', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
        actions: [
          if (!_isEditing)
            TextButton(
              onPressed: () => setState(() => _isEditing = true),
              child: const Text('Edit', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w700)),
            )
          else ...[
            TextButton(
              onPressed: () => setState(() => _isEditing = false),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            TextButton(
              onPressed: _saving ? null : _saveSettings,
              child: _saving
                  ? const SizedBox(width: 16, height: 16, child: MsDevLoader(small: true, color: Color(0xFF10B981)))
                  : const Text('Save', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w700)),
            ),
          ],
          const SizedBox(width: 8),
        ],
      ),
      body: _loading
          ? const Center(child: MsDevLoader(color: Color(0xFF10B981)))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Settings', style: GoogleFonts.raleway(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5)),
                  const SizedBox(height: 6),
                  Text('Manage your account preferences', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14)),
                  const SizedBox(height: 24),

                  // Status message
                  if (_message.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: (_messageIsError ? const Color(0xFFEF4444) : const Color(0xFF10B981)).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: (_messageIsError ? const Color(0xFFEF4444) : const Color(0xFF10B981)).withValues(alpha: 0.3)),
                      ),
                      child: Text(_message, style: TextStyle(color: _messageIsError ? const Color(0xFFEF4444) : const Color(0xFF10B981), fontWeight: FontWeight.w600, fontSize: 13)),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Profile card
                  _buildSection(
                    title: 'Profile Details',
                    subtitle: 'Your public information visible to team members',
                    child: Column(
                      children: [
                        // Avatar
                        Center(
                          child: Stack(
                            children: [
                              CircleAvatar(
                                radius: 44,
                                backgroundColor: const Color(0xFF1E2740),
                                backgroundImage: _user.photoURL != null && !_user.photoURL!.startsWith('/')
                                    ? NetworkImage(_user.photoURL!) : null,
                                child: _user.photoURL == null
                                    ? Text((_nameCtrl.text.isNotEmpty ? _nameCtrl.text[0] : 'U').toUpperCase(),
                                        style: GoogleFonts.raleway(fontSize: 32, fontWeight: FontWeight.w800, color: Colors.white))
                                    : null,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildField('Display Name', _nameCtrl, hint: 'Your full name'),
                        const SizedBox(height: 16),
                        _buildReadonlyField('Email', _user.email ?? ''),
                        const SizedBox(height: 16),
                        _buildField('Bio', _bioCtrl, hint: 'Short bio (optional)', maxLines: 3),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // GitHub
                  _buildSection(
                    title: 'GitHub Integration',
                    subtitle: 'Link your GitHub for activity tracking and commit history',
                    child: _buildFieldWithPrefix(
                      label: 'GitHub Username',
                      controller: _githubCtrl,
                      prefix: 'github.com/',
                      hint: 'username',
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Notifications
                  _buildSection(
                    title: 'Notification Settings',
                    subtitle: 'Control how you want to be notified',
                    child: Column(
                      children: [
                        _buildToggle('Email Notifications', _emailNotifications, (v) => setState(() => _emailNotifications = v)),
                        const SizedBox(height: 12),
                        _buildToggle('Push Notifications', _pushNotifications, (v) => setState(() => _pushNotifications = v)),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Logout
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: TextButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout, color: Colors.redAccent),
                      label: const Text('Log Out', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.w700)),
                      style: TextButton.styleFrom(
                        backgroundColor: Colors.redAccent.withValues(alpha: 0.1),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _buildSection({required String title, required String subtitle, required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.raleway(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, {String? hint, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          enabled: _isEditing,
          maxLines: maxLines,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white24),
            filled: true,
            fillColor: _isEditing ? const Color(0xFF141C2F) : Colors.white.withValues(alpha: 0.02),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF10B981))),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildReadonlyField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.02), borderRadius: BorderRadius.circular(10)),
          child: Text(value, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14)),
        ),
      ],
    );
  }

  Widget _buildFieldWithPrefix({required String label, required TextEditingController controller, required String prefix, required String hint}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          enabled: _isEditing,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            prefixText: prefix,
            prefixStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 14),
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white24),
            filled: true,
            fillColor: _isEditing ? const Color(0xFF141C2F) : Colors.white.withValues(alpha: 0.02),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF10B981))),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildToggle(String label, bool value, ValueChanged<bool> onChanged) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
        Switch(
          value: value,
          onChanged: _isEditing ? onChanged : null,
          activeThumbColor: const Color(0xFF10B981),
          inactiveThumbColor: Colors.white38,
          inactiveTrackColor: Colors.white10,
        ),
      ],
    );
  }
}


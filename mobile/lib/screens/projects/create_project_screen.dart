import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';

Color parseColor(String hex) {
  try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
  catch (_) { return const Color(0xFFF59E0B); }
}

class CreateProjectScreen extends StatefulWidget {
  const CreateProjectScreen({super.key});

  @override
  State<CreateProjectScreen> createState() => _CreateProjectScreenState();
}

class _CreateProjectScreenState extends State<CreateProjectScreen> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _linkCtrl = TextEditingController();
  bool _isLoading = false;

  final _colors = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#38BDF8', '#EC4899', '#14B8A6'];

  InputDecoration _inputDec(String hint) => InputDecoration(
    hintText: hint, hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
    filled: true, fillColor: Colors.white.withOpacity(0.05),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFF59E0B))),
  );

  Future<void> _createProject() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Project Name is required')));
      return;
    }

    setState(() => _isLoading = true);

    try {
      final uid = FirebaseAuth.instance.currentUser!;
      final db = FirebaseFirestore.instance;
      final ref = db.collection('projects').doc();
      final randomColor = _colors[DateTime.now().millisecondsSinceEpoch % _colors.length];

      await ref.set({
        'id': ref.id, 
        'name': _nameCtrl.text.trim(), 
        'description': _descCtrl.text.trim(),
        'ownerId': uid.uid, 
        'liveUrl': _linkCtrl.text.trim().isNotEmpty ? _linkCtrl.text.trim() : null, 
        'status': 'active', 
        'color': randomColor,
        'completionPercentage': 0,
        'members': { uid.uid: { 'role': 'admin', 'displayName': uid.displayName, 'photoURL': uid.photoURL, 'email': uid.email, 'joinedAt': FieldValue.serverTimestamp() }},
        'github': {'connected': false},
        'stats': {'totalTasks': 0, 'completedTasks': 0, 'inProgressTasks': 0, 'pendingTasks': 0, 'totalCommits': 0, 'totalMembers': 1},
        'createdAt': FieldValue.serverTimestamp(), 
        'updatedAt': FieldValue.serverTimestamp(),
      });
      await db.doc('users/${uid.uid}').update({'projectIds': FieldValue.arrayUnion([ref.id])});
      
      if (mounted) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Project created successfully!')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: Text('New Project', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Kickoff something awesome!', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14)),
            const SizedBox(height: 32),

            Text('Project Details', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
            const SizedBox(height: 16),
            TextField(controller: _nameCtrl, style: const TextStyle(color: Colors.white), decoration: _inputDec('Project Name')),
            const SizedBox(height: 16),
            TextField(controller: _descCtrl, style: const TextStyle(color: Colors.white), maxLines: 3, decoration: _inputDec('Description (optional)')),
            const SizedBox(height: 16),
            TextField(controller: _linkCtrl, style: const TextStyle(color: Colors.white), keyboardType: TextInputType.url, decoration: _inputDec('Live Link (optional)')),
            
            const SizedBox(height: 48),

            SizedBox(
              width: double.infinity, 
              height: 54,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _createProject,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B), 
                  foregroundColor: Colors.white, 
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
                ),
                child: _isLoading 
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Create Project', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
          ],
        ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.1),
      ),
    );
  }
}

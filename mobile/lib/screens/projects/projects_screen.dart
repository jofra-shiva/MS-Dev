import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final db = FirebaseFirestore.instance;

    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('MSDEV', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          Text('Your Projects', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.4), fontWeight: FontWeight.w400)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Colors.white),
            onPressed: () => _showCreateDialog(context),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: db.collection('projects')
          .where('members.$uid.role', whereIn: ['admin', 'member', 'viewer'])
          .snapshots(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return _buildShimmer();
          }
          final docs = snap.data?.docs ?? [];
          if (docs.isEmpty) {
            return _buildEmpty(context);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: docs.length,
            itemBuilder: (ctx, i) {
              final p = docs[i].data() as Map<String, dynamic>;
              final color = _parseColor(p['color'] ?? '#6366F1');
              return _ProjectCard(
                id: docs[i].id, data: p, color: color,
                onTap: () => context.go('/projects/${docs[i].id}'),
              ).animate().fadeIn(delay: Duration(milliseconds: i * 60)).slideY(begin: 0.2);
            },
          );
        },
      ),
    );
  }

  Color _parseColor(String hex) {
    try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
    catch (_) { return const Color(0xFF6366F1); }
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.rocket_launch_outlined, size: 64, color: Color(0xFF6366F1)),
        const SizedBox(height: 16),
        Text('No projects yet', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
        const SizedBox(height: 8),
        Text('Create your first project to get started', style: TextStyle(color: Colors.white.withOpacity(0.4))),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () => _showCreateDialog(context),
          icon: const Icon(Icons.add),
          label: const Text('Create Project'),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1), foregroundColor: Colors.white),
        ),
      ]),
    );
  }

  Widget _buildShimmer() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 4,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Shimmer.fromColors(
          baseColor: const Color(0xFF161B2E),
          highlightColor: const Color(0xFF1E2740),
          child: Container(height: 130, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12))),
        ),
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0D1117),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('New Project', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 20),
          TextField(controller: nameCtrl, style: const TextStyle(color: Colors.white), decoration: _inputDec('Project Name')),
          const SizedBox(height: 12),
          TextField(controller: descCtrl, style: const TextStyle(color: Colors.white), maxLines: 2, decoration: _inputDec('Description (optional)')),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity, height: 48,
            child: ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty) return;
                final uid = FirebaseAuth.instance.currentUser!;
                final db = FirebaseFirestore.instance;
                final ref = db.collection('projects').doc();
                await ref.set({
                  'id': ref.id, 'name': nameCtrl.text.trim(), 'description': descCtrl.text.trim(),
                  'ownerId': uid.uid, 'taskPrefix': 'TASK', 'status': 'active', 'color': '#6366F1',
                  'completionPercentage': 0,
                  'members': { uid.uid: { 'role': 'admin', 'displayName': uid.displayName, 'photoURL': uid.photoURL, 'email': uid.email, 'joinedAt': FieldValue.serverTimestamp() }},
                  'github': {'connected': false},
                  'stats': {'totalTasks': 0, 'completedTasks': 0, 'inProgressTasks': 0, 'pendingTasks': 0, 'totalCommits': 0, 'totalMembers': 1},
                  'createdAt': FieldValue.serverTimestamp(), 'updatedAt': FieldValue.serverTimestamp(),
                });
                await db.doc('users/${uid.uid}').update({'projectIds': FieldValue.arrayUnion([ref.id])});
                if (ctx.mounted) Navigator.pop(ctx);
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
              child: const Text('Create Project', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    );
  }

  InputDecoration _inputDec(String hint) => InputDecoration(
    hintText: hint, hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
    filled: true, fillColor: Colors.white.withOpacity(0.05),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF6366F1))),
  );
}

class _ProjectCard extends StatelessWidget {
  final String id;
  final Map<String, dynamic> data;
  final Color color;
  final VoidCallback onTap;
  const _ProjectCard({required this.id, required this.data, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final pct = (data['completionPercentage'] ?? 0).toDouble();
    final stats = data['stats'] as Map<String, dynamic>? ?? {};

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(14),
          border: Border(left: BorderSide(color: color, width: 4)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(data['name'] ?? '', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.12), borderRadius: BorderRadius.circular(99)),
                child: Text(data['status'] ?? 'active', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF10B981)))),
            ]),
            if (data['description']?.isNotEmpty == true) ...[
              const SizedBox(height: 6),
              Text(data['description'] ?? '', style: TextStyle(fontSize: 12.5, color: Colors.white.withOpacity(0.4), height: 1.4), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            const SizedBox(height: 14),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('${pct.round()}% complete', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
              Text('${stats['completedTasks'] ?? 0}/${stats['totalTasks'] ?? 0} tasks', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
            ]),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: pct / 100, minHeight: 4,
                backgroundColor: Colors.white.withOpacity(0.08),
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

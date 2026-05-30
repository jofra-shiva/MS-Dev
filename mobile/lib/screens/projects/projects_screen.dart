import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';

Color parseColor(String hex) {
  try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
  catch (_) { return const Color(0xFFF59E0B); }
}

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final db = FirebaseFirestore.instance;
    final user = FirebaseAuth.instance.currentUser;
    final email = user?.email ?? '';
    final isSuperAdmin = email == 'shivaprakash3115@gmail.com';
    final initials = (user?.displayName ?? 'U').isNotEmpty ? (user?.displayName ?? 'U')[0].toUpperCase() : 'U';

    // Super admin sees ALL projects; others see only their own
    final projectsStream = isSuperAdmin
        ? db.collection('projects').snapshots()
        : db.collection('projects').where('members.$uid.role', whereIn: ['admin', 'member', 'viewer']).snapshots();

    return Scaffold(
      body: StreamBuilder<QuerySnapshot>(
        stream: projectsStream,
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
              final color = parseColor(p['color'] ?? '#6366F1');
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

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.rocket_launch_outlined, size: 64, color: Color(0xFFF59E0B)),
        const SizedBox(height: 16),
        Text('No projects yet', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
        const SizedBox(height: 8),
        Text('Create your first project to get started', style: TextStyle(color: Colors.white.withOpacity(0.4))),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () => context.push('/create-project'),
          icon: const Icon(Icons.add),
          label: const Text('Create Project'),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white),
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
}

class _ProjectCard extends StatelessWidget {
  final String id;
  final Map<String, dynamic> data;
  final Color color;
  final VoidCallback onTap;
  const _ProjectCard({required this.id, required this.data, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('projects/$id/tasks').snapshots(),
        builder: (context, taskSnap) {
          int totalTasks = 0;
          int completedTasks = 0;
          
          if (taskSnap.hasData) {
            final tasks = taskSnap.data!.docs;
            totalTasks = tasks.length;
            for (var doc in tasks) {
              final status = (doc.data() as Map)['status'];
              if (status == 'completed' || status == 'deployed' || status == 'github_pushed') {
                completedTasks++;
              }
            }
          } else {
            final stats = data['stats'] as Map<String, dynamic>? ?? {};
            totalTasks = stats['totalTasks'] ?? 0;
            completedTasks = stats['completedTasks'] ?? 0;
          }

          final pct = totalTasks == 0 ? 0.0 : (completedTasks / totalTasks) * 100.0;

          return Container(
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
                  Expanded(child: Text(data['name'] ?? '', style: GoogleFonts.raleway(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
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
                  Text('$completedTasks/$totalTasks tasks', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
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
          );
        }
      ),
    );
  }
}

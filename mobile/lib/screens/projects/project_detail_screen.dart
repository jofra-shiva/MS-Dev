import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ProjectDetailScreen extends StatelessWidget {
  final String projectId;
  const ProjectDetailScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance.doc('projects/$projectId').snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF6366F1))));
        final p = snap.data!.data() as Map<String, dynamic>? ?? {};
        final stats = p['stats'] as Map<String, dynamic>? ?? {};
        final members = p['members'] as Map<String, dynamic>? ?? {};
        final pct = (p['completionPercentage'] ?? 0).toDouble();

        return Scaffold(
          appBar: AppBar(
            title: Text(p['name'] ?? 'Project', style: GoogleFonts.inter(fontWeight: FontWeight.w800)),
            leading: IconButton(icon: const Icon(Icons.arrow_back_ios), onPressed: () => context.go('/')),
            actions: [
              IconButton(icon: const Icon(Icons.view_kanban_outlined), tooltip: 'Kanban', onPressed: () => context.go('/projects/$projectId/kanban')),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Stats Row
              Row(children: [
                _StatBox(value: '${stats['totalTasks'] ?? 0}', label: 'Total', color: const Color(0xFF6366F1)),
                const SizedBox(width: 10),
                _StatBox(value: '${stats['completedTasks'] ?? 0}', label: 'Done', color: const Color(0xFF10B981)),
                const SizedBox(width: 10),
                _StatBox(value: '${stats['inProgressTasks'] ?? 0}', label: 'Active', color: const Color(0xFFF59E0B)),
                const SizedBox(width: 10),
                _StatBox(value: '${members.length}', label: 'Members', color: const Color(0xFF3B82F6)),
              ].map((w) => Expanded(child: w)).toList()),
              const SizedBox(height: 20),

              // Completion
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(12)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text('Completion', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                    Text('${pct.round()}%', style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.w800, fontSize: 16)),
                  ]),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(value: pct / 100, minHeight: 8, backgroundColor: Colors.white.withOpacity(0.08), valueColor: const AlwaysStoppedAnimation(Color(0xFF6366F1))),
                  ),
                ]),
              ).animate().fadeIn(delay: 200.ms),
              const SizedBox(height: 20),

              // GitHub status
              if (p['github']?['connected'] == true)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.08), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFF10B981).withOpacity(0.2))),
                  child: Row(children: [
                    const Icon(Icons.flash_on, color: Color(0xFF10B981), size: 20),
                    const SizedBox(width: 10),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('GitHub Connected', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w700, fontSize: 13)),
                      Text('${p['github']['repoOwner']}/${p['github']['repoName']}', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
                    ]),
                  ]),
                ).animate().fadeIn(delay: 300.ms),

              const SizedBox(height: 20),
              // Recent Tasks
              Text('Recent Tasks', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white)),
              const SizedBox(height: 10),
              StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance.collection('projects/$projectId/tasks').orderBy('createdAt', descending: true).limit(10).snapshots(),
                builder: (ctx, tSnap) {
                  final tasks = tSnap.data?.docs ?? [];
                  if (tasks.isEmpty) return Padding(padding: const EdgeInsets.all(20), child: Center(child: Text('No tasks yet', style: TextStyle(color: Colors.white.withOpacity(0.3)))));
                  return Column(
                    children: tasks.asMap().entries.map((e) {
                      final t = e.value.data() as Map<String, dynamic>;
                      return _TaskTile(task: t).animate().fadeIn(delay: Duration(milliseconds: e.key * 40));
                    }).toList(),
                  );
                },
              ),
            ]),
          ),
        );
      },
    );
  }
}

class _StatBox extends StatelessWidget {
  final String value, label;
  final Color color;
  const _StatBox({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4))),
      ]),
    );
  }
}

class _TaskTile extends StatelessWidget {
  final Map<String, dynamic> task;
  const _TaskTile({required this.task});

  @override
  Widget build(BuildContext context) {
    final statusColors = {'pending': const Color(0xFF475569), 'in_progress': const Color(0xFFF59E0B), 'testing': const Color(0xFF3B82F6), 'completed': const Color(0xFF10B981)};
    final color = statusColors[task['status']] ?? const Color(0xFF475569);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(10),
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(task['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
          if (task['assigneeName'] != null) Text(task['assigneeName'], style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
        ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
          child: Text((task['status'] ?? '').toString().replaceAll('_', ' '), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color))),
      ]),
    );
  }
}

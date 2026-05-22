import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';

class KanbanScreen extends StatelessWidget {
  final String projectId;
  const KanbanScreen({super.key, required this.projectId});

  static const columns = [
    {'id': 'pending', 'label': 'Pending', 'emoji': '📌', 'color': 0xFF475569},
    {'id': 'in_progress', 'label': 'In Progress', 'emoji': '🔄', 'color': 0xFFF59E0B},
    {'id': 'testing', 'label': 'Testing', 'emoji': '🧪', 'color': 0xFF3B82F6},
    {'id': 'completed', 'label': 'Completed', 'emoji': '✅', 'color': 0xFF10B981},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('A to Z', style: GoogleFonts.raleway(fontWeight: FontWeight.w800))),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('projects/$projectId/tasks').snapshots(),
        builder: (context, snap) {
          final tasks = snap.data?.docs.map((d) => {...(d.data() as Map), 'id': d.id}).toList() ?? [];
          return ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(16),
            children: columns.map((col) {
              final colTasks = tasks.where((t) => t['status'] == col['id']).toList();
              return Container(
                width: 260,
                margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1117),
                  borderRadius: BorderRadius.circular(12),
                  border: Border(top: BorderSide(color: Color(col['color'] as int), width: 3)),
                ),
                child: Column(children: [
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Text(col['emoji'] as String, style: const TextStyle(fontSize: 16)),
                      const SizedBox(width: 8),
                      Text(col['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: Color(col['color'] as int).withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
                        child: Text('${colTasks.length}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(col['color'] as int))),
                      ),
                    ]),
                  ),
                  const Divider(height: 1, color: Color(0xFF1E2D47)),
                  Expanded(
                    child: colTasks.isEmpty
                      ? Center(child: Text('No tasks', style: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 12)))
                      : ListView.builder(
                        padding: const EdgeInsets.all(10),
                        itemCount: colTasks.length,
                        itemBuilder: (ctx, i) {
                          final t = colTasks[i];
                          final priorityColors = {'low': 0xFF475569, 'medium': 0xFF3B82F6, 'high': 0xFFF59E0B, 'urgent': 0xFFEF4444};
                          final pc = Color(priorityColors[t['priority']] ?? 0xFF475569);
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF161B2E),
                              borderRadius: BorderRadius.circular(8),
                              border: Border(left: BorderSide(color: pc, width: 3)),
                            ),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(t['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Colors.white), maxLines: 2),
                              if (t['assigneeName'] != null) ...[
                                const SizedBox(height: 6),
                                Text(t['assigneeName'], style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
                              ],
                              if ((t['progress'] ?? 0) > 0) ...[
                                const SizedBox(height: 8),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(99),
                                  child: LinearProgressIndicator(value: ((t['progress'] ?? 0) as num) / 100, minHeight: 3, backgroundColor: Colors.white.withOpacity(0.08), valueColor: const AlwaysStoppedAnimation(Color(0xFF6366F1))),
                                ),
                              ],
                            ]),
                          ).animate().fadeIn(delay: Duration(milliseconds: i * 50));
                        },
                      ),
                  ),
                ]),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

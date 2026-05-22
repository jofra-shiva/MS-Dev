import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'task_detail_bottom_sheet.dart';

import 'create_task_bottom_sheet.dart';

class KanbanScreen extends StatefulWidget {
  final String projectId;
  const KanbanScreen({super.key, required this.projectId});

  @override
  State<KanbanScreen> createState() => _KanbanScreenState();
}

class _KanbanScreenState extends State<KanbanScreen> {
  String _selectedMeetingId = 'all';

  static const columns = [
    {'id': 'pending', 'label': 'Pending', 'emoji': '📌', 'color': 0xFF475569},
    {'id': 'in_progress', 'label': 'In Progress', 'emoji': '🔄', 'color': 0xFFF59E0B},
    {'id': 'testing', 'label': 'Testing', 'emoji': '🧪', 'color': 0xFF3B82F6},
    {'id': 'completed', 'label': 'Completed', 'emoji': '✅', 'color': 0xFF10B981},
    {'id': 'github_pushed', 'label': 'GitHub', 'emoji': '🐙', 'color': 0xFF8B5CF6},
    {'id': 'deployed', 'label': 'Deployed', 'emoji': '🚀', 'color': 0xFFEC4899},
  ];

  void _showCreateTaskBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CreateTaskBottomSheet(
        projectId: widget.projectId,
        initialMeetingId: _selectedMeetingId,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white), 
          onPressed: () => context.canPop() ? context.pop() : context.go('/projects/${widget.projectId}'),
        ),
        title: Row(
          children: [
            Text('A to Z', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
            const SizedBox(width: 12),
            Expanded(
              child: StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance.collection('projects/${widget.projectId}/meetings').orderBy('createdAt', descending: true).snapshots(),
                builder: (context, snap) {
                  final meetings = snap.data?.docs ?? [];
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withOpacity(0.8), width: 1.5),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedMeetingId,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1E293B),
                        icon: const Icon(Icons.arrow_drop_down, color: Colors.white70),
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                        items: [
                          const DropdownMenuItem(value: 'all', child: Text('All Meetings')),
                          ...meetings.map((m) {
                            final title = (m.data() as Map)['name'] ?? (m.data() as Map)['title'] ?? 'Meeting';
                            return DropdownMenuItem(
                              value: m.id,
                              child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            );
                          }),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedMeetingId = val);
                        },
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle, color: Color(0xFF10B981)),
            onPressed: () => _showCreateTaskBottomSheet(context),
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks').snapshots(),
        builder: (context, snap) {
          final tasks = snap.data?.docs.map((d) => {...(d.data() as Map<String, dynamic>), 'id': d.id}).where((t) {
            if (_selectedMeetingId == 'all') return true;
            return t['meetingId'] == _selectedMeetingId;
          }).toList() ?? [];
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
                    child: DragTarget<Map<String, dynamic>>(
                      onAcceptWithDetails: (details) {
                        final draggedTask = details.data;
                        if (draggedTask['status'] != col['id']) {
                          FirebaseFirestore.instance.doc('projects/${widget.projectId}/tasks/${draggedTask['id']}').update({'status': col['id']});
                        }
                      },
                      builder: (context, candidateData, rejectedData) {
                        return Container(
                          color: candidateData.isNotEmpty ? Colors.white.withOpacity(0.02) : Colors.transparent,
                          child: colTasks.isEmpty
                            ? Center(child: Text('No tasks', style: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 12)))
                            : ListView.builder(
                              padding: const EdgeInsets.only(top: 10, left: 10, right: 10, bottom: 100),
                              itemCount: colTasks.length,
                              itemBuilder: (ctx, i) {
                                final t = colTasks[i] as Map<String, dynamic>;
                                return _buildDraggableTask(context, t).animate().fadeIn(delay: Duration(milliseconds: i * 50));
                              },
                            ),
                        );
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

  Widget _buildDraggableTask(BuildContext context, Map<String, dynamic> t) {
    final priorityColors = {'low': 0xFF475569, 'medium': 0xFF3B82F6, 'high': 0xFFF59E0B, 'urgent': 0xFFEF4444};
    final pc = Color(priorityColors[t['priority']] ?? 0xFF475569);
    final typeText = t['type'] == 'bug' ? 'Bug' : t['type'] == 'feature' ? 'Feat' : 'Imp';

    // GitHub Status
    final hasCommit = t['githubRef']?['lastCommitSha'] != null;
    final isComplete = t['status'] == 'completed' || t['status'] == 'deployed';
    String ghLabel = 'GitHub pending';
    Color ghColor = const Color(0xFF64748B);
    if (isComplete && hasCommit) { ghLabel = 'GitHub complete'; ghColor = const Color(0xFF10B981); }
    else if (hasCommit) { ghLabel = 'GitHub updated'; ghColor = const Color(0xFF38BDF8); }

    final completedBy = t['completedBy']?['name'] ?? t['lastMovedBy']?['name'] ?? 'Unassigned';
    
    String formatCardDate(dynamic val) {
      if (val == null) return '';
      if (val is Timestamp) return DateFormat('dd MMM').format(val.toDate());
      return '';
    }

    final dueDate = t['dueDate'] is Timestamp ? (t['dueDate'] as Timestamp).toDate() : null;
    final isOverdue = dueDate != null && dueDate.isBefore(DateTime.now()) && t['status'] != 'completed';

    final lastMovedBy = t['lastMovedBy'];
    final completedAt = t['completedAt'];

    final card = Container(
      width: 260,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF121827),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(typeText, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  Container(width: 6, height: 6, decoration: BoxDecoration(color: pc, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text((t['priority'] ?? 'low').toUpperCase(), style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                ],
              ),
              if (t['module'] != null && t['module'].toString().isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(99)),
                  child: Text(t['module'], style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 9)),
                ),
            ],
          ),
          const SizedBox(height: 10),

          Text(t['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Colors.white, height: 1.3), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 10,
                    backgroundColor: Colors.white.withOpacity(0.1),
                    backgroundImage: t['assigneePhoto'] != null && t['assigneePhoto'].toString().startsWith('http') ? NetworkImage(t['assigneePhoto']) : null,
                    child: t['assigneePhoto'] == null || !t['assigneePhoto'].toString().startsWith('http') 
                        ? Text((t['assigneeName'] ?? 'U').toString().substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.w700))
                        : null,
                  ),
                  if (t['tags'] != null && (t['tags'] as List).isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFF6366F1).withOpacity(0.1), borderRadius: BorderRadius.circular(99)),
                      child: Text('#${t['tags'][0]}', style: const TextStyle(color: Color(0xFF6366F1), fontSize: 9)),
                    ),
                  ],
                ],
              ),
              Row(
                children: [
                  if (t['meetingId'] != null) const Padding(padding: EdgeInsets.only(left: 6), child: Text('📅', style: TextStyle(fontSize: 10))),
                  if (hasCommit) const Padding(padding: EdgeInsets.only(left: 6), child: Text('⚡', style: TextStyle(color: Color(0xFF10B981), fontSize: 10))),
                  if (dueDate != null) Padding(padding: const EdgeInsets.only(left: 6), child: Icon(Icons.calendar_month, size: 12, color: isOverdue ? Colors.red : Colors.white.withOpacity(0.5))),
                ],
              ),
            ],
          ),
          
          if ((t['progress'] ?? 0) > 0) ...[
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Progress', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4))),
              Text('${t['progress']}%', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4))),
            ]),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(value: ((t['progress'] ?? 0) as num) / 100, minHeight: 3, backgroundColor: Colors.white.withOpacity(0.08), valueColor: const AlwaysStoppedAnimation(Color(0xFF6366F1))),
            ),
          ],

          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05), style: BorderStyle.solid))),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('COMPLETED BY', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4), fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    Text(isComplete ? completedBy : 'Not complete', style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.9), fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('GITHUB', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4), fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: ghColor.withOpacity(0.1), borderRadius: BorderRadius.circular(99)),
                      child: Text(ghLabel, style: TextStyle(color: ghColor, fontSize: 9, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (lastMovedBy != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05), style: BorderStyle.solid))),
              child: Row(
                children: [
                  Text('Updated by:', style: TextStyle(fontSize: 9, fontStyle: FontStyle.italic, color: Colors.white.withOpacity(0.4))),
                  const SizedBox(width: 6),
                  CircleAvatar(
                    radius: 7,
                    backgroundColor: Colors.white.withOpacity(0.1),
                    backgroundImage: lastMovedBy['photo'] != null && lastMovedBy['photo'].toString().startsWith('http') ? NetworkImage(lastMovedBy['photo']) : null,
                    child: lastMovedBy['photo'] == null || !lastMovedBy['photo'].toString().startsWith('http') 
                        ? Text((lastMovedBy['name'] ?? 'U').toString().substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 6, color: Colors.white))
                        : null,
                  ),
                  const SizedBox(width: 4),
                  Text(lastMovedBy['name'] ?? 'Unknown', style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.8), fontWeight: FontWeight.w500)),
                  if (lastMovedBy['date'] != null) Text(' · ${formatCardDate(lastMovedBy['date'])}', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4))),
                ],
              ),
            ),
          ],

          if (t['completedBy'] != null || completedAt != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05), style: BorderStyle.solid))),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Completed', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4))),
                  Text('${t['completedBy']?['name'] ?? '—'}${completedAt != null ? ' · ${formatCardDate(completedAt)}' : ''}', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.8))),
                ],
              ),
            ),
          ],
        ],
      ),
    );

    return LongPressDraggable<Map<String, dynamic>>(
      data: t,
      delay: const Duration(milliseconds: 200),
      feedback: Material(
        color: Colors.transparent,
        child: Opacity(
          opacity: 0.9,
          child: Transform.rotate(
            angle: 0.02,
            child: card,
          ),
        ),
      ),
      childWhenDragging: Opacity(opacity: 0.2, child: card),
      child: GestureDetector(
        onTap: () => _showTaskDetails(context, t, pc),
        child: card,
      ),
    );
  }

  void _showTaskDetails(BuildContext context, Map<String, dynamic> t, Color pc) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TaskDetailBottomSheet(
        projectId: widget.projectId,
        task: t,
        priorityColor: pc,
      ),
    );
  }
}

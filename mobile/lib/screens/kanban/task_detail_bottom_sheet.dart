import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:msdev_mobile/screens/kanban/create_task_bottom_sheet.dart';

class TaskDetailBottomSheet extends StatefulWidget {
  final String projectId;
  final Map<String, dynamic> task;
  final Color priorityColor;

  const TaskDetailBottomSheet({
    super.key,
    required this.projectId,
    required this.task,
    required this.priorityColor,
  });

  @override
  State<TaskDetailBottomSheet> createState() => _TaskDetailBottomSheetState();
}

class _TaskDetailBottomSheetState extends State<TaskDetailBottomSheet> {
  final TextEditingController _commentController = TextEditingController();

  String _formatDate(dynamic val) {
    if (val == null) return '—';
    if (val is Timestamp) return DateFormat('dd/MM/yyyy - hh:mm a').format(val.toDate());
    return '—';
  }

  String _timeAgo(dynamic val) {
    if (val == null) return '—';
    if (val is Timestamp) {
      final diff = DateTime.now().difference(val.toDate());
      if (diff.inDays > 0) return '${diff.inDays} days ago';
      if (diff.inHours > 0) return 'about ${diff.inHours} hours ago';
      if (diff.inMinutes > 0) return '${diff.inMinutes} minutes ago';
      return 'just now';
    }
    return '—';
  }

  void _addComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    // Fetch user profile info
    final userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
    final userData = userDoc.data() ?? {};

    await FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks/${widget.task['id']}/comments').add({
      'text': text,
      'createdAt': FieldValue.serverTimestamp(),
      'createdBy': {
        'id': user.uid,
        'name': userData['name'] ?? user.displayName ?? 'User',
        'photo': userData['photoURL'] ?? user.photoURL,
      }
    });

    _commentController.clear();
    FocusScope.of(context).unfocus();
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: TextStyle(color: const Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
    );
  }

  Widget _buildAuditRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
          Text(value, style: TextStyle(color: isHighlight ? Colors.white : const Color(0xFFE2E8F0), fontSize: 13, fontWeight: isHighlight ? FontWeight.w600 : FontWeight.normal)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.task;
    final typeText = t['type'] == 'bug' ? 'Bug' : t['type'] == 'feature' ? 'Feat' : 'Imp';
    final isComplete = t['status'] == 'completed' || t['status'] == 'deployed';
    final completedBy = t['completedBy']?['name'] ?? t['lastMovedBy']?['name'] ?? 'Unassigned';

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.93,
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
        children: [
          // Header Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 16, 12),
            child: Row(
              children: [
                Expanded(child: Text(t['title'] ?? '', style: GoogleFonts.raleway(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white))),
                const SizedBox(width: 12),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, color: Colors.white54),
                  onPressed: () {
                    Navigator.pop(context);
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (ctx) => CreateTaskBottomSheet(
                        projectId: widget.projectId,
                        initialMeetingId: t['meetingId'] ?? 'none',
                        initialTask: t,
                      ),
                    );
                  },
                  style: IconButton.styleFrom(backgroundColor: Colors.white.withOpacity(0.05)),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(context),
                  style: IconButton.styleFrom(backgroundColor: Colors.white.withOpacity(0.05)),
                )
              ],
            ),
          ),

          // Badges
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(99)),
                  child: Text((t['status'] ?? 'pending').toString().toUpperCase().replaceAll('_', ' '), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: widget.priorityColor.withOpacity(0.2), borderRadius: BorderRadius.circular(99)),
                  child: Text((t['priority'] ?? 'low').toString().toUpperCase(), style: TextStyle(color: widget.priorityColor, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(border: Border.all(color: Colors.white.withOpacity(0.2)), borderRadius: BorderRadius.circular(99)),
                  child: Text(typeText, style: const TextStyle(color: Colors.white, fontSize: 10)),
                ),
                if (t['module'] != null && t['module'].toString().isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(99)),
                    child: Text('Module: ${t['module']}', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 10)),
                  ),
              ],
            ),
          ),
          
          const Divider(color: Colors.white10, height: 32),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Main Content & Sidebar (Stacked for mobile)
                  
                  // DESCRIPTION
                  _buildSectionTitle('DESCRIPTION'),
                  Text(t['description']?.isNotEmpty == true ? t['description'] : 'No description provided.', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14, height: 1.5)),
                  const SizedBox(height: 24),

                  // PROGRESS
                  _buildSectionTitle('PROGRESS — ${t['progress'] ?? 0}%'),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(value: ((t['progress'] ?? 0) as num) / 100, minHeight: 6, backgroundColor: Colors.white.withOpacity(0.05), valueColor: const AlwaysStoppedAnimation(Color(0xFF3B82F6))),
                  ),
                  const SizedBox(height: 32),

                  // ASSIGNEE
                  _buildSectionTitle('ASSIGNEE'),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: const Color(0xFFE11D48),
                        backgroundImage: t['assigneePhoto'] != null && t['assigneePhoto'].toString().startsWith('http') ? NetworkImage(t['assigneePhoto']) : null,
                        child: t['assigneePhoto'] == null || !t['assigneePhoto'].toString().startsWith('http') 
                            ? Text((t['assigneeName'] ?? 'U').toString().substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold))
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Text(t['assigneeName'] ?? 'Unassigned', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // DUE DATE & MEETING
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSectionTitle('DUE DATE'),
                            Text(t['dueDate'] != null ? DateFormat('dd MMM yyyy').format((t['dueDate'] as Timestamp).toDate()) : '—', style: const TextStyle(color: Colors.white, fontSize: 14)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSectionTitle('MEETING'),
                            t['meetingId'] != null 
                              ? Row(children: const [Icon(Icons.calendar_month, color: Color(0xFF6366F1), size: 16), SizedBox(width: 6), Text('Scheduled', style: TextStyle(color: Colors.white, fontSize: 14))])
                              : const Text('—', style: TextStyle(color: Colors.white, fontSize: 14)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // CREATED & TAGS
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSectionTitle('CREATED'),
                            Text(_timeAgo(t['createdAt']), style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSectionTitle('TAGS'),
                            Text((t['tags'] != null && (t['tags'] as List).isNotEmpty) ? (t['tags'] as List).join(', ') : 'None', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // AUDIT TRAIL
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.03), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white.withOpacity(0.05))),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionTitle('AUDIT TRAIL'),
                        const SizedBox(height: 8),
                        _buildAuditRow('Created', _formatDate(t['createdAt'])),
                        _buildAuditRow('Last updated', _formatDate(t['lastMovedBy']?['date'] ?? t['createdAt'])),
                        _buildAuditRow('Updated by', t['lastMovedBy']?['name'] ?? '—', isHighlight: true),
                        _buildAuditRow('Completed', _formatDate(t['completedAt'])),
                        _buildAuditRow('Completed by', isComplete ? completedBy : '—'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // COMMENTS
                  StreamBuilder<QuerySnapshot>(
                    stream: FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks/${t['id']}/comments').orderBy('createdAt', descending: true).snapshots(),
                    builder: (context, snapshot) {
                      final comments = snapshot.data?.docs ?? [];
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildSectionTitle('COMMENTS (${comments.length})'),
                          const SizedBox(height: 16),
                          
                          // Comment List
                          if (comments.isNotEmpty)
                            ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: comments.length,
                              itemBuilder: (context, index) {
                                final comment = comments[index].data() as Map<String, dynamic>;
                                final cBy = comment['createdBy'] ?? {};
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 20),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      CircleAvatar(
                                        radius: 14,
                                        backgroundColor: Colors.white.withOpacity(0.1),
                                        backgroundImage: cBy['photo'] != null && cBy['photo'].toString().startsWith('http') ? NetworkImage(cBy['photo']) : null,
                                        child: cBy['photo'] == null || !cBy['photo'].toString().startsWith('http') 
                                            ? Text((cBy['name'] ?? 'U').toString().substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white))
                                            : null,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Text(cBy['name'] ?? 'User', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                                                const SizedBox(width: 8),
                                                Text(_timeAgo(comment['createdAt']), style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
                                              ],
                                            ),
                                            const SizedBox(height: 6),
                                            Container(
                                              padding: const EdgeInsets.all(12),
                                              decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
                                              child: Text(comment['text'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 14)),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),

                          // Comment Input
                          Container(
                            margin: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom > 0 ? MediaQuery.of(context).padding.bottom + 16 : 30, top: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(color: Colors.transparent, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white.withOpacity(0.1))),
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _commentController,
                                    style: const TextStyle(color: Colors.white, fontSize: 14),
                                    decoration: InputDecoration(
                                      hintText: 'Add a comment...',
                                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                                      border: InputBorder.none,
                                    ),
                                  ),
                                ),
                                GestureDetector(
                                  onTap: _addComment,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(8)),
                                    child: const Text('Send', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    }
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      ),
    );
  }
}

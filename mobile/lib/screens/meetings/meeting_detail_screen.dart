import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class MeetingDetailScreen extends StatefulWidget {
  final String projectId;
  final String meetingId;
  const MeetingDetailScreen({super.key, required this.projectId, required this.meetingId});

  @override
  State<MeetingDetailScreen> createState() => _MeetingDetailScreenState();
}

class _MeetingDetailScreenState extends State<MeetingDetailScreen> {
  final _notesCtrl = TextEditingController();
  bool _notesEditing = false;
  bool _notesSaving = false;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveNotes(String meetingTitle) async {
    setState(() => _notesSaving = true);
    await FirebaseFirestore.instance
        .doc('projects/${widget.projectId}/meetings/${widget.meetingId}')
        .update({'notes': _notesCtrl.text.trim()});
    if (mounted) setState(() { _notesSaving = false; _notesEditing = false; });
  }

  Future<void> _markCompleted() async {
    await FirebaseFirestore.instance
        .doc('projects/${widget.projectId}/meetings/${widget.meetingId}')
        .update({'status': 'completed'});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Meeting marked as completed')),
      );
    }
  }

  Future<void> _deleteMeeting() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Delete Meeting', style: TextStyle(color: Colors.white)),
        content: const Text('Are you sure you want to delete this meeting?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delete', style: TextStyle(color: Colors.redAccent))),
        ],
      )
    );
    if (confirm != true) return;

    await FirebaseFirestore.instance.doc('projects/${widget.projectId}/meetings/${widget.meetingId}').delete();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Meeting deleted')));
      context.pop();
    }
  }

  Future<void> _editMeeting(Map<String, dynamic> m) async {
    final titleCtrl = TextEditingController(text: m['title'] as String? ?? m['name'] as String? ?? '');
    final linkCtrl = TextEditingController(text: m['link'] as String? ?? '');

    final result = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Edit Meeting', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: titleCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Meeting Name', labelStyle: TextStyle(color: Colors.white54))),
            const SizedBox(height: 12),
            TextField(controller: linkCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Meeting Link', labelStyle: TextStyle(color: Colors.white54))),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save', style: TextStyle(color: Color(0xFF10B981)))),
        ],
      )
    );

    if (result == true) {
      await FirebaseFirestore.instance.doc('projects/${widget.projectId}/meetings/${widget.meetingId}').update({
        'title': titleCtrl.text.trim(),
        'name': titleCtrl.text.trim(),
        'link': linkCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Meeting updated')));
      }
    }
  }

  void _showAddTaskSheet(Map<String, dynamic> meetingData, Map<String, dynamic> members) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddTaskSheet(
        projectId: widget.projectId,
        meetingId: widget.meetingId,
        meetingTitle: meetingData['title'] as String? ?? 'Meeting',
        attendeeUids: List<String>.from(meetingData['attendees'] ?? []),
        members: members,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .doc('projects/${widget.projectId}/meetings/${widget.meetingId}')
          .snapshots(),
      builder: (context, meetingSnap) {
        if (!meetingSnap.hasData) {
          return const Scaffold(
            backgroundColor: Color(0xFF070B14),
            body: Center(child: MsDevLoader(color: Color(0xFFF59E0B))),
          );
        }

        final m = meetingSnap.data!.data() as Map<String, dynamic>? ?? {};
        final title = m['title'] as String? ?? 'Meeting';
        final scheduledAt = (m['scheduledAt'] as Timestamp?)?.toDate();
        final status = m['status'] as String? ?? 'upcoming';
        final agenda = m['agenda'] as String? ?? '';
        final notes = m['notes'] as String? ?? '';
        final attendeeUids = List<String>.from(m['attendees'] ?? []);
        final taskIds = List<String>.from(m['taskIds'] ?? []);

        // Sync notes controller on first load
        if (!_notesEditing && _notesCtrl.text != notes) {
          _notesCtrl.text = notes;
        }

        final statusColor = status == 'completed'
            ? const Color(0xFF10B981)
            : status == 'in_progress'
                ? const Color(0xFFF59E0B)
                : const Color(0xFF38BDF8);
        final statusLabel = status == 'completed'
            ? '✅ Completed'
            : status == 'in_progress'
                ? '🔄 In Progress'
                : '🗓 Upcoming';

        return StreamBuilder<DocumentSnapshot>(
          stream: FirebaseFirestore.instance.doc('projects/${widget.projectId}').snapshots(),
          builder: (context, projSnap) {
            final projectData = projSnap.data?.data() as Map<String, dynamic>? ?? {};
            final members = projectData['members'] as Map<String, dynamic>? ?? {};

            return Scaffold(
              backgroundColor: const Color(0xFF070B14),
              appBar: AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white),
                  onPressed: () => context.canPop() ? context.pop() : context.go('/projects/${widget.projectId}/meetings'),
                ),
                title: Text(title,
                    style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, color: Colors.white54, size: 20),
                    onPressed: () => _editMeeting(m),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                    onPressed: _deleteMeeting,
                  ),
                  if (status != 'completed')
                    TextButton(
                      onPressed: _markCompleted,
                      child: const Text('Complete', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                ],
              ),
              floatingActionButton: FloatingActionButton.extended(
                onPressed: () => _showAddTaskSheet(m, members),
                backgroundColor: const Color(0xFFF59E0B),
                icon: const Icon(Icons.add_task, color: Colors.white),
                label: Text('Add Task', style: GoogleFonts.raleway(fontWeight: FontWeight.w700, color: Colors.white)),
              ),
              body: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                children: [

                  // Header card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1117),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.05)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700)),
                          ),
                        ]),
                        if (scheduledAt != null) ...[
                          const SizedBox(height: 12),
                          Row(children: [
                            const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFFF59E0B)),
                            const SizedBox(width: 8),
                            Text(
                              DateFormat('EEEE, MMMM d, yyyy  ·  h:mm a').format(scheduledAt),
                              style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13, fontWeight: FontWeight.w500),
                            ),
                          ]),
                        ],
                        if (agenda.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Icon(Icons.notes_outlined, size: 14, color: Color(0xFF38BDF8)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(agenda, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13, height: 1.5)),
                            ),
                          ]),
                        ],
                        if (m['link'] != null && m['link'].toString().isNotEmpty) ...[
                          const SizedBox(height: 16),
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              side: const BorderSide(color: Color(0xFF1E293B)),
                              backgroundColor: Colors.white.withOpacity(0.02),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              minimumSize: const Size(double.infinity, 0),
                            ),
                            onPressed: () async {
                              final urlStr = m['link'] as String;
                              final url = Uri.parse(urlStr.startsWith('http') ? urlStr : 'https://$urlStr');
                              try {
                                await launchUrl(url, mode: LaunchMode.externalApplication);
                              } catch (e) {
                                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open link')));
                              }
                            },
                            icon: const Icon(Icons.language, color: Color(0xFF38BDF8), size: 16),
                            label: const Text('Join Meeting / Live Link', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 13, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                  ).animate().fadeIn(delay: 50.ms).slideY(begin: 0.1),

                  const SizedBox(height: 20),

                  // Attendees
                  _SectionHeader(title: 'Attendees', icon: Icons.people_outline, count: attendeeUids.length),
                  const SizedBox(height: 12),
                  if (attendeeUids.isEmpty)
                    _emptyNote('No attendees')
                  else
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0D1117),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white.withOpacity(0.05)),
                      ),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: attendeeUids.map((uid) {
                          final member = members[uid] as Map<String, dynamic>? ?? {};
                          final name = member['displayName'] as String? ?? 'User';
                          final photo = member['photoURL'] as String?;
                          return _AttendeeChip(name: name, photoUrl: photo);
                        }).toList(),
                      ),
                    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),

                  const SizedBox(height: 20),

                  // Notes section
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const _SectionHeader(title: 'Meeting Notes', icon: Icons.edit_note_outlined),
                    if (!_notesEditing)
                      GestureDetector(
                        onTap: () => setState(() => _notesEditing = true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: const Text('Edit', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      )
                    else
                      Row(children: [
                        GestureDetector(
                          onTap: () => setState(() { _notesCtrl.text = notes; _notesEditing = false; }),
                          child: const Text('Cancel', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: _notesSaving ? null : () => _saveNotes(title),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: _notesSaving
                                ? const SizedBox(width: 12, height: 12, child: MsDevLoader(small: true, color: Colors.white))
                                : const Text('Save', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ]),
                  ]),
                  const SizedBox(height: 12),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1117),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _notesEditing
                            ? const Color(0xFFF59E0B).withOpacity(0.4)
                            : Colors.white.withOpacity(0.05),
                      ),
                    ),
                    child: _notesEditing
                        ? TextField(
                            controller: _notesCtrl,
                            style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13, height: 1.6),
                            maxLines: null,
                            autofocus: true,
                            decoration: const InputDecoration.collapsed(
                              hintText: 'Write meeting notes, decisions, action items...',
                              hintStyle: TextStyle(color: Colors.white24, fontSize: 13),
                            ),
                          )
                        : notes.isEmpty
                            ? Text('Tap Edit to add meeting notes', style: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 13))
                            : Text(notes, style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 13, height: 1.6)),
                  ).animate().fadeIn(delay: 150.ms),

                  const SizedBox(height: 24),

                  // Action Items / Tasks
                  _SectionHeader(title: 'Action Items', icon: Icons.task_alt_outlined, count: taskIds.length),
                  const SizedBox(height: 12),
                  if (taskIds.isEmpty)
                    _emptyNote('No tasks yet — tap + Add Task to assign action items')
                  else
                    StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('projects/${widget.projectId}/tasks')
                          .where('meetingId', isEqualTo: widget.meetingId)
                          .snapshots(),
                      builder: (context, taskSnap) {
                        final tasks = taskSnap.data?.docs ?? [];
                        if (tasks.isEmpty) return _emptyNote('Loading tasks...');
                        return Column(
                          children: tasks.asMap().entries.map((e) {
                            final t = e.value.data() as Map<String, dynamic>;
                            return _ActionItemTile(task: t)
                                .animate()
                                .fadeIn(delay: Duration(milliseconds: e.key * 50))
                                .slideY(begin: 0.1);
                          }).toList(),
                        );
                      },
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _emptyNote(String text) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Center(
        child: Text(text, style: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 13), textAlign: TextAlign.center),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  final int? count;
  const _SectionHeader({required this.title, required this.icon, this.count});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, size: 16, color: Colors.white.withOpacity(0.5)),
      const SizedBox(width: 8),
      Text(title, style: GoogleFonts.raleway(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
      if (count != null) ...[
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.08),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text('$count', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5), fontWeight: FontWeight.w700)),
        ),
      ],
    ]);
  }
}

class _AttendeeChip extends StatelessWidget {
  final String name;
  final String? photoUrl;
  const _AttendeeChip({required this.name, this.photoUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        CircleAvatar(
          radius: 10,
          backgroundColor: const Color(0xFF1E2740),
          backgroundImage: photoUrl != null && photoUrl!.startsWith('http') ? NetworkImage(photoUrl!) : null,
          child: photoUrl == null || !photoUrl!.startsWith('http')
              ? Text(name.isNotEmpty ? name[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white))
              : null,
        ),
        const SizedBox(width: 6),
        Text(name.split(' ').first, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _ActionItemTile extends StatelessWidget {
  final Map<String, dynamic> task;
  const _ActionItemTile({required this.task});

  @override
  Widget build(BuildContext context) {
    final statusColors = {
      'pending': const Color(0xFF475569),
      'in_progress': const Color(0xFFF59E0B),
      'testing': const Color(0xFF38BDF8),
      'completed': const Color(0xFF10B981),
      'github_pushed': const Color(0xFF8B5CF6),
      'deployed': const Color(0xFFEC4899),
    };
    final priorityColors = {
      'low': const Color(0xFF10B981),
      'medium': const Color(0xFF38BDF8),
      'high': const Color(0xFFF59E0B),
      'urgent': const Color(0xFFEF4444),
    };

    final status = task['status'] as String? ?? 'pending';
    final priority = task['priority'] as String? ?? 'medium';
    final sColor = statusColors[status] ?? const Color(0xFF475569);
    final pColor = priorityColors[priority] ?? const Color(0xFF38BDF8);
    final assigneeName = task['assigneeName'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: sColor, width: 3)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(task['module'] as String? ?? task['title'] as String? ?? '',
                style: GoogleFonts.raleway(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white),
                maxLines: 2),
            if (assigneeName.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(children: [
                Icon(Icons.person_outline, size: 11, color: Colors.white.withOpacity(0.35)),
                const SizedBox(width: 4),
                Text(assigneeName, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
              ]),
            ],
          ]),
        ),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: pColor.withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
            child: Text(priority.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: pColor)),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: sColor.withOpacity(0.12), borderRadius: BorderRadius.circular(99)),
            child: Text(status.replaceAll('_', ' ').toUpperCase(),
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: sColor)),
          ),
        ]),
      ]),
    );
  }
}

// ─── Add Task Bottom Sheet ────────────────────────────────────────────────────

class _AddTaskSheet extends StatefulWidget {
  final String projectId;
  final String meetingId;
  final String meetingTitle;
  final List<String> attendeeUids;
  final Map<String, dynamic> members;

  const _AddTaskSheet({
    required this.projectId,
    required this.meetingId,
    required this.meetingTitle,
    required this.attendeeUids,
    required this.members,
  });

  @override
  State<_AddTaskSheet> createState() => _AddTaskSheetState();
}

class _AddTaskSheetState extends State<_AddTaskSheet> {
  final _titleCtrl = TextEditingController();
  String _priority = 'medium';
  String _status = 'pending';
  String? _assigneeUid;
  bool _isSaving = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _createTask() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Task title is required')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final uid = FirebaseAuth.instance.currentUser!.uid;
      final db = FirebaseFirestore.instance;
      final taskRef = db.collection('projects/${widget.projectId}/tasks').doc();

      String? assigneeName;
      String? assigneeEmail;
      if (_assigneeUid != null) {
        final member = widget.members[_assigneeUid] as Map<String, dynamic>? ?? {};
        assigneeName = member['displayName'] as String?;
        assigneeEmail = member['email'] as String?;
      }

      await taskRef.set({
        'id': taskRef.id,
        'title': _titleCtrl.text.trim(),
        'status': _status,
        'priority': _priority,
        'assigneeId': _assigneeUid,
        'assigneeName': assigneeName,
        'assigneeEmail': assigneeEmail,
        'meetingId': widget.meetingId,
        'meetingTitle': widget.meetingTitle,
        'progress': 0,
        'createdBy': uid,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Link task to meeting
      await db.doc('projects/${widget.projectId}/meetings/${widget.meetingId}').update({
        'taskIds': FieldValue.arrayUnion([taskRef.id]),
      });

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task created and linked to meeting!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final attendees = widget.attendeeUids
        .map((uid) => MapEntry(uid, widget.members[uid] as Map<String, dynamic>? ?? {}))
        .toList();

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(24, 0, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
          Text('New Action Item', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
          Text('Linked to "${widget.meetingTitle}"', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.4))),
          const SizedBox(height: 20),

          // Title
          TextField(
            controller: _titleCtrl,
            style: const TextStyle(color: Colors.white),
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Task title',
              hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
              filled: true,
              fillColor: Colors.white.withOpacity(0.05),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFF59E0B))),
            ),
          ),
          const SizedBox(height: 14),

          // Assignee
          DropdownButtonFormField<String>(
            value: _assigneeUid,
            decoration: InputDecoration(
              labelText: 'Assign to',
              labelStyle: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13),
              filled: true,
              fillColor: Colors.white.withOpacity(0.05),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFF59E0B))),
            ),
            dropdownColor: const Color(0xFF161B2E),
            style: const TextStyle(color: Colors.white, fontSize: 14),
            items: [
              const DropdownMenuItem(value: null, child: Text('Unassigned', style: TextStyle(color: Colors.white54))),
              ...attendees.map((e) {
                final name = e.value['displayName'] as String? ?? 'User';
                return DropdownMenuItem(value: e.key, child: Text(name));
              }),
            ],
            onChanged: (val) => setState(() => _assigneeUid = val),
          ),
          const SizedBox(height: 14),

          // Priority & Status row
          Row(children: [
            Expanded(
              child: _DropdownField(
                label: 'Priority',
                value: _priority,
                items: const ['low', 'medium', 'high', 'urgent'],
                onChanged: (v) => setState(() => _priority = v!),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _DropdownField(
                label: 'Status',
                value: _status,
                items: const ['pending', 'in_progress', 'testing', 'completed', 'github_pushed', 'deployed'],
                displayLabels: const ['Pending', 'In Progress', 'Testing', 'Completed', 'GitHub Pushed', 'Deployed'],
                onChanged: (v) => setState(() => _status = v!),
              ),
            ),
          ]),
          const SizedBox(height: 20),

          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _createTask,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving
                  ? const SizedBox(width: 20, height: 20, child: MsDevLoader(small: true, color: Colors.white))
                  : Text('Create & Assign', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  final String label;
  final String value;
  final List<String> items;
  final List<String>? displayLabels;
  final ValueChanged<String?> onChanged;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.displayLabels,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFF59E0B))),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      dropdownColor: const Color(0xFF161B2E),
      style: const TextStyle(color: Colors.white, fontSize: 13),
      items: items.asMap().entries.map((e) {
        final display = displayLabels != null ? displayLabels![e.key] : e.value;
        return DropdownMenuItem(value: e.value, child: Text(display));
      }).toList(),
      onChanged: onChanged,
    );
  }
}

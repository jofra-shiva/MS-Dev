import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class MeetingsScreen extends StatelessWidget {
  final String projectId;
  const MeetingsScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white),
          onPressed: () => context.canPop() ? context.pop() : context.go('/projects/$projectId'),
        ),
        title: Text('Meetings & Syncs', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Track action items and tasks assigned during meetings.', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13)),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981), // Teal
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 0,
                        ),
                        onPressed: () {
                          // Join room action
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Joining room...')));
                        },
                        icon: const Icon(Icons.language, color: Colors.white, size: 16),
                        label: const Text('Join Room', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          side: const BorderSide(color: Color(0xFF1E293B)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () => context.push('/projects/$projectId/meetings/create'),
                        icon: const Icon(Icons.add, color: Colors.white, size: 16),
                        label: const Text('Add Meeting', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance.collection('projects/$projectId/meetings').orderBy('createdAt', descending: true).snapshots(),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
                }

                final docs = snap.data?.docs ?? [];
                if (docs.isEmpty) {
                  return Center(child: Text('No meetings found.', style: TextStyle(color: Colors.white.withOpacity(0.5))));
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                  itemCount: docs.length,
                  itemBuilder: (context, index) {
                    return _MeetingCard(projectId: projectId, doc: docs[index])
                        .animate().fadeIn(delay: Duration(milliseconds: index * 100)).slideY(begin: 0.1);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _MeetingCard extends StatelessWidget {
  final String projectId;
  final QueryDocumentSnapshot doc;

  const _MeetingCard({required this.projectId, required this.doc});

  @override
  Widget build(BuildContext context) {
    final data = doc.data() as Map<String, dynamic>;
    final title = data['name'] as String? ?? data['title'] as String? ?? 'Untitled Meeting';
    final scheduledAt = (data['scheduledAt'] as Timestamp?)?.toDate();
    
    return GestureDetector(
      onTap: () => context.push('/projects/$projectId/meetings/${doc.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 20),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF1E293B)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(title, style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                            const SizedBox(width: 12),
                            if (scheduledAt != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(color: Colors.black.withOpacity(0.3), borderRadius: BorderRadius.circular(99)),
                                child: Text(DateFormat('EEEE, MMM d, yyyy').format(scheduledAt), style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                          ],
                        ),
                        if (data['link'] != null && data['link'].toString().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              side: const BorderSide(color: Color(0xFF1E293B)),
                              backgroundColor: Colors.white.withOpacity(0.02),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: () async {
                              final urlStr = data['link'] as String;
                              final url = Uri.parse(urlStr.startsWith('http') ? urlStr : 'https://$urlStr');
                              try {
                                await launchUrl(url, mode: LaunchMode.externalApplication);
                              } catch (e) {
                                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open link')));
                              }
                            },
                            icon: const Icon(Icons.language, color: Color(0xFF38BDF8), size: 14),
                            label: const Text('Join Meeting / Live Link', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold)),
                          ),
                        ]
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white38),
                ],
              ),
            ),
          
          const Divider(height: 1, color: Color(0xFF1E293B)),
          
          StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance.collection('projects/$projectId/tasks').where('meetingId', isEqualTo: doc.id).snapshots(),
            builder: (context, snap) {
              final tasks = snap.data?.docs ?? [];
              
              return Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ACTION ITEMS (${tasks.length})', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                    const SizedBox(height: 12),
                    if (tasks.isEmpty)
                      Text('No action items assigned.', style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12))
                    else
                      ...tasks.map((t) => _ActionItemTile(taskDoc: t)),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    ),
    );
  }
}

class _ActionItemTile extends StatelessWidget {
  final QueryDocumentSnapshot taskDoc;
  const _ActionItemTile({required this.taskDoc});

  @override
  Widget build(BuildContext context) {
    final t = taskDoc.data() as Map<String, dynamic>;
    final mod = t['module'] as String? ?? '';
    final title = mod.isNotEmpty ? mod : (t['title'] as String? ?? 'Task');
    final priority = t['priority'] as String? ?? 'low';
    final status = t['status'] as String? ?? 'pending';
    final photo = t['assigneePhoto'] as String? ?? '';
    final assigneeName = t['assigneeName'] as String? ?? '';

    String prioLabel = 'L';
    Color prioColor = const Color(0xFF475569);
    if (priority == 'urgent' || priority == 'high') { prioLabel = 'H'; prioColor = const Color(0xFFEF4444); }
    else if (priority == 'medium') { prioLabel = 'M'; prioColor = const Color(0xFFF59E0B); }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0B1120),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Expanded(child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
          
          if (photo.isNotEmpty) ...[
            ClipRRect(borderRadius: BorderRadius.circular(99), child: Image.network(photo, width: 20, height: 20, fit: BoxFit.cover)),
            const SizedBox(width: 8),
          ] else if (assigneeName.isNotEmpty) ...[
            Container(
              width: 20, height: 20,
              decoration: const BoxDecoration(color: Color(0xFF1E293B), shape: BoxShape.circle),
              child: Center(child: Text(assigneeName[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold))),
            ),
            const SizedBox(width: 8),
          ],
          
          Container(
            width: 20, height: 20,
            decoration: BoxDecoration(color: prioColor.withOpacity(0.2), shape: BoxShape.circle),
            child: Center(child: Text(prioLabel, style: TextStyle(color: prioColor, fontSize: 10, fontWeight: FontWeight.bold))),
          ),
          const SizedBox(width: 8),
          
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: const Color(0xFF1E293B).withOpacity(0.5), borderRadius: BorderRadius.circular(99)),
            child: Text(status.toUpperCase(), style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

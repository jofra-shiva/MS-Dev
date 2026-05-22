import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white),
          onPressed: () => context.canPop() ? context.pop() : context.go('/projects/$projectId'),
        ),
        title: Text('Meetings', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: Color(0xFFF59E0B), size: 26),
            onPressed: () => context.push('/projects/$projectId/meetings/create'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/projects/$projectId/meetings/create'),
        backgroundColor: const Color(0xFFF59E0B),
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text('Schedule', style: GoogleFonts.raleway(fontWeight: FontWeight.w700, color: Colors.white)),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('projects/$projectId/meetings')
            .orderBy('scheduledAt', descending: false)
            .snapshots(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
          }

          final now = DateTime.now();
          final docs = snap.data?.docs ?? [];

          final upcoming = docs.where((d) {
            final data = d.data() as Map<String, dynamic>;
            final scheduledAt = (data['scheduledAt'] as Timestamp?)?.toDate();
            return scheduledAt != null && scheduledAt.isAfter(now) && data['status'] != 'completed';
          }).toList();

          final past = docs.where((d) {
            final data = d.data() as Map<String, dynamic>;
            final scheduledAt = (data['scheduledAt'] as Timestamp?)?.toDate();
            return data['status'] == 'completed' || (scheduledAt != null && scheduledAt.isBefore(now));
          }).toList()..sort((a, b) {
            final aT = ((a.data() as Map)['scheduledAt'] as Timestamp?)?.toDate() ?? DateTime.now();
            final bT = ((b.data() as Map)['scheduledAt'] as Timestamp?)?.toDate() ?? DateTime.now();
            return bT.compareTo(aT);
          });

          if (docs.isEmpty) return _buildEmpty(context);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              if (upcoming.isNotEmpty) ...[
                _sectionHeader('Upcoming', const Color(0xFFF59E0B), Icons.upcoming_outlined),
                const SizedBox(height: 12),
                ...upcoming.asMap().entries.map((e) =>
                  _MeetingCard(
                    projectId: projectId,
                    doc: e.value,
                    isUpcoming: true,
                  ).animate().fadeIn(delay: Duration(milliseconds: e.key * 60)).slideY(begin: 0.15)
                ),
                const SizedBox(height: 24),
              ],
              if (past.isNotEmpty) ...[
                _sectionHeader('Past Meetings', Colors.white.withOpacity(0.4), Icons.history_outlined),
                const SizedBox(height: 12),
                ...past.asMap().entries.map((e) =>
                  _MeetingCard(
                    projectId: projectId,
                    doc: e.value,
                    isUpcoming: false,
                  ).animate().fadeIn(delay: Duration(milliseconds: e.key * 60)).slideY(begin: 0.15)
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _sectionHeader(String title, Color color, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 8),
        Text(title, style: GoogleFonts.raleway(fontSize: 13, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5)),
      ],
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.groups_outlined, size: 56, color: Color(0xFFF59E0B)),
          ),
          const SizedBox(height: 20),
          Text('No meetings yet', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 8),
          Text('Schedule your first team meeting', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 14)),
          const SizedBox(height: 28),
          ElevatedButton.icon(
            onPressed: () => context.push('/projects/$projectId/meetings/create'),
            icon: const Icon(Icons.add),
            label: const Text('Schedule Meeting'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
  final bool isUpcoming;

  const _MeetingCard({required this.projectId, required this.doc, required this.isUpcoming});

  @override
  Widget build(BuildContext context) {
    final data = doc.data() as Map<String, dynamic>;
    final title = data['title'] as String? ?? 'Untitled Meeting';
    final scheduledAt = (data['scheduledAt'] as Timestamp?)?.toDate();
    final attendees = (data['attendees'] as List?)?.length ?? 0;
    final taskIds = (data['taskIds'] as List?)?.length ?? 0;
    final status = data['status'] as String? ?? 'upcoming';
    final notes = data['notes'] as String? ?? '';

    final statusColor = status == 'completed'
        ? const Color(0xFF10B981)
        : status == 'in_progress'
            ? const Color(0xFFF59E0B)
            : const Color(0xFF38BDF8);

    final statusLabel = status == 'completed'
        ? 'Completed'
        : status == 'in_progress'
            ? 'In Progress'
            : 'Upcoming';

    return GestureDetector(
      onTap: () => context.push('/projects/$projectId/meetings/${doc.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isUpcoming
              ? const Color(0xFFF59E0B).withOpacity(0.2)
              : Colors.white.withOpacity(0.05)),
          boxShadow: [
            BoxShadow(
              color: isUpcoming
                  ? const Color(0xFFF59E0B).withOpacity(0.05)
                  : Colors.black.withOpacity(0.2),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: GoogleFonts.raleway(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: statusColor),
                    ),
                  ),
                ],
              ),
              if (scheduledAt != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.calendar_today_outlined, size: 12, color: Colors.white.withOpacity(0.4)),
                    const SizedBox(width: 6),
                    Text(
                      DateFormat('EEE, MMM d · h:mm a').format(scheduledAt),
                      style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.5), fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
              if (notes.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  notes,
                  style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.35), height: 1.4),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  _chip(Icons.people_outline, '$attendees attendees', Colors.white.withOpacity(0.3)),
                  const SizedBox(width: 10),
                  _chip(Icons.task_alt_outlined, '$taskIds tasks', taskIds > 0 ? const Color(0xFF10B981) : Colors.white.withOpacity(0.3)),
                  const Spacer(),
                  Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white.withOpacity(0.2)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(IconData icon, String label, Color color) {
    return Row(
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

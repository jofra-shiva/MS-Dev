import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static const icons = {
    'task_assigned': '📋',
    'task_completed': '✅',
    'deadline': '⏰',
    'commit': '⚡',
    'mention': '💬',
    'project_update': '🔔',
    'task_move_request': '🟠',
    'task_move_approved': '🟢',
    'system_announcement': '📢',
  };

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return Scaffold(
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
          .collection('notifications/$uid/items')
          .orderBy('createdAt', descending: true)
          .limit(30)
          .snapshots(),
        builder: (ctx, snap) {
          final docs = snap.data?.docs ?? [];
          if (docs.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('🔔', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 12),
              Text('No notifications', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
              const SizedBox(height: 6),
              Text("You're all caught up!", style: TextStyle(color: Colors.white.withOpacity(0.4))),
            ]));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: docs.length,
            itemBuilder: (_, i) {
              final n = docs[i].data() as Map<String, dynamic>;
              final isRead = n['read'] == true;
              final type = n['type'] as String? ?? '';
              final isAnnouncement = type == 'system_announcement';
              final ts = (n['createdAt'] as Timestamp?)?.toDate();
              final accentColor = isAnnouncement ? const Color(0xFF0EA5E9)
                  : type == 'task_move_request' ? const Color(0xFFF97316)
                  : type == 'task_move_approved' ? const Color(0xFF10B981)
                  : const Color(0xFF6366F1);

              return GestureDetector(
                onTap: () => docs[i].reference.update({'read': true}),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isRead ? const Color(0xFF0D1117) : accentColor.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isRead ? const Color(0xFF1E2D47) : accentColor.withOpacity(0.25)),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Stack(
                      children: [
                        if (!isRead)
                          Positioned(
                            left: 0, top: 0, bottom: 0,
                            child: Container(width: 3, color: accentColor),
                          ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                          child: Row(children: [
                            Container(
                              width: 40, height: 40,
                              decoration: BoxDecoration(
                                color: accentColor.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: accentColor.withOpacity(0.3)),
                              ),
                              child: Center(child: Text(icons[type] ?? '🔔', style: const TextStyle(fontSize: 20))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(n['title'] ?? '', style: TextStyle(fontWeight: isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 13.5, color: Colors.white)),
                              const SizedBox(height: 2),
                              Text(n['body'] ?? '', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.5)), maxLines: 2),
                              if (ts != null) ...[
                                const SizedBox(height: 4),
                                Text(DateFormat('MMM d, h:mm a').format(ts), style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.25))),
                              ],
                            ])),
                            if (!isRead) Container(width: 8, height: 8, decoration: BoxDecoration(color: accentColor, shape: BoxShape.circle)),
                          ]),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

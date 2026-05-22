import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static const icons = {'task_assigned': '📋', 'task_completed': '✅', 'deadline': '⏰', 'commit': '⚡', 'mention': '💬', 'project_update': '🔔'};

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return Scaffold(
      appBar: AppBar(title: Text('Notifications', style: GoogleFonts.raleway(fontWeight: FontWeight.w800))),
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
              final ts = (n['createdAt'] as Timestamp?)?.toDate();
              return GestureDetector(
                onTap: () => docs[i].reference.update({'read': true}),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isRead ? const Color(0xFF0D1117) : const Color(0xFF6366F1).withOpacity(0.06),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isRead ? const Color(0xFF1E2D47) : const Color(0xFF6366F1).withOpacity(0.2)),
                  ),
                  child: Row(children: [
                    Text(icons[n['type']] ?? '🔔', style: const TextStyle(fontSize: 22)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(n['title'] ?? '', style: TextStyle(fontWeight: isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 13.5, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text(n['body'] ?? '', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.4)), maxLines: 2),
                      if (ts != null) ...[
                        const SizedBox(height: 4),
                        Text(DateFormat('MMM d, h:mm a').format(ts), style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.25))),
                      ],
                    ])),
                    if (!isRead) Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF6366F1), shape: BoxShape.circle)),
                  ]),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class ActivityScreen extends StatelessWidget {
  final String projectId;
  const ActivityScreen({super.key, required this.projectId});

  String _timeAgo(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inDays > 365) return '${(diff.inDays / 365).floor()} years ago';
    if (diff.inDays > 30) return '${(diff.inDays / 30).floor()} months ago';
    if (diff.inDays > 0) return '${diff.inDays} days ago';
    if (diff.inHours > 0) return 'about ${diff.inHours} hours ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes} minutes ago';
    return 'just now';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        title: Text('Activity', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white), 
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Text('Activity Timeline\nReal-time feed of all project activity', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13, height: 1.5)),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance.collection('projects/$projectId/activity').orderBy('createdAt', descending: true).limit(50).snapshots(),
              builder: (context, snap) {
                if (!snap.hasData) return const Center(child: MsDevLoader(color: Color(0xFF10B981)));
                final docs = snap.data!.docs;
                if (docs.isEmpty) return const Center(child: Text('No recent activity', style: TextStyle(color: Colors.white54)));

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  itemCount: docs.length,
                  itemBuilder: (context, i) {
                    final d = docs[i].data() as Map<String, dynamic>;
                    
                    // Web format mapping
                    final actionType = d['action'] as String? ?? '';
                    final taskTitle = d['taskTitle'] as String? ?? d['title'] as String? ?? '';
                    final userName = d['userName'] as String? ?? 'Someone';
                    final userPhoto = d['userPhoto'] as String? ?? '';
                    final fromStatus = d['fromStatus'] as String?;
                    final toStatus = d['toStatus'] as String?;
                    final createdAt = (d['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now();
                    
                    String actionText = 'updated';
                    if (actionType == 'TASK_CREATED') actionText = 'created task';
                    else if (actionType == 'TASK_DELETED') actionText = 'deleted task';
                    else if (actionType.contains('CREATED')) actionText = 'created';
                    else if (actionType.contains('DELETED')) actionText = 'deleted';

                    final isLast = i == docs.length - 1;

                    return IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Column(
                            children: [
                              CircleAvatar(
                                radius: 16,
                                backgroundColor: const Color(0xFF1E293B),
                                backgroundImage: userPhoto.isNotEmpty ? NetworkImage(userPhoto) : null,
                                child: userPhoto.isEmpty ? Text(userName[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)) : null,
                              ),
                              if (!isLast) Expanded(child: Container(width: 1, color: Colors.white.withOpacity(0.1))),
                            ],
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 24),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Text.rich(
                                            TextSpan(
                                              children: [
                                                TextSpan(text: userName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                                                TextSpan(text: ' $actionText ', style: const TextStyle(color: Colors.white54, fontSize: 13)),
                                                if (taskTitle.isNotEmpty)
                                                  TextSpan(text: '"$taskTitle"', style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w600, fontSize: 13)),
                                              ],
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(_timeAgo(createdAt), style: const TextStyle(color: Colors.white38, fontSize: 11)),
                                      ],
                                    ),
                                    if (fromStatus != null && toStatus != null && fromStatus != toStatus) ...[
                                      const SizedBox(height: 12),
                                      Row(
                                        children: [
                                          _buildStatusBadge(fromStatus),
                                          const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward, color: Colors.white38, size: 12)),
                                          _buildStatusBadge(toStatus),
                                        ],
                                      )
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Text(status.replaceAll('_', ' '), style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

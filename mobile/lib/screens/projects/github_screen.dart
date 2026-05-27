import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class GithubScreen extends StatelessWidget {
  final String projectId;
  const GithubScreen({super.key, required this.projectId});

  String _timeAgo(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inDays > 365) return '${(diff.inDays / 365).floor()}y ago';
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
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
        title: Text('GitHub', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white), 
          onPressed: () => context.pop(),
        ),
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: FirebaseFirestore.instance.doc('projects/$projectId').snapshots(),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: MsDevLoader(color: Color(0xFF10B981)));
          final p = snap.data!.data() as Map<String, dynamic>? ?? {};
          final github = p['github'] as Map<String, dynamic>?;

          if (github == null || github['connected'] != true) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.code, size: 80, color: Colors.white24),
                    const SizedBox(height: 32),
                    Text('Connect GitHub', style: GoogleFonts.raleway(fontSize: 22, color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    const Text(
                      'To link a repository and track live commits, please use the Web version of our application.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.5),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.1), borderRadius: BorderRadius.circular(99)),
                      child: const Text('Better experience on Web 🚀', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 12)),
                    )
                  ],
                ),
              ),
            );
          }

          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white10)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 20),
                          const SizedBox(width: 8),
                          Expanded(child: Text('Connected to ${github['repoOwner']}/${github['repoName']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text('Syncing commits and pull requests automatically.', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                Text('Recent Commits', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 16),
                Expanded(
                  child: StreamBuilder<QuerySnapshot>(
                    stream: FirebaseFirestore.instance.collection('projects/$projectId/commits').orderBy('date', descending: true).limit(50).snapshots(),
                    builder: (context, commitSnap) {
                      if (!commitSnap.hasData) return const Center(child: MsDevLoader(color: Color(0xFF10B981)));
                      final docs = commitSnap.data!.docs;
                      if (docs.isEmpty) return const Center(child: Text('No commits found yet.', style: TextStyle(color: Colors.white54)));

                      return ListView.builder(
                        itemCount: docs.length,
                        itemBuilder: (context, i) {
                          final d = docs[i].data() as Map<String, dynamic>;
                          final msg = d['message'] as String? ?? 'Commit';
                          final sha = (d['sha'] as String? ?? '0000000').substring(0, 7);
                          final date = (d['date'] as Timestamp?)?.toDate() ?? DateTime.now();

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(12)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(msg.split('\n').first, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Text(sha, style: const TextStyle(color: Color(0xFF38BDF8), fontFamily: 'monospace', fontSize: 12)),
                                    const Spacer(),
                                    Text(_timeAgo(date), style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
                                  ],
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
        },
      ),
    );
  }
}

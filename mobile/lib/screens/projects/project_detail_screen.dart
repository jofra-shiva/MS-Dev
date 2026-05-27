import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ProjectDetailScreen extends StatelessWidget {
  final String projectId;
  const ProjectDetailScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance.doc('projects/$projectId').snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) return const Scaffold(backgroundColor: Color(0xFF070B14), body: Center(child: MsDevLoader(color: Color(0xFFF59E0B))));
        final p = snap.data!.data() as Map<String, dynamic>? ?? {};
        final members = p['members'] as Map<String, dynamic>? ?? {};
        return StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance.collection('projects/$projectId/tasks').snapshots(),
          builder: (context, taskSnap) {
            final tasks = taskSnap.data?.docs ?? [];
            final totalTasks = tasks.length;
            final completedTasks = tasks.where((t) => (t.data() as Map)['status'] == 'completed').length;
            final inProgressTasks = tasks.where((t) => (t.data() as Map)['status'] == 'in_progress').length;
            final testingTasks = tasks.where((t) => (t.data() as Map)['status'] == 'testing').length;
            final pendingTasks = tasks.where((t) => (t.data() as Map)['status'] == 'pending').length;
            final githubTasks = tasks.where((t) => (t.data() as Map)['status'] == 'github_pushed').length;
            final deployedTasks = tasks.where((t) => (t.data() as Map)['status'] == 'deployed').length;
            
            // Treat deployed and github_pushed as completed for the percentage calculation
            final overallCompleted = completedTasks + githubTasks + deployedTasks;
            final pct = totalTasks == 0 ? 0.0 : (overallCompleted / totalTasks) * 100.0;

            // Sort for recent tasks
            final recentTasks = List.from(tasks)..sort((a, b) {
              final aTime = ((a.data() as Map)['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now();
              final bTime = ((b.data() as Map)['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now();
              return bTime.compareTo(aTime);
            });
            final topRecentTasks = recentTasks.take(10).toList();

            return Scaffold(
              backgroundColor: const Color(0xFF070B14),
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: _ProjectDropdownTitle(currentProjectId: projectId, currentProjectName: p['name'] ?? 'Project Overview'),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white), 
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/projects');
                }
              }
            ),
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 4 Stats Row
                GridView.count(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  childAspectRatio: 2.2,
                  children: [
                    _buildStatCard('$totalTasks', 'Total Tasks', const Color(0xFFFBBF24)), // Yellow
                    _buildStatCard('$inProgressTasks', 'In Progress', const Color(0xFFF59E0B)), // Orange
                    _buildStatCard('$completedTasks', 'Completed', const Color(0xFF10B981)), // Green
                    _buildStatCard('${members.length}', 'Team Size', const Color(0xFF38BDF8)), // Blue
                  ],
                ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                
                const SizedBox(height: 20),

                // Recent Tasks
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Recent Tasks', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.white)),
                    GestureDetector(
                      onTap: () => context.go('/projects/$projectId/kanban'),
                      child: const Text('View board →', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (topRecentTasks.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(16)),
                    child: Center(child: Text('No tasks yet', style: TextStyle(color: Colors.white.withOpacity(0.3)))),
                  )
                else
                  Column(
                    children: topRecentTasks.asMap().entries.map((e) {
                      final t = e.value.data() as Map<String, dynamic>;
                      return _TaskTile(task: t).animate().fadeIn(delay: Duration(milliseconds: e.key * 40));
                    }).toList(),
                  ),

                const SizedBox(height: 30),

                // Task Progress Card
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
                      Text('Task Progress', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Overall completion', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13, fontWeight: FontWeight.w500)),
                          Text('${pct.round()}%', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const SizedBox(height: 16),
                      Center(
                        child: _WaterBottleProgress(pct: pct),
                      ),
                      const SizedBox(height: 24),
                      const SizedBox(height: 24),
                      _buildProgressRow('Deployed', '$deployedTasks', const Color(0xFFEC4899)),
                      const SizedBox(height: 12),
                      _buildProgressRow('GitHub Pushed', '$githubTasks', const Color(0xFF8B5CF6)),
                      const SizedBox(height: 12),
                      _buildProgressRow('Completed', '$completedTasks', const Color(0xFF10B981)),
                      const SizedBox(height: 12),
                      _buildProgressRow('Testing', '$testingTasks', const Color(0xFF38BDF8)),
                      const SizedBox(height: 12),
                      _buildProgressRow('In Progress', '$inProgressTasks', const Color(0xFFF59E0B)),
                      const SizedBox(height: 12),
                      _buildProgressRow('Pending', '$pendingTasks', const Color(0xFF475569)),
                    ],
                  ),
                ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),

                const SizedBox(height: 20),

                // GitHub Integration
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
                      Text('GitHub Integration', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                      const SizedBox(height: 12),
                      if (p['github']?['connected'] == true) ...[
                        Row(
                          children: [
                            Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                            const SizedBox(width: 8),
                            const Text('Connected', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w700, fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text('${p['github']['repoOwner']}/${p['github']['repoName']}', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.flash_on, color: Color(0xFFF59E0B), size: 14),
                            const SizedBox(width: 4),
                            Text('${p['stats']?['totalCommits'] ?? 0} commits tracked', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ] else ...[
                        Text('Not connected', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13)),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(0, 0),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Connect Repository →', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 13, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ],
                  ),
                ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),

                const SizedBox(height: 20),

                const SizedBox(height: 20),

                // Team Members
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Team Members', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                          GestureDetector(
                            onTap: () => context.go('/projects/$projectId/settings'),
                            child: const Text('Manage →', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ...members.entries.map((e) {
                        final m = e.value as Map<String, dynamic>;
                        return _buildTeamMember(m);
                      }).toList(),
                    ],
                  ),
                ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),
                
                const SizedBox(height: 40),
              ],
            ),
          ),
        );
      },
    );
      },
    );
  }

  Widget _buildStatCard(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: GoogleFonts.raleway(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5), fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildProgressRow(String label, String value, Color dotColor) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
        const SizedBox(width: 10),
        Text(label, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13, fontWeight: FontWeight.w500)),
        const Spacer(),
        Text(value, style: GoogleFonts.raleway(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
      ],
    );
  }

  Widget _buildTeamMember(Map<String, dynamic> m) {
    final name = m['displayName'] as String? ?? 'User';
    final email = m['email'] as String? ?? '';
    final role = m['role'] as String? ?? 'MEMBER';
    final photo = m['photoURL'] as String?;
    
    final roleColor = role.toUpperCase() == 'ADMIN' ? const Color(0xFF38BDF8) : const Color(0xFF10B981);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFF1E2740),
            backgroundImage: photo != null && !photo.startsWith('/') 
                ? NetworkImage(photo) 
                : (photo?.startsWith('/') == true ? AssetImage('assets/images$photo') : null) as ImageProvider?,
            child: photo == null ? Text(name.isNotEmpty ? name[0].toUpperCase() : 'U', style: GoogleFonts.raleway(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)) : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: GoogleFonts.raleway(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(email, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: roleColor.withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
            child: Text(role.toUpperCase(), style: TextStyle(color: roleColor, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
          ),
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  final Map<String, dynamic> task;
  const _TaskTile({required this.task});

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
    final color = statusColors[task['status']] ?? const Color(0xFF475569);
    
    // Priority badge mapping
    final priorityColors = {'low': const Color(0xFF10B981), 'medium': const Color(0xFF38BDF8), 'high': const Color(0xFFF59E0B), 'urgent': const Color(0xFFEF4444)};
    final pColor = priorityColors[task['priority']] ?? const Color(0xFF38BDF8);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
          child: Text((task['status'] ?? '').toString().replaceAll('_', ' ').toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5)),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(task['title'] ?? '', style: GoogleFonts.raleway(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
        const SizedBox(width: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: pColor.withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
          child: Text((task['priority'] ?? 'MEDIUM').toString().toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: pColor, letterSpacing: 0.5)),
        ),
      ]),
    );
  }
}

class _ProjectDropdownTitle extends StatelessWidget {
  final String currentProjectId;
  final String currentProjectName;
  const _ProjectDropdownTitle({required this.currentProjectId, required this.currentProjectName});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return Text(currentProjectName, style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18));
    
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('projects')
        .where('members.$uid.role', whereIn: ['admin', 'member', 'viewer'])
        .snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) return Text(currentProjectName, style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18));
        
        final docs = snap.data!.docs;
        final items = docs.map((d) {
          final p = d.data() as Map<String, dynamic>;
          return PopupMenuItem<String>(
            value: d.id,
            child: Text(p['name'] ?? 'Project', style: GoogleFonts.raleway(fontWeight: FontWeight.w600, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
          );
        }).toList();

        items.add(
          PopupMenuItem<String>(
            value: 'CREATE_NEW',
            child: Row(
              children: [
                const Icon(Icons.add, color: Color(0xFFF59E0B), size: 18),
                const SizedBox(width: 8),
                Text('New Project', style: GoogleFonts.raleway(fontWeight: FontWeight.w700, color: const Color(0xFFF59E0B))),
              ],
            ),
          )
        );

        return PopupMenuButton<String>(
          initialValue: currentProjectId,
          color: const Color(0xFF0D1117),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          offset: const Offset(0, 40),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(child: Text(currentProjectName, style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18), maxLines: 1, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 4),
              const Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 20),
            ],
          ),
          itemBuilder: (context) => items,
          onSelected: (val) {
            if (val == 'CREATE_NEW') {
              context.push('/create-project');
            } else if (val != null && val != currentProjectId) {
              context.go('/projects/$val');
            }
          },
        );
      },
    );
  }
}

class _WaterBottleProgress extends StatelessWidget {
  final double pct;
  const _WaterBottleProgress({required this.pct});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      height: 160,
      decoration: BoxDecoration(
        color: const Color(0xFF070B14),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.2), width: 3),
        boxShadow: [
          BoxShadow(color: const Color(0xFF38BDF8).withOpacity(0.1), blurRadius: 10, spreadRadius: 2),
        ],
      ),
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(13),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 1500),
              curve: Curves.easeOutCubic,
              height: 160 * (pct / 100),
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    const Color(0xFF0284C7),
                    const Color(0xFF38BDF8).withOpacity(0.8),
                  ],
                ),
              ),
            ),
          ),
          Center(
            child: Text(
              '${pct.round()}%',
              style: GoogleFonts.raleway(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: pct > 50 ? Colors.white : const Color(0xFF38BDF8),
                shadows: [Shadow(color: Colors.black.withOpacity(0.5), blurRadius: 4)],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

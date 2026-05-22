import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../home/home_screen.dart'; // To access the nav provider

Color parseColor(String hex) {
  try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
  catch (_) { return const Color(0xFFF59E0B); }
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final db = FirebaseFirestore.instance;
    final user = FirebaseAuth.instance.currentUser;
    final name = user?.displayName?.split(' ')[0] ?? 'Developer';

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: StreamBuilder<QuerySnapshot>(
        stream: db.collection('projects')
          .where('members.$uid.role', whereIn: ['admin', 'member', 'viewer'])
          .snapshots(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
          }

          final docs = snap.data?.docs ?? [];
          
          int totalTasks = 0;
          int completedTasks = 0;
          int totalCommits = 0;
          int activeProjectsCount = 0;
          int inProgressTasks = 0;
          int pendingTasks = 0;

          final List<Map<String, dynamic>> activeProjects = [];

          for (var doc in docs) {
            final p = doc.data() as Map<String, dynamic>;
            p['id'] = doc.id;
            final stats = p['stats'] as Map<String, dynamic>? ?? {};
            
            totalTasks += (stats['totalTasks'] as num?)?.toInt() ?? 0;
            completedTasks += (stats['completedTasks'] as num?)?.toInt() ?? 0;
            inProgressTasks += (stats['inProgressTasks'] as num?)?.toInt() ?? 0;
            pendingTasks += (stats['pendingTasks'] as num?)?.toInt() ?? 0;
            totalCommits += (stats['totalCommits'] as num?)?.toInt() ?? 0;
            
            if (p['status'] == 'active') {
              activeProjectsCount++;
              activeProjects.add(p);
            }
          }

          return FutureBuilder<Map<String, int>>(
            future: _fetchRealStats(activeProjects),
            builder: (context, statsSnap) {
              final realStats = statsSnap.data;
              if (realStats != null) {
                totalTasks = realStats['total']!;
                completedTasks = realStats['completed']!;
                inProgressTasks = realStats['inProgress']!;
                pendingTasks = realStats['pending']!;
                totalCommits = realStats['commits']!;
              }

              final overallCompletion = totalTasks > 0 ? (completedTasks / totalTasks) : 0.0;

              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Hero Header
                    Text('Good morning, $name 👋', style: GoogleFonts.raleway(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5)),
                    const SizedBox(height: 24),

                    // Stats Grid
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      childAspectRatio: 1.4,
                      children: [
                        _buildStatCard('Active Projects', activeProjectsCount.toString(), '📁', const Color(0xFFF59E0B)),
                        _buildStatCard('Total Tasks', totalTasks.toString(), '✅', const Color(0xFFFBBF24)),
                        _buildStatCard('Completed', completedTasks.toString(), '🎯', const Color(0xFFD97706)),
                        _buildStatCard('Total Commits', totalCommits.toString(), '⚡', const Color(0xFFFCD34D)),
                      ],
                    ),
                    
                    const SizedBox(height: 32),

                // Active Projects Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Active Projects', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                    GestureDetector(
                      onTap: () {
                        ref.read(bottomNavIndexProvider.notifier).state = 1;
                        context.go('/projects');
                      },
                      child: Row(
                        children: [
                          const Text('View all', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_forward_rounded, color: Color(0xFFF59E0B), size: 14),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                if (activeProjects.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1117),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.05)),
                    ),
                    child: Center(child: Text('No active projects', style: TextStyle(color: Colors.white.withOpacity(0.5)))),
                  )
                else
                  SizedBox(
                    height: 170,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: activeProjects.length > 5 ? 5 : activeProjects.length,
                      itemBuilder: (context, index) {
                        final p = activeProjects[index];
                        return _buildProjectCard(context, p).animate().fadeIn(delay: Duration(milliseconds: index * 100)).slideX(begin: 0.1);
                      },
                    ),
                  ),

                const SizedBox(height: 32),

                // Insights Section
                Row(
                  children: [
                    Text('Insights', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFF59E0B).withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                      child: Row(
                        children: [
                          Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFF59E0B), shape: BoxShape.circle)),
                          const SizedBox(width: 4),
                          const Text('LIVE', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D1117),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // Circular Progress
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 140, height: 140,
                            child: CircularProgressIndicator(
                              value: 1.0,
                              strokeWidth: 8,
                              color: Colors.white.withOpacity(0.05),
                            ),
                          ),
                          SizedBox(
                            width: 140, height: 140,
                            child: CircularProgressIndicator(
                              value: overallCompletion,
                              strokeWidth: 8,
                              color: const Color(0xFFF59E0B),
                              backgroundColor: Colors.transparent,
                            ).animate().shimmer(duration: const Duration(seconds: 2)),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('${(overallCompletion * 100).round()}%', style: GoogleFonts.raleway(fontSize: 32, fontWeight: FontWeight.w800, color: Colors.white, height: 1)),
                              const SizedBox(height: 4),
                              Text('OVERALL\nCOMPLETION', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white.withOpacity(0.5), letterSpacing: 1)),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),
                      
                      _buildInsightRow('Completed', completedTasks, const Color(0xFFF59E0B)),
                      const SizedBox(height: 12),
                      _buildInsightRow('In Progress', inProgressTasks, const Color(0xFFFBBF24)),
                      const SizedBox(height: 12),
                      _buildInsightRow('Pending', pendingTasks, Colors.white.withOpacity(0.3)),
                    ],
                  ),
                ).animate().fadeIn().slideY(begin: 0.1),

                const SizedBox(height: 40),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildStatCard(String label, String value, String icon, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
                child: Text(icon, style: const TextStyle(fontSize: 16)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                child: Text('+12%', style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value, style: GoogleFonts.raleway(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white, height: 1.1)),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.5), fontWeight: FontWeight.w600)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProjectCard(BuildContext context, Map<String, dynamic> p) {
    final color = parseColor(p['color'] ?? '#6366F1');
    final pct = (p['completionPercentage'] ?? 0).toDouble();
    final members = p['members'] as Map<String, dynamic>? ?? {};
    final stats = p['stats'] as Map<String, dynamic>? ?? {};

    return GestureDetector(
      onTap: () => context.go('/projects/${p['id']}'),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.85,
        margin: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          children: [
            Container(height: 4, decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.vertical(top: Radius.circular(16)))),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(p['name'] ?? '', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        const SizedBox(width: 8),
                        Text('ACTIVE', style: TextStyle(color: const Color(0xFF8B5CF6), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(p['description'] ?? 'No description available', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.4)), maxLines: 2, overflow: TextOverflow.ellipsis),
                    
                    const Spacer(),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Progress', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5), fontWeight: FontWeight.w600)),
                        Text('${pct.round()}%', style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: pct / 100, minHeight: 4,
                        backgroundColor: Colors.white.withOpacity(0.05),
                        valueColor: AlwaysStoppedAnimation(color),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.check_circle_outline, size: 12, color: Colors.white.withOpacity(0.5)),
                            const SizedBox(width: 4),
                            Text('${stats['totalTasks'] ?? 0} tasks', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5))),
                          ],
                        ),
                        Row(
                          children: [
                            Icon(Icons.people_outline, size: 12, color: Colors.white.withOpacity(0.5)),
                            const SizedBox(width: 4),
                            Text('${members.length} team', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5))),
                          ],
                        ),
                      ],
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

  Widget _buildInsightRow(String label, int value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle, boxShadow: [BoxShadow(color: color.withOpacity(0.5), blurRadius: 6)])),
          const SizedBox(width: 12),
          Text(label, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(value.toString(), style: GoogleFonts.raleway(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Future<Map<String, int>> _fetchRealStats(List<Map<String, dynamic>> projects) async {
    int total = 0;
    int completed = 0;
    int inProgress = 0;
    int pending = 0;
    int commits = 0;

    for (final p in projects) {
      final stats = p['stats'] as Map<String, dynamic>? ?? {};
      commits += (stats['totalCommits'] as num?)?.toInt() ?? 0;

      final snap = await FirebaseFirestore.instance.collection('projects/${p['id']}/tasks').get();
      total += snap.docs.length;
      for (var doc in snap.docs) {
        final status = doc.data()['status'];
        if (status == 'completed' || status == 'deployed' || status == 'github_pushed') {
          completed++;
        } else if (status == 'in_progress' || status == 'testing') {
          inProgress++;
        } else if (status == 'pending') {
          pending++;
        }
      }
    }
    return {'total': total, 'completed': completed, 'inProgress': inProgress, 'pending': pending, 'commits': commits};
  }
}

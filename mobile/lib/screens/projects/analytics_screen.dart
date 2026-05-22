import 'dart:math';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class AnalyticsScreen extends StatefulWidget {
  final String projectId;
  const AnalyticsScreen({super.key, required this.projectId});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        title: Text('Analytics', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white), 
          onPressed: () => context.pop(),
        ),
      ),
      body: FutureBuilder<DocumentSnapshot>(
        future: FirebaseFirestore.instance.doc('projects/${widget.projectId}').get(),
        builder: (context, projSnap) {
          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks').snapshots(),
            builder: (context, snap) {
              if (!snap.hasData || projSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
              }
              
              final tasks = snap.data!.docs.map((d) => d.data() as Map<String, dynamic>).toList();
              final projectData = (projSnap.data?.data() as Map<String, dynamic>?) ?? {};
              final teamMembersCount = (projectData['members'] as Map?)?.length ?? 0;

              if (tasks.isEmpty) return const Center(child: Text('No data for analytics', style: TextStyle(color: Colors.white54)));

              // Computations
              final completedTasks = tasks.where((t) => ['completed', 'deployed'].contains(t['status'])).toList();
              final githubVerifiedTasks = completedTasks.where((t) => t['githubRef']?['lastCommitSha'] != null).toList();
              
              final sortedByCompleted = [...completedTasks]..sort((a, b) => _timeValue(b['completedAt'] ?? b['updatedAt']).compareTo(_timeValue(a['completedAt'] ?? a['updatedAt'])));
              final latestCompletedTask = sortedByCompleted.isNotEmpty ? sortedByCompleted.first : null;
              
              final sortedByUpdated = [...tasks]..sort((a, b) => _timeValue(b['updatedAt']).compareTo(_timeValue(a['updatedAt'])));
              final latestUpdatedTask = sortedByUpdated.isNotEmpty ? sortedByUpdated.first : null;
              final lastUpdater = latestUpdatedTask?['lastMovedBy']?['name'] ?? '—';

              final avgProgress = tasks.fold(0.0, (s, t) => s + ((t['progress'] as num?)?.toDouble() ?? 0.0)) / tasks.length;
              final completionRate = tasks.isEmpty ? 0 : (completedTasks.length / tasks.length) * 100;

              return SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Project performance and team insights', style: TextStyle(color: Colors.white54, fontSize: 13)),
                    const SizedBox(height: 24),
                    
                    // Top Stats Grid
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      childAspectRatio: 1.5,
                      children: [
                        _StatCard('Completion Rate', '${completionRate.round()}%', const Color(0xFF6366F1)),
                        _StatCard('Total Tasks', '${tasks.length}', const Color(0xFF10B981)),
                        _StatCard('Avg Progress', '${avgProgress.round()}%', const Color(0xFFF59E0B)),
                        _StatCard('Verified by GitHub', '${githubVerifiedTasks.length}/${completedTasks.length}', const Color(0xFF38BDF8)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _StatCard('Team Members', '$teamMembersCount', const Color(0xFF3B82F6), fullWidth: true),
                    const SizedBox(height: 24),

                    // Audit Cards
                    _AuditCard('Verified completion', '${tasks.isEmpty ? 0 : (githubVerifiedTasks.length / tasks.length * 100).round()}%', '${githubVerifiedTasks.length} tasks confirmed by GitHub', const Color(0xFF10B981)),
                    _AuditCard('Latest completed by', latestCompletedTask?['completedBy']?['name'] ?? '—', latestCompletedTask?['completedAt'] != null ? 'Recently' : 'No completed task yet', const Color(0xFF38BDF8)),
                    _AuditCard('Last updated by', lastUpdater, latestUpdatedTask?['updatedAt'] != null ? 'Recently' : 'No updates yet', const Color(0xFFF59E0B)),
                    _AuditCard('Latest commit linked', tasks.any((t) => t['githubRef']?['lastCommitSha'] != null) ? 'Yes' : 'No', 'Tracker shows commit state', const Color(0xFF8B5CF6)),
                    const SizedBox(height: 24),

                    // Status Pie
                    _buildCard('Tasks by Status', _buildStatusPie(tasks)),
                    const SizedBox(height: 20),

                    // Priority Bar
                    _buildCard('Tasks by Priority', _buildPriorityBar(tasks)),
                    const SizedBox(height: 20),
                    
                    // Completion Ownership
                    _buildCard('Completion Ownership', _buildCompletionOwnership(tasks)),
                    const SizedBox(height: 20),

                    // Latest Activity
                    _buildCard('Latest Activity', _buildLatestActivity(latestUpdatedTask, lastUpdater, latestCompletedTask)),
                    const SizedBox(height: 20),

                    // Module Completion
                    _buildCard('Module Completion', _buildModuleCompletion(tasks)),
                    const SizedBox(height: 20),

                    // Team Contribution
                    _buildCard('Team Contribution', _buildTeamContribution(tasks)),
                    const SizedBox(height: 40),
                  ],
                ),
              );
            },
          );
        }
      ),
    );
  }

  int _timeValue(dynamic timestamp) {
    if (timestamp == null) return 0;
    if (timestamp is Timestamp) return timestamp.millisecondsSinceEpoch;
    return 0;
  }

  Widget _StatCard(String label, String value, Color color, {bool fullWidth = false}) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withOpacity(0.05))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.white54)),
        ],
      ),
    );
  }

  Widget _AuditCard(String label, String value, String hint, Color color) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(16), border: Border(top: BorderSide(color: color, width: 3))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, color: Colors.white38, letterSpacing: 1.2, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 4),
          Text(hint, style: const TextStyle(fontSize: 12, color: Colors.white54)),
        ],
      ),
    );
  }

  Widget _buildCard(String title, Widget child) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: const Color(0xFF0D1117), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withOpacity(0.05))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _buildStatusPie(List<Map<String, dynamic>> tasks) {
    final Map<String, int> counts = {'pending': 0, 'in_progress': 0, 'testing': 0, 'completed': 0, 'github_pushed': 0, 'deployed': 0};
    for (var t in tasks) {
      final s = t['status'] ?? 'pending';
      if (counts.containsKey(s)) counts[s] = counts[s]! + 1;
    }
    
    final labels = ['Pending', 'In Progress', 'Testing', 'Completed', 'GitHub', 'Deployed'];
    final keys = ['pending', 'in_progress', 'testing', 'completed', 'github_pushed', 'deployed'];
    final colors = [const Color(0xFF475569), const Color(0xFFF59E0B), const Color(0xFF3B82F6), const Color(0xFF10B981), const Color(0xFF8B5CF6), const Color(0xFFEC4899)];

    return Row(
      children: [
        SizedBox(
          width: 120, height: 120,
          child: CustomPaint(
            painter: _PieChartPainter(keys.map((k) => counts[k]!.toDouble()).toList(), colors),
          ),
        ),
        const SizedBox(width: 24),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: List.generate(labels.length, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: colors[i], shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Text(labels[i], style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  const Spacer(),
                  Text('${counts[keys[i]]}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              ),
            )),
          ),
        ),
      ],
    );
  }

  Widget _buildPriorityBar(List<Map<String, dynamic>> tasks) {
    final Map<String, int> counts = {'low': 0, 'medium': 0, 'high': 0, 'urgent': 0};
    for (var t in tasks) {
      final p = t['priority'] ?? 'low';
      if (counts.containsKey(p)) counts[p] = counts[p]! + 1;
    }
    
    final labels = ['Low', 'Medium', 'High', 'Urgent'];
    final keys = ['low', 'medium', 'high', 'urgent'];
    final colors = [const Color(0xFF475569), const Color(0xFF3B82F6), const Color(0xFFF59E0B), const Color(0xFFEF4444)];
    
    final maxVal = counts.values.reduce(max).toDouble();
    final height = 180.0;

    return SizedBox(
      height: height,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(labels.length, (i) {
          final val = counts[keys[i]]!;
          final pct = maxVal == 0 ? 0.0 : val / maxVal;
          return Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('$val', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 4),
              Container(
                width: 32,
                height: (height - 40) * pct,
                decoration: BoxDecoration(color: colors[i], borderRadius: const BorderRadius.vertical(top: Radius.circular(4))),
              ),
              const SizedBox(height: 8),
              Text(labels[i], style: const TextStyle(color: Colors.white54, fontSize: 11)),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildCompletionOwnership(List<Map<String, dynamic>> tasks) {
    final Map<String, int> counts = {};
    for (var t in tasks) {
      final owner = t['completedBy']?['name'];
      if (owner != null) {
        counts[owner] = (counts[owner] ?? 0) + 1;
      }
    }
    
    if (counts.isEmpty) return const Text('No completed tasks yet', style: TextStyle(color: Colors.white54));
    
    final maxVal = counts.values.reduce(max).toDouble();
    
    return Column(
      children: counts.entries.map((e) {
        final pct = maxVal == 0 ? 0.0 : e.value / maxVal;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              SizedBox(width: 80, child: Text(e.key, style: const TextStyle(color: Colors.white70, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 12,
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: pct,
                    child: Container(decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(4))),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 20, child: Text('${e.value}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12))),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildLatestActivity(Map<String, dynamic>? latestUpdated, String lastUpdater, Map<String, dynamic>? latestCompleted) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFF1E293B).withOpacity(0.5), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('MOST RECENTLY UPDATED', style: TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
              const SizedBox(height: 6),
              Text(latestUpdated?['title'] ?? '—', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 4),
              Text(lastUpdater != '—' ? 'Updated by $lastUpdater' : 'No update history yet', style: const TextStyle(color: Colors.white54, fontSize: 11)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFF1E293B).withOpacity(0.5), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('LATEST COMPLETION', style: TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
              const SizedBox(height: 6),
              Text(latestCompleted?['title'] ?? '—', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 4),
              Text(latestCompleted?['completedBy']?['name'] != null ? 'Completed by ${latestCompleted!['completedBy']['name']}' : 'No completed task yet', style: const TextStyle(color: Colors.white54, fontSize: 11)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildModuleCompletion(List<Map<String, dynamic>> tasks) {
    final Map<String, _Stats> stats = {};
    for (var t in tasks) {
      final mod = t['module'] as String? ?? 'Other';
      if (mod.isEmpty) continue;
      stats.putIfAbsent(mod, () => _Stats());
      stats[mod]!.total++;
      if (['completed', 'deployed'].contains(t['status'])) stats[mod]!.completed++;
    }

    if (stats.isEmpty) return const Text('No modules yet', style: TextStyle(color: Colors.white54));

    return Column(
      children: stats.entries.map((e) {
        final pct = e.value.total == 0 ? 0.0 : e.value.completed / e.value.total;
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(e.key, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                  Text.rich(TextSpan(children: [
                    TextSpan(text: '${e.value.completed}/${e.value.total} · ', style: const TextStyle(color: Colors.white54)),
                    TextSpan(text: '${(pct * 100).round()}%', style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold)),
                  ]), style: const TextStyle(fontSize: 12)),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(value: pct, backgroundColor: Colors.white10, valueColor: const AlwaysStoppedAnimation(Color(0xFF6366F1)), minHeight: 6),
              )
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTeamContribution(List<Map<String, dynamic>> tasks) {
    final Map<String, _Stats> stats = {};
    for (var t in tasks) {
      final name = t['assigneeName'] as String?;
      if (name == null || name.isEmpty) continue;
      stats.putIfAbsent(name, () => _Stats());
      stats[name]!.total++;
      if (['completed', 'deployed'].contains(t['status'])) stats[name]!.completed++;
    }

    if (stats.isEmpty) return const Text('No assigned tasks yet', style: TextStyle(color: Colors.white54));

    final maxVal = stats.values.map((s) => s.total).reduce(max).toDouble();

    return Column(
      children: stats.entries.map((e) {
        final pctTotal = maxVal == 0 ? 0.0 : e.value.total / maxVal;
        final pctComp = e.value.total == 0 ? 0.0 : e.value.completed / e.value.total;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              SizedBox(width: 80, child: Text(e.key, style: const TextStyle(color: Colors.white70, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 8),
              Expanded(
                child: Stack(
                  children: [
                    Container(height: 16, alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: pctTotal, child: Container(decoration: BoxDecoration(color: const Color(0xFF6366F1).withOpacity(0.3), borderRadius: BorderRadius.circular(4))))),
                    Container(height: 16, alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: pctTotal * pctComp, child: Container(decoration: BoxDecoration(color: const Color(0xFF6366F1), borderRadius: BorderRadius.circular(4))))),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 30, child: Text('${e.value.total}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12))),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _Stats {
  int total = 0;
  int completed = 0;
}

class _PieChartPainter extends CustomPainter {
  final List<double> values;
  final List<Color> colors;
  _PieChartPainter(this.values, this.colors);

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold(0.0, (s, v) => s + v);
    if (total == 0) return;

    final rect = Rect.fromCenter(center: Offset(size.width / 2, size.height / 2), width: size.width, height: size.height);
    double startAngle = -pi / 2;

    for (int i = 0; i < values.length; i++) {
      final sweepAngle = (values[i] / total) * 2 * pi;
      final paint = Paint()
        ..color = colors[i]
        ..style = PaintingStyle.stroke
        ..strokeWidth = 20
        ..strokeCap = StrokeCap.butt;
      
      canvas.drawArc(rect.deflate(10), startAngle, sweepAngle, false, paint);
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

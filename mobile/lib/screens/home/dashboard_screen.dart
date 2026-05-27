import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../home/home_screen.dart';

Color parseColor(String hex) {
  try { return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)); }
  catch (_) { return const Color(0xFF06B6D4); }
}

// ── Color palette (matches web)
const _kCyan   = Color(0xFF06B6D4);
const _kPurple = Color(0xFF8B5CF6);
const _kGreen  = Color(0xFF10B981);
const _kAmber  = Color(0xFFF59E0B);
const _kPink   = Color(0xFFEC4899);
const _kBlue   = Color(0xFF3B82F6);
const _kRed    = Color(0xFFEF4444);

const _kBgCard     = Color(0xFF0D1117);
const _kBgElevated = Color(0xFF111827);
const _kBorder     = Color(0x0DFFFFFF);


class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});
  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  final _uid = FirebaseAuth.instance.currentUser!.uid;
  final _user = FirebaseAuth.instance.currentUser!;
  final _db   = FirebaseFirestore.instance;

  String? _githubUsername;
  List<Map<String, dynamic>> _projects = [];
  final Map<String, List<Map<String, dynamic>>> _taskMap = {};
  bool _loading = true;
  StreamSubscription? _githubSub;

  @override
  void initState() {
    super.initState();
    _loadGithub();
    _listenProjects();
  }

  void _loadGithub() {
    _githubSub = _db.doc('users/$_uid').snapshots().listen((doc) {
      if (doc.exists && doc.data() != null) {
        if (mounted) setState(() => _githubUsername = doc.data()?['githubUsername']);
      }
    });
  }

  void _listenProjects() {
    _db.collection('projects')
        .where('members.$_uid.role', whereIn: ['admin', 'member', 'viewer'])
        .snapshots()
        .listen((snap) {
      final projects = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      setState(() { _projects = projects; _loading = false; });
      _listenTasks(projects);
    });
  }

  void _listenTasks(List<Map<String, dynamic>> projects) {
    for (final p in projects) {
      _db.collection('projects/${p['id']}/tasks').snapshots().listen((snap) {
        final tasks = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
        if (mounted) setState(() => _taskMap[p['id']] = tasks);
      });
    }
  }

  @override
  void dispose() {
    _githubSub?.cancel();
    super.dispose();
  }

  List<Map<String, dynamic>> get _allTasks => _taskMap.values.expand((t) => t).toList();


  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final name = _user.displayName?.split(' ').first ?? 'Developer';
    final allTasks = _allTasks;
    final activeProjects = _projects.where((p) => p['status'] == 'active').toList()
      ..sort((a, b) {
        final dtA = a['updatedAt'] != null ? (a['updatedAt'] as dynamic).toDate() as DateTime : DateTime(0);
        final dtB = b['updatedAt'] != null ? (b['updatedAt'] as dynamic).toDate() as DateTime : DateTime(0);
        return dtB.compareTo(dtA);
      });
    final completedTasks = allTasks.where((t) => ['completed', 'deployed'].contains(t['status'])).toList();
    final githubPushed = allTasks.where((t) => t['status'] == 'github_pushed').toList();
    final pendingActive = allTasks.where((t) => t['status'] != 'completed' && t['status'] != 'deployed').toList();

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: _loading
          ? const Center(child: MsDevLoader(color: _kCyan))
          : RefreshIndicator(
              color: _kCyan,
              backgroundColor: _kBgCard,
              onRefresh: () async { _listenProjects(); await Future.delayed(const Duration(seconds: 1)); },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [

                    // ── Hero Banner ──────────────────────────────────────
                    _buildHeroBanner(name, activeProjects.length, pendingActive.length),
                    const SizedBox(height: 20),

                    // ── Stats Grid (2×2) ──────────────────────────────────
                    _buildStatsGrid(activeProjects.length, allTasks.length, githubPushed.length, completedTasks.length),
                    const SizedBox(height: 20),

                    // ── GitHub Activity Map ──────────────────────────────
                    _buildGitHubCard(),
                    const SizedBox(height: 20),

                    // ── Active Projects ───────────────────────────────────
                    _buildSectionHeader('Active Projects', onTap: () {
                      ref.read(bottomNavIndexProvider.notifier).setIndex(1);
                      context.go('/projects');
                    }),
                    const SizedBox(height: 12),
                    _buildProjectsList(activeProjects),
                    const SizedBox(height: 20),

                    // ── Upcoming Deadlines ───────────────────────────────
                    _buildSectionHeader('Upcoming Deadlines', showDue: true, onTap: () {
                      ref.read(bottomNavIndexProvider.notifier).setIndex(1);
                      context.go('/projects');
                    }),
                    const SizedBox(height: 12),
                    _buildDeadlinesList(pendingActive),
                    const SizedBox(height: 20),

                    // ── Weekly Productivity ──────────────────────────────
                    _buildProductivityCard(),
                    const SizedBox(height: 20),

                    // ── Recent Activity ──────────────────────────────────
                    _buildSectionHeader('Recent Activity'),
                    const SizedBox(height: 12),
                    _buildRecentActivity(allTasks),
                  ],
                ),
              ),
            ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // WIDGETS
  // ═══════════════════════════════════════════════════════════

  Widget _buildHeroBanner(String name, int activeCount, int pendingCount) {
    final photoURL = _user.photoURL;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kBgElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(colors: [_kCyan, _kPurple], begin: Alignment.topLeft, end: Alignment.bottomRight),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1), width: 2),
            ),
            child: ClipOval(
              child: photoURL != null
                  ? CachedNetworkImage(imageUrl: photoURL, fit: BoxFit.cover)
                  : Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'U',
                      style: GoogleFonts.raleway(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white))),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$_greeting, $name 👋',
                    style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.3)),
                const SizedBox(height: 4),
                Text('$pendingCount active tasks across $activeCount projects',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 13)),
              ],
            ),
          ),
          // New Project button
          GestureDetector(
            onTap: () => context.push('/create-project'),
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: _kCyan.withValues(alpha: 0.15),
                shape: BoxShape.circle,
                border: Border.all(color: _kCyan.withValues(alpha: 0.3)),
              ),
              child: const Icon(Icons.add_rounded, color: _kCyan, size: 20),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.1);
  }

  Widget _buildStatsGrid(int active, int total, int githubSync, int completed) {
    final stats = [
      {'label': 'Active Projects', 'value': active, 'color': _kCyan,   'icon': Icons.folder_outlined},
      {'label': 'Total Tasks',     'value': total,  'color': _kPurple, 'icon': Icons.task_alt_rounded},
      {'label': 'GitHub Sync',     'value': githubSync, 'color': _kGreen, 'icon': Icons.code_rounded},
      {'label': 'Completed',       'value': completed, 'color': _kAmber, 'icon': Icons.check_circle_outline_rounded},
    ];

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.55,
      children: stats.asMap().entries.map((e) {
        final i = e.key;
        final s = e.value;
        final color = s['color'] as Color;
        return _buildStatCard(
          label: s['label'] as String,
          value: s['value'] as int,
          icon: s['icon'] as IconData,
          color: color,
          delay: i * 60,
        );
      }).toList(),
    );
  }

  Widget _buildStatCard({required String label, required int value, required IconData icon, required Color color, int delay = 0}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _kBgElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Stack(
        children: [
          // Glow
          Positioned(
            top: 0, right: 0,
            child: Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                gradient: RadialGradient(colors: [color.withValues(alpha: 0.12), Colors.transparent]),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                    child: Icon(icon, color: color, size: 16),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$value', style: GoogleFonts.raleway(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white, height: 1)),
                  const SizedBox(height: 3),
                  Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.45), fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(delay: delay.ms).slideY(begin: 0.1);
  }

  Widget _buildGitHubCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kBgElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Activity Map', style: GoogleFonts.raleway(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              if (_githubUsername != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(99)),
                  child: Text('@$_githubUsername', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          if (_githubUsername != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                height: 90,
                width: double.infinity,
                decoration: const BoxDecoration(color: Color(0xFF0F1522)),
                child: Stack(
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      reverse: true,
                      physics: const BouncingScrollPhysics(),
                      child: SvgPicture.network(
                        'https://ghchart.rshah.org/06b6d4/$_githubUsername',
                        height: 90,
                        fit: BoxFit.fitHeight,
                        colorFilter: const ColorFilter.mode(Colors.white, BlendMode.modulate),
                        placeholderBuilder: (_) => _buildFakeActivityGrid(),
                      ),
                    ),
                    Positioned(
                      left: 0, top: 0, bottom: 0,
                      width: 60,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [const Color(0xFF0F1522), const Color(0xFF0F1522).withValues(alpha: 0.0)],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 14, top: 14,
                      child: Text(
                        DateFormat('MMM').format(DateTime.now()).toUpperCase(),
                        style: const TextStyle(
                          color: Color(0xFF5F7598),
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Stack(
              children: [
                _buildFakeActivityGrid(),
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(8)),
                    child: Center(
                      child: GestureDetector(
                        onTap: () => context.push('/settings'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: _kCyan,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.code_rounded, color: Colors.white, size: 15),
                              SizedBox(width: 6),
                              Text('Connect GitHub', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms);
  }

  Widget _buildFakeActivityGrid() {
    final seed = DateTime.now().millisecondsSinceEpoch;
    return Opacity(
      opacity: 0.3,
      child: Container(
        height: 72, width: double.infinity,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), color: _kBgCard),
        child: GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(4),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 24, mainAxisSpacing: 3, crossAxisSpacing: 3,
          ),
          itemCount: 96,
          itemBuilder: (_, i) {
            final intensity = ((seed + i * 37) % 5);
            final colors = [_kBgCard, const Color(0xFF064E3B), const Color(0xFF059669), _kGreen, const Color(0xFF34D399)];
            return Container(decoration: BoxDecoration(color: colors[intensity], borderRadius: BorderRadius.circular(2)));
          },
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, {VoidCallback? onTap, bool showDue = false}) {
    return Row(
      children: [
        Text(title, style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
        if (showDue) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: _kRed, borderRadius: BorderRadius.circular(4)),
            child: const Text('Due', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
          ),
        ],
        const Spacer(),
        if (onTap != null)
          GestureDetector(
            onTap: onTap,
            child: Row(
              children: [
                const Text('View all', style: TextStyle(color: _kCyan, fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_forward_rounded, color: _kCyan, size: 14),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildProjectsList(List<Map<String, dynamic>> projects) {
    if (projects.isEmpty) {
      return _buildEmptyCard('No active projects. Create one! ✨');
    }

    final colors = [_kCyan, _kPurple, _kGreen, _kAmber, _kPink, _kBlue];

    return SizedBox(
      height: 165,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: projects.length,
        itemBuilder: (_, i) {
          final p = projects[i];
          final projectColor = p['color'] != null ? parseColor(p['color']) : colors[i % colors.length];
          final tasks = _taskMap[p['id']] ?? [];
          final done = tasks.where((t) => ['completed', 'deployed'].contains(t['status'])).length;
          final progress = tasks.isEmpty ? 0.0 : done / tasks.length;
          final members = p['members'] as Map<String, dynamic>? ?? {};

          return GestureDetector(
            onTap: () => context.go('/projects/${p['id']}'),
            child: Container(
              width: MediaQuery.of(context).size.width * 0.78,
              margin: EdgeInsets.only(right: 12, left: i == 0 ? 0 : 0),
              decoration: BoxDecoration(
                color: _kBgElevated,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _kBorder),
              ),
              child: Stack(
                children: [
                  // Gradient top bar
                  Positioned(
                    top: 0, left: 0, right: 0,
                    child: Container(
                      height: 3,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [projectColor, projectColor.withValues(alpha: 0.0)]),
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(child: Text(p['name'] ?? '', style: GoogleFonts.raleway(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(p['description'] ?? 'No description available for this project.',
                            style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.4), height: 1.4),
                            maxLines: 2, overflow: TextOverflow.ellipsis),
                        const Spacer(),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(children: [
                              Icon(Icons.task_alt_rounded, size: 12, color: Colors.white.withValues(alpha: 0.4)),
                              const SizedBox(width: 4),
                              Text('${tasks.length} tasks', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.4))),
                              const SizedBox(width: 12),
                              Icon(Icons.people_outline_rounded, size: 12, color: Colors.white.withValues(alpha: 0.4)),
                              const SizedBox(width: 4),
                              Text('${members.length} team', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.4))),
                            ]),
                            Text('${(progress * 100).round()}%',
                                style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: progress, minHeight: 4,
                            backgroundColor: Colors.white.withValues(alpha: 0.06),
                            valueColor: AlwaysStoppedAnimation(projectColor),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ).animate().fadeIn(delay: (i * 60).ms).slideX(begin: 0.1);
        },
      ),
    );
  }

  Widget _buildDeadlinesList(List<Map<String, dynamic>> tasks) {
    if (tasks.isEmpty) {
      return _buildEmptyCard('No upcoming tasks 🎉');
    }
    return Column(
      children: tasks.asMap().entries.map((e) {
        final i = e.key;
        final t = e.value;
        final dotColor = i == 0 ? _kRed : _kAmber;
        return GestureDetector(
          onTap: () {
            final pid = t['projectId'] ?? '';
            if (pid.isNotEmpty) context.go('/projects/$pid');
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: _kBgElevated,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _kBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: dotColor.withValues(alpha: 0.5), blurRadius: 6)]),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(t['title'] ?? 'Untitled', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
                Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.white.withValues(alpha: 0.3)),
              ],
            ),
          ),
        ).animate().fadeIn(delay: (i * 50).ms);
      }).toList(),
    );
  }

  Widget _buildProductivityCard() {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final todayIdx = DateTime.now().weekday - 1; // 0=Mon
    
    // Calculate authentic productivity data from tasks
    final List<double> heights = List.filled(7, 10.0);
    final now = DateTime.now();
    for (final t in _allTasks) {
      if (t['status'] == 'completed' || t['status'] == 'deployed') {
        final rawAt = t['completedAt'] ?? t['updatedAt'];
        if (rawAt != null) {
          final dt = (rawAt as dynamic).toDate() as DateTime;
          if (now.difference(dt).inDays < 7) {
            final idx = dt.weekday - 1;
            heights[idx] += 20.0; // Boost bar height for every completed task
          }
        }
      }
    }
    // Cap max bar height visually at 100
    for (int i=0; i<7; i++) {
       if (heights[i] > 100.0) heights[i] = 100.0;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kBgElevated, borderRadius: BorderRadius.circular(16), border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Weekly Productivity', style: GoogleFonts.raleway(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 20),
          SizedBox(
            height: 110,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: days.asMap().entries.map((e) {
                final i = e.key;
                final isToday = i == todayIdx;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Flexible(
                          child: FractionallySizedBox(
                            alignment: Alignment.bottomCenter,
                            heightFactor: heights[i] / 100,
                            child: Container(
                              decoration: BoxDecoration(
                                color: isToday ? _kCyan : Colors.white.withValues(alpha: 0.1),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                boxShadow: isToday ? [BoxShadow(color: _kCyan.withValues(alpha: 0.4), blurRadius: 8)] : [],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(days[i],
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                                color: isToday ? Colors.white : Colors.white.withValues(alpha: 0.35))),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 300.ms);
  }

  Widget _buildRecentActivity(List<Map<String, dynamic>> tasks) {
    if (tasks.isEmpty) {
      return _buildEmptyCard('No recent activity');
    }
    final recent = tasks.take(4).toList();
    final name = _user.displayName?.split(' ').first ?? 'You';
    return Column(
      children: recent.asMap().entries.map((e) {
        final i = e.key;
        final t = e.value;
        final rawAt = t['updatedAt'];
        final updatedAt = rawAt != null ? (rawAt as dynamic).toDate() as DateTime? : null;
        final timeStr = updatedAt != null ? _timeAgo(updatedAt) : 'Just now';
        final status = t['status'] as String? ?? 'updated';
        String action = 'updated';
        String emoji = '✨';
        if (status == 'deployed') { action = 'deployed'; emoji = '🚀'; }
        else if (status == 'completed') { action = 'completed'; emoji = '✅'; }
        else if (status == 'github_pushed') { action = 'pushed code for'; emoji = '💻'; }
        else if (status == 'in_progress') { action = 'is working on'; emoji = '🔨'; }

        final title = (t['title'] as String? ?? 'a task');
        final shortTitle = title.length > 20 ? '${title.substring(0, 20)}...' : title;

        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  Container(
                    width: 30, height: 30,
                    decoration: BoxDecoration(color: _kBgElevated, shape: BoxShape.circle, border: Border.all(color: _kBorder)),
                    child: Center(child: Text(emoji, style: const TextStyle(fontSize: 13))),
                  ),
                  if (i < recent.length - 1)
                    Container(width: 2, height: 24, color: Colors.white.withValues(alpha: 0.05)),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(style: const TextStyle(fontSize: 13, color: Color(0xFFCBD5E1), height: 1.4), children: [
                        TextSpan(text: name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                        TextSpan(text: ' $action '),
                        TextSpan(text: shortTitle, style: const TextStyle(color: _kCyan, fontWeight: FontWeight.w500)),
                      ]),
                    ),
                    const SizedBox(height: 3),
                    Text(timeStr, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.35))),
                  ],
                ),
              ),
            ],
          ),
        ).animate().fadeIn(delay: (i * 80).ms);
      }).toList(),
    );
  }

  Widget _buildEmptyCard(String msg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24),
      decoration: BoxDecoration(
        color: _kBgElevated, borderRadius: BorderRadius.circular(14), border: Border.all(color: _kBorder),
      ),
      child: Text(msg, textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 13)),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(dt);
  }
}

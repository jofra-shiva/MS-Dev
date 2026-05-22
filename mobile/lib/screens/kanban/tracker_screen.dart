import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

class TrackerScreen extends StatefulWidget {
  final String projectId;
  const TrackerScreen({super.key, required this.projectId});

  @override
  State<TrackerScreen> createState() => _TrackerScreenState();
}

class _TrackerScreenState extends State<TrackerScreen> {
  String _activeTab = 'all';

  final List<Map<String, String>> _tabs = [
    {'id': 'all', 'label': 'All Tasks'},
    {'id': 'bug', 'label': 'Bugs'},
    {'id': 'feature', 'label': 'Features'},
    {'id': 'improvement', 'label': 'Improvements'},
  ];

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
          onPressed: () => context.canPop() ? context.pop() : context.go('/projects/${widget.projectId}'),
        ),
        title: Text('Project Tracker', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks').orderBy('createdAt', descending: true).snapshots(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
          }

          final allTasks = snap.data?.docs ?? [];
          final visibleTasks = _activeTab == 'all' ? allTasks : allTasks.where((d) => (d.data() as Map)['type'] == _activeTab).toList();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text('${allTasks.length} tasks · Spreadsheet view', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13)),
                        const SizedBox(width: 12),
                        const Icon(Icons.circle, color: Color(0xFF10B981), size: 8),
                        const SizedBox(width: 4),
                        const Text('Live update', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
              
              // Tabs
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: _tabs.map((t) {
                    final isActive = _activeTab == t['id'];
                    return GestureDetector(
                      onTap: () => setState(() => _activeTab = t['id']!),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: isActive ? const Color(0xFF1E293B) : Colors.transparent,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(t['label']!, style: TextStyle(color: isActive ? Colors.white : Colors.white.withOpacity(0.5), fontSize: 13, fontWeight: FontWeight.bold)),
                      ),
                    );
                  }).toList(),
                ),
              ),
              
              const SizedBox(height: 16),
              const Divider(height: 1, color: Color(0xFF1E293B)),
              
              // Table
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF1E293B), width: 1),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.vertical,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Left Sticky Column
                          Container(
                            decoration: const BoxDecoration(
                              border: Border(right: BorderSide(color: Color(0xFF1E293B), width: 1)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildHeaderRow([
                                  _HeaderCol('S.No', 40),
                                  _HeaderCol('Task Title', 140),
                                ]),
                                ...visibleTasks.asMap().entries.map((e) {
                                  final t = e.value.data() as Map<String, dynamic>;
                                  final title = t['title'] as String? ?? '';
                                  return _buildDataRow(
                                    e.key % 2 == 0 ? Colors.transparent : const Color(0xFF1E293B).withOpacity(0.3),
                                    [
                                      _DataCol('${e.key + 1}', 40, isMuted: true),
                                      _DataCol(title, 140, isBold: true),
                                    ],
                                  );
                                }),
                              ],
                            ),
                          ),
                          // Right Scrollable Columns
                          Expanded(
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildHeaderRow([
                                    _HeaderCol('Type', 100),
                                    _HeaderCol('Status', 120),
                                    _HeaderCol('Priority', 100),
                                    _HeaderCol('Module', 120),
                                    _HeaderCol('Assignee', 140),
                                    _HeaderCol('Progress', 120),
                                    _HeaderCol('Last Completed By', 160),
                                    _HeaderCol('GitHub Status', 140),
                                    _HeaderCol('Due Date', 120),
                                    _HeaderCol('Created At', 150),
                                    _HeaderCol('Updated At', 150),
                                    _HeaderCol('Completed At', 150),
                                    _HeaderCol('Last Commit', 120),
                                  ]),
                                  ...visibleTasks.asMap().entries.map((e) {
                                    final t = e.value.data() as Map<String, dynamic>;
                                    return _buildDataRow(
                                      e.key % 2 == 0 ? Colors.transparent : const Color(0xFF1E293B).withOpacity(0.3),
                                      [
                                        _DataColWidget(_buildType(t['type']), 100),
                                        _DataColWidget(_buildStatus(t['status']), 120),
                                        _DataColWidget(_buildPriority(t['priority']), 100),
                                        _DataCol(t['module'] as String? ?? '-', 120),
                                        _DataCol(t['assigneeName'] as String? ?? '-', 140),
                                        _DataColWidget(_buildProgress(t['progress']), 120),
                                        _DataCol(t['completedBy']?['name'] ?? '-', 160, isMuted: true),
                                        _DataColWidget(_buildGithubStatus(t['githubRef']?['lastCommitSha']), 140),
                                        _DataCol(_formatDate(t['dueDate']), 120),
                                        _DataCol(_formatDateTime(t['createdAt']), 150),
                                        _DataCol(_formatDateTime(t['updatedAt']), 150),
                                        _DataCol(_formatDateTime(t['completedAt']), 150),
                                        _DataCol(t['githubRef']?['lastCommitSha']?.toString().substring(0, 7) ?? '-', 120, isCode: true),
                                      ],
                                    );
                                  }),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          );
        },
      ),
    );
  }

  // --- Helper Methods for Tracker Cells ---

  Widget _buildHeaderRow(List<_HeaderCol> cols) {
    return Container(
      height: 44,
      decoration: const BoxDecoration(
        color: Color(0xFF141C2F),
        border: Border(bottom: BorderSide(color: Color(0xFF1E293B), width: 1)),
      ),
      child: Row(
        children: cols.map((c) => Container(
          width: c.width,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.centerLeft,
          child: Text(c.label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.w700)),
        )).toList(),
      ),
    );
  }

  Widget _buildDataRow(Color bgColor, List<Widget> cols) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: bgColor,
        border: const Border(bottom: BorderSide(color: Color(0xFF1E293B), width: 1)),
      ),
      child: Row(children: cols),
    );
  }

  Widget _DataCol(String text, double width, {bool isBold = false, bool isMuted = false, bool isCode = false}) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.centerLeft,
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: isMuted ? Colors.white54 : (isCode ? const Color(0xFF38BDF8) : Colors.white),
          fontSize: 13,
          fontWeight: isBold ? FontWeight.w600 : FontWeight.normal,
          fontFamily: isCode ? 'monospace' : null,
        ),
      ),
    );
  }

  Widget _DataColWidget(Widget child, double width) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.centerLeft,
      child: child,
    );
  }

  Widget _buildType(dynamic typeVal) {
    final type = typeVal?.toString() ?? '';
    String label = 'Task';
    if (type == 'bug') label = 'Bug';
    if (type == 'feature') label = 'Feature';
    if (type == 'improvement') label = 'Imp.';
    return Text(label, style: const TextStyle(color: Colors.white, fontSize: 13));
  }

  Widget _buildStatus(dynamic statusVal) {
    final status = statusVal?.toString() ?? 'pending';
    Color color = const Color(0xFF475569);
    if (status == 'in_progress') color = const Color(0xFFF59E0B);
    if (status == 'testing') color = const Color(0xFF38BDF8);
    if (status == 'completed' || status == 'github_pushed' || status == 'deployed') color = const Color(0xFF10B981);
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
      child: Text(status.replaceAll('_', ' ').toUpperCase(), style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800)),
    );
  }

  Widget _buildPriority(dynamic priorityVal) {
    final priority = priorityVal?.toString() ?? 'low';
    Color color = const Color(0xFF475569);
    if (priority == 'medium') color = const Color(0xFF38BDF8);
    if (priority == 'high') color = const Color(0xFFF59E0B);
    if (priority == 'urgent') color = const Color(0xFFEF4444);
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
      child: Text(priority.toUpperCase(), style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800)),
    );
  }

  Widget _buildProgress(dynamic progressVal) {
    final progress = (progressVal as num?)?.toDouble() ?? 0.0;
    return Row(
      children: [
        Container(
          width: 50, height: 6,
          decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(99)),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: (progress / 100).clamp(0.0, 1.0),
            child: Container(decoration: BoxDecoration(color: const Color(0xFF8B5CF6), borderRadius: BorderRadius.circular(99))),
          ),
        ),
        const SizedBox(width: 8),
        Text('${progress.toInt()}%', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
      ],
    );
  }

  Widget _buildGithubStatus(dynamic commitSha) {
    if (commitSha != null && commitSha.toString().isNotEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
        child: const Text('VERIFIED', style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.w800)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: const Color(0xFF475569).withOpacity(0.15), borderRadius: BorderRadius.circular(99)),
      child: const Text('UNLINKED', style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.w800)),
    );
  }

  String _formatDate(dynamic timestamp) {
    if (timestamp == null) return '-';
    if (timestamp is Timestamp) return DateFormat('MMM d, yyyy').format(timestamp.toDate());
    return '-';
  }

  String _formatDateTime(dynamic timestamp) {
    if (timestamp == null) return '-';
    if (timestamp is Timestamp) return DateFormat('MMM d, yy HH:mm').format(timestamp.toDate());
    return '-';
  }
}

class _HeaderCol {
  final String label;
  final double width;
  _HeaderCol(this.label, this.width);
}

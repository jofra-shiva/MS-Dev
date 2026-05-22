import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_fonts/google_fonts.dart';

class ProjectShellScreen extends StatelessWidget {
  final Widget child;
  final String projectId;
  
  const ProjectShellScreen({super.key, required this.child, required this.projectId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      backgroundColor: const Color(0xFF070B14),
      body: child,
      bottomNavigationBar: _ProjectScrollableBottomNav(projectId: projectId),
    );
  }
}

class _ProjectScrollableBottomNav extends StatefulWidget {
  final String projectId;
  const _ProjectScrollableBottomNav({required this.projectId});

  @override
  State<_ProjectScrollableBottomNav> createState() => _ProjectScrollableBottomNavState();
}

class _ProjectScrollableBottomNavState extends State<_ProjectScrollableBottomNav> {
  final _tabs = [
    {'label': 'Overview', 'icon': '📊', 'path': ''},
    {'label': 'A to Z', 'icon': '🗂️', 'path': 'kanban'},
    {'label': 'Tracker', 'icon': '📋', 'path': 'tracker'},
    {'label': 'Analytics', 'icon': '📈', 'path': 'analytics'},
    {'label': 'Activity', 'icon': '⚡', 'path': 'activity'},
    {'label': 'Meetings', 'icon': '📅', 'path': 'meetings'},
    {'label': 'GitHub', 'icon': '🔗', 'path': 'github'},
    {'label': 'Settings', 'icon': '⚙️', 'path': 'settings'},
  ];

  int _getSelectedIndex(String currentPath) {
    if (currentPath.endsWith('/kanban')) return 1;
    if (currentPath.endsWith('/tracker')) return 2;
    if (currentPath.endsWith('/analytics')) return 3;
    if (currentPath.endsWith('/activity')) return 4;
    if (currentPath.contains('/meetings')) return 5;
    if (currentPath.endsWith('/github')) return 6;
    if (currentPath.endsWith('/settings')) return 7;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final currentPath = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _getSelectedIndex(currentPath);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SafeArea(
          child: Container(
          margin: const EdgeInsets.only(bottom: 16),
          height: 60,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF141C2F),
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 5)),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: _tabs.asMap().entries.map((e) {
                  final i = e.key;
                  final item = e.value;
                  final isSelected = i == selectedIndex;
                  return GestureDetector(
                    onTap: () {
                      final path = item['path'] as String;
                      final expectedPath = '/projects/${widget.projectId}${path.isEmpty ? '' : '/$path'}';
                      if (currentPath != expectedPath) {
                        context.go(expectedPath);
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFF59E0B) : Colors.transparent,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(item['icon'] as String, style: const TextStyle(fontSize: 20)),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ),
        ),
      ],
    );
  }
}

// Simple placeholders for unimplemented screens
class ProjectPlaceholderScreen extends StatelessWidget {
  final String title;
  const ProjectPlaceholderScreen({super.key, required this.title});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(title, style: const TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/projects');
            }
          }
        ),
      ),
      body: Center(
        child: Text('$title Screen Coming Soon', style: TextStyle(color: Colors.white.withOpacity(0.5))),
      ),
    );
  }
}

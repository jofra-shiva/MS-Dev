import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';

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
      bottomNavigationBar: _ProjectBottomNav(projectId: projectId),
    );
  }
}

class _ProjectBottomNav extends StatefulWidget {
  final String projectId;
  const _ProjectBottomNav({required this.projectId});

  @override
  State<_ProjectBottomNav> createState() => _ProjectBottomNavState();
}

class _ProjectBottomNavState extends State<_ProjectBottomNav> {
  final _tabs = [
    {'icon': Icons.dashboard_outlined, 'path': ''},
    {'icon': Icons.view_kanban_outlined, 'path': 'kanban'},
    {'icon': Icons.groups_outlined, 'path': 'meetings'},
    {'icon': Icons.insights_outlined, 'path': 'analytics'},
    {'icon': Icons.code_outlined, 'path': 'github'},
    {'icon': Icons.settings_outlined, 'path': 'settings'},
  ];

  int _getSelectedIndex(String currentPath) {
    if (currentPath.endsWith('/kanban')) return 1;
    if (currentPath.contains('/meetings')) return 2;
    if (currentPath.endsWith('/analytics')) return 3;
    if (currentPath.endsWith('/github')) return 4;
    if (currentPath.endsWith('/settings')) return 5;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final currentPath = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _getSelectedIndex(currentPath);

    return CurvedNavigationBar(
      index: selectedIndex < _tabs.length ? selectedIndex : 0,
      backgroundColor: Colors.transparent,
      color: const Color(0xFF0D1117),
      buttonBackgroundColor: const Color(0xFFF59E0B),
      height: 65,
      animationDuration: const Duration(milliseconds: 300),
      animationCurve: Curves.easeInOutCubic,
      items: _tabs.map((item) => Icon(
        item['icon'] as IconData, 
        size: 28, 
        color: Colors.white,
      )).toList(),
      letIndexChange: (i) => true,
      onTap: (i) {
        final path = _tabs[i]['path'] as String;
        final expectedPath = '/projects/${widget.projectId}${path.isEmpty ? '' : '/$path'}';
        if (currentPath != expectedPath) {
          context.go(expectedPath);
        }
      },
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

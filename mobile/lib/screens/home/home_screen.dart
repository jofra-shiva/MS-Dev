import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final bottomNavIndexProvider = StateProvider<int>((ref) => 0);

class HomeScreen extends ConsumerStatefulWidget {
  final Widget child;
  const HomeScreen({super.key, required this.child});
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _items = [
    {'icon': Icons.home_rounded, 'path': '/'},
    {'icon': Icons.folder_outlined, 'path': '/projects'},
    {'icon': Icons.add, 'path': ''},
    {'icon': Icons.notifications_outlined, 'path': '/notifications'},
  ];

  @override
  Widget build(BuildContext context) {
    final selectedIndex = ref.watch(bottomNavIndexProvider);

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: CurvedNavigationBar(
        index: selectedIndex,
        backgroundColor: const Color(0xFF070B14), // Scaffold background color
        color: const Color(0xFF0D1117), // Nav bar color
        buttonBackgroundColor: const Color(0xFFF59E0B), // Orange floating circle
        height: 65,
        animationDuration: const Duration(milliseconds: 300),
        items: _items.map((item) => Icon(
          item['icon'] as IconData, 
          size: 30, 
          color: Colors.white,
        )).toList(),
        onTap: (i) {
          if (i == 2) {
            // It's the "+" button, don't change screen, just push
            setState(() {}); 
            context.push('/create-project');
            
            Future.delayed(const Duration(milliseconds: 100), () {
              if (mounted) {}
            });
          } else {
            ref.read(bottomNavIndexProvider.notifier).state = i;
            context.go(_items[i]['path'] as String);
          }
        },
      ),
    );
  }
}

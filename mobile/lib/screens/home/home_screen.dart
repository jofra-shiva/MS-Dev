import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends StatefulWidget {
  final Widget child;
  const HomeScreen({super.key, required this.child});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  final _items = [
    {'icon': Icons.folder_outlined, 'activeIcon': Icons.folder, 'label': 'Projects', 'path': '/'},
    {'icon': Icons.notifications_outlined, 'activeIcon': Icons.notifications, 'label': 'Alerts', 'path': '/notifications'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.06))),
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          backgroundColor: Colors.transparent,
          elevation: 0,
          onTap: (i) {
            setState(() => _selectedIndex = i);
            context.go(_items[i]['path'] as String);
          },
          items: _items.map((item) => BottomNavigationBarItem(
            icon: Icon(item['icon'] as IconData),
            activeIcon: Icon(item['activeIcon'] as IconData),
            label: item['label'] as String,
          )).toList(),
        ),
      ),
    );
  }
}

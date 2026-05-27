import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';

class BottomNavIndexNotifier extends Notifier<int> {
  @override
  int build() => 0;
  void setIndex(int i) => state = i;
}

final bottomNavIndexProvider = NotifierProvider<BottomNavIndexNotifier, int>(BottomNavIndexNotifier.new);

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
    {'icon': Icons.chat_bubble_outline_rounded, 'path': '/messages'},
    {'icon': Icons.notifications_outlined, 'path': '/notifications'},
  ];

  @override
  Widget build(BuildContext context) {
    final selectedIndex = ref.watch(bottomNavIndexProvider);

    final user = FirebaseAuth.instance.currentUser;
    final userPhoto = user?.photoURL;
    final initials = (user?.displayName ?? 'U').isNotEmpty ? (user?.displayName ?? 'U')[0].toUpperCase() : 'U';

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF070B14),
        elevation: 0,
        title: Row(
          children: [
            Image.asset('assets/images/MSDEV.png', height: 24, width: 24),
            const SizedBox(width: 8),
            Text('MSDev', style: GoogleFonts.raleway(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.white60, size: 22),
            onPressed: () => context.push('/settings'),
          ),
          GestureDetector(
            onTap: () => context.push('/profile'),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFF1E2740),
              backgroundImage: userPhoto != null && !userPhoto.startsWith('/')
                  ? NetworkImage(userPhoto)
                  : (userPhoto != null && userPhoto.startsWith('/') ? AssetImage('assets/images$userPhoto') : null) as ImageProvider?,
              child: userPhoto == null
                  ? Text(initials, style: GoogleFonts.raleway(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white))
                  : null,
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
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
            // It's the "+" button — push create project
            context.push('/create-project');
          } else {
            ref.read(bottomNavIndexProvider.notifier).setIndex(i);
            context.go(_items[i]['path'] as String);
          }
        },
      ),
    );
  }
}

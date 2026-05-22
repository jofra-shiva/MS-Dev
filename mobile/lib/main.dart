import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'router/app_router.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const ProviderScope(child: MSDEVApp()));
}

class MSDEVApp extends ConsumerWidget {
  const MSDEVApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'MSDEV',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(Brightness.dark),
      routerConfig: router,
    );
  }

  ThemeData _buildTheme(Brightness brightness) {
    final base = brightness == Brightness.dark
        ? ThemeData.dark(useMaterial3: true)
        : ThemeData.light(useMaterial3: true);

    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF6366F1),
        brightness: brightness,
        surface: const Color(0xFF0D1117),
        background: const Color(0xFF070B14),
      ),
      scaffoldBackgroundColor: const Color(0xFF070B14),
      cardColor: const Color(0xFF0D1117),
      textTheme: GoogleFonts.ralewayTextTheme(base.textTheme).apply(
        bodyColor: Colors.white,
        displayColor: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF0D1117),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF0D1117),
        selectedItemColor: Color(0xFF6366F1),
        unselectedItemColor: Color(0xFF64748B),
      ),
    );
  }
}

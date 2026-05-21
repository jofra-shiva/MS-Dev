import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../screens/auth/login_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/projects/projects_screen.dart';
import '../screens/projects/project_detail_screen.dart';
import '../screens/kanban/kanban_screen.dart';
import '../screens/notifications/notifications_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final user = FirebaseAuth.instance.currentUser;
      final isLogin = state.matchedLocation == '/login';
      if (user == null && !isLogin) return '/login';
      if (user != null && isLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => HomeScreen(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const ProjectsScreen()),
          GoRoute(
            path: '/projects/:id',
            builder: (_, state) => ProjectDetailScreen(projectId: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'kanban',
                builder: (_, state) => KanbanScreen(projectId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
        ],
      ),
    ],
  );
});

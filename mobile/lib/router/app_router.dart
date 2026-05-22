
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../screens/auth/login_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/home/dashboard_screen.dart';
import '../screens/projects/projects_screen.dart';
import '../screens/projects/project_detail_screen.dart';
import '../screens/kanban/kanban_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../screens/projects/project_shell_screen.dart';
import '../screens/projects/create_project_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/kanban/tracker_screen.dart';
import '../screens/meetings/meetings_screen.dart';
import '../screens/meetings/create_meeting_screen.dart';
import '../screens/meetings/meeting_detail_screen.dart';
import '../screens/projects/analytics_screen.dart';
import '../screens/projects/activity_screen.dart';
import '../screens/projects/github_screen.dart';
import '../screens/projects/project_settings_screen.dart';

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
      
      // Global Shell (Home, Notifications)
      ShellRoute(
        builder: (context, state, child) => HomeScreen(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/projects', builder: (_, __) => const ProjectsScreen()),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
        ],
      ),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/create-project', builder: (_, __) => const CreateProjectScreen()),
      GoRoute(
        path: '/projects/:projectId/meetings/create',
        builder: (_, state) => CreateMeetingScreen(projectId: state.pathParameters['projectId']!),
      ),
      GoRoute(
        path: '/projects/:projectId/meetings/:meetingId',
        builder: (_, state) => MeetingDetailScreen(
          projectId: state.pathParameters['projectId']!,
          meetingId: state.pathParameters['meetingId']!,
        ),
      ),

      // Project Context Shell (Overview, A to Z, Tracker, etc.)
      ShellRoute(
        builder: (context, state, child) {
          final uri = Uri.parse(state.matchedLocation);
          final segments = uri.pathSegments;
          String projectId = '';
          if (segments.length >= 2 && segments[0] == 'projects') {
            projectId = segments[1];
          }
          return ProjectShellScreen(projectId: projectId, child: child);
        },
        routes: [
          GoRoute(
            path: '/projects/:id',
            builder: (_, state) => ProjectDetailScreen(projectId: state.pathParameters['id']!),
            routes: [
              GoRoute(path: 'kanban', builder: (_, state) => KanbanScreen(projectId: state.pathParameters['id']!)),
              GoRoute(path: 'meetings', builder: (_, state) => MeetingsScreen(projectId: state.pathParameters['id']!)),
              GoRoute(path: 'tracker', builder: (_, state) => TrackerScreen(projectId: state.pathParameters['id']!)),
              GoRoute(path: 'analytics', builder: (_, state) => AnalyticsScreen(projectId: state.pathParameters['id']!)),
              GoRoute(path: 'activity', builder: (_, state) => ActivityScreen(projectId: state.pathParameters['id']!)),
              GoRoute(path: 'github', builder: (_, state) => GithubScreen(projectId: state.pathParameters['id']!)),
              GoRoute(path: 'settings', builder: (_, state) => ProjectSettingsScreen(projectId: state.pathParameters['id']!)),
            ],
          ),
        ],
      ),
    ],
  );
});

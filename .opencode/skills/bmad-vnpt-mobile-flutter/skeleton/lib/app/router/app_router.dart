import 'package:go_router/go_router.dart';
import '../../features/example/presentation/screens/example_screen.dart';

final GoRouter appRouter = GoRouter(
  routes: <RouteBase>[
    GoRoute(
      path: '/',
      builder: (context, state) => const ExampleScreen(),
    ),
  ],
);

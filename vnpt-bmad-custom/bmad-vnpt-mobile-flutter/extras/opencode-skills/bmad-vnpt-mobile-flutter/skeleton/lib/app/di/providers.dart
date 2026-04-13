import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/example/data/repositories/example_repository.dart';
import '../../features/example/data/services/example_service.dart';

final exampleServiceProvider = Provider<ExampleService>((ref) {
  return ExampleService();
});

final exampleRepositoryProvider = Provider<ExampleRepository>((ref) {
  return ExampleRepositoryImpl(ref.watch(exampleServiceProvider));
});

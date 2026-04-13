import 'package:flutter_riverpod/flutter_riverpod.dart';

final exampleRepositoryProvider = Provider<ExampleRepository>((ref) {
  throw UnimplementedError();
});

final exampleProvider = FutureProvider<ExampleModel>((ref) async {
  final repository = ref.watch(exampleRepositoryProvider);
  return repository.fetchExample();
});

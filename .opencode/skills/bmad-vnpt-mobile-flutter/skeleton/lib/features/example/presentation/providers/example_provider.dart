import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../app/di/providers.dart';
import '../../domain/models/example_model.dart';

final exampleProvider = FutureProvider<ExampleModel>((ref) async {
  final repository = ref.watch(exampleRepositoryProvider);
  return repository.fetchExample();
});

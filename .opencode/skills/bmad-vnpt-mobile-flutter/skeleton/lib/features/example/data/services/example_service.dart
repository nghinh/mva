import '../../domain/models/example_model.dart';

class ExampleService {
  Future<ExampleModel> getExample() async {
    return const ExampleModel(title: 'Hello Flutter');
  }
}

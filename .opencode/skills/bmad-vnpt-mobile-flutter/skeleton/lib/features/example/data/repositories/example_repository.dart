import '../../domain/models/example_model.dart';
import '../services/example_service.dart';

abstract class ExampleRepository {
  Future<ExampleModel> fetchExample();
}

class ExampleRepositoryImpl implements ExampleRepository {
  ExampleRepositoryImpl(this._service);

  final ExampleService _service;

  @override
  Future<ExampleModel> fetchExample() {
    return _service.getExample();
  }
}

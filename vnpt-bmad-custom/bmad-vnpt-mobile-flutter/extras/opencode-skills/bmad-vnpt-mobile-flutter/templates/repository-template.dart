abstract class ExampleRepository {
  Future<ExampleModel> fetchExample();
}

class ExampleRepositoryImpl implements ExampleRepository {
  ExampleRepositoryImpl(this._service);

  final ExampleService _service;

  @override
  Future<ExampleModel> fetchExample() async {
    return _service.getExample();
  }
}

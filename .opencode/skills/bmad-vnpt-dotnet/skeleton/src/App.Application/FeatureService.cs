namespace App.Application.Features;

public sealed class FeatureService
{
    public Task<Result> ExecuteAsync(Command command, CancellationToken ct)
    {
        // Orchestrate use case here.
        return Task.FromResult(Result.Success());
    }
}

public sealed record Command(Guid Id);

public sealed record Result(bool IsSuccess, string? Error = null)
{
    public static Result Success() => new(true);
    public static Result Failure(string error) => new(false, error);
}

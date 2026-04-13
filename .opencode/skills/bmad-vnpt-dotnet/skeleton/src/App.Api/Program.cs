var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseExceptionHandler();
app.MapOpenApi();
app.MapHealthChecks("/health");

var group = app.MapGroup("/api/example");
group.MapGet("/{id:guid}", async (Guid id, CancellationToken ct) =>
{
    return Results.Ok(new { Id = id });
})
.WithName("GetExampleById");

app.Run();

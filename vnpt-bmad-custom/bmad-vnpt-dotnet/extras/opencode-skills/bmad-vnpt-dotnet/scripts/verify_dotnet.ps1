dotnet restore
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
dotnet build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
dotnet test
exit $LASTEXITCODE

param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DotNetExe = Join-Path $ProjectRoot ".dotnet\dotnet.exe"

if (-not (Test-Path -LiteralPath $DotNetExe)) {
    throw "Project-local .NET SDK not found: $DotNetExe"
}

$env:DOTNET_CLI_HOME = Join-Path $ProjectRoot ".dotnet"
$env:DOTNET_MULTILEVEL_LOOKUP = "0"

& $DotNetExe build $ProjectRoot\BigFolder.csproj --configuration $Configuration
exit $LASTEXITCODE

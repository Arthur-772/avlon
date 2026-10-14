$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DotNetExe = Join-Path $ProjectRoot ".dotnet\dotnet.exe"
$OutputDirectory = Join-Path $ProjectRoot "dist\BigFolder-portable-desktop"

if (-not (Test-Path -LiteralPath $DotNetExe)) {
    throw "Project-local .NET SDK not found: $DotNetExe"
}

if (Test-Path -LiteralPath $OutputDirectory) {
    $ResolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    $ResolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
    if (-not $ResolvedOutput.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Publish output directory must stay inside the project directory"
    }

    Remove-Item -LiteralPath $ResolvedOutput -Recurse -Force
}

$env:DOTNET_CLI_HOME = Join-Path $ProjectRoot ".dotnet"
$env:DOTNET_MULTILEVEL_LOOKUP = "0"

& $DotNetExe restore $ProjectRoot\BigFolder.csproj
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $DotNetExe build $ProjectRoot\BigFolder.csproj --configuration Release --no-restore
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $DotNetExe publish $ProjectRoot\BigFolder.csproj --configuration Release --self-contained false --output $OutputDirectory

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$PdbFile = Join-Path $OutputDirectory "BigFolder.pdb"
if (Test-Path -LiteralPath $PdbFile) {
    Remove-Item -LiteralPath $PdbFile -Force
}

$Executable = Join-Path $OutputDirectory "BigFolder.exe"
if (-not (Test-Path -LiteralPath $Executable)) {
    throw "Publish completed, but executable not found: $Executable"
}

Write-Host "Portable publish completed: $Executable"

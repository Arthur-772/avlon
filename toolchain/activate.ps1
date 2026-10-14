# Toolchain Environment Activation Script
# Usage: . E:\opt\LMworkstation\toolchain\activate.ps1

$toolchainRoot = 'E:\opt\LMworkstation\toolchain'

# Go
$env:GOROOT = "$toolchainRoot\go"
$env:GOPATH = "$toolchainRoot\gopath"
$env:GOMODCACHE = "$toolchainRoot\gopath\pkg\mod"
$env:GOCACHE = "$toolchainRoot\gopath\cache"
$env:GOPROXY = [Environment]::GetEnvironmentVariable('GOPROXY', 'User')
if (-not $env:GOPROXY) { $env:GOPROXY = 'https://goproxy.cn,direct' }

# Bun
$env:BUN_INSTALL = "$toolchainRoot\bun"

# PATH
$goBin = "$env:GOROOT\bin"
$goPathBin = "$env:GOPATH\bin"
$bunBin = "$toolchainRoot\bun\bun-windows-x64"
foreach ($p in @($goBin, $goPathBin, $bunBin)) {
    if ($p -notin ($env:Path -split ';')) {
        $env:Path = "$p;$env:Path"
    }
}

Write-Host "Toolchain activated:" -ForegroundColor Green
Write-Host "  Go:      $(& go version 2>&1)"
Write-Host "  Bun:     $(& bun --version 2>&1)"
Write-Host "  GOROOT:  $env:GOROOT"
Write-Host "  GOPATH:  $env:GOPATH"
Write-Host "  GOPROXY: $env:GOPROXY"

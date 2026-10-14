# Toolchain

本项目录用于存放 LMworkstation 下各子项目的开发工具链和前置依赖，避免污染全局环境。

## 已安装工具

| 工具 | 版本 | 路径 |
|------|------|------|
| Go   | 1.27.2 | `go\` |
| Bun  | 1.4.2  | `bun\bun-windows-x64\` |

## 环境变量

以下变量已写入用户级环境变量（永久生效）：

- `GOROOT` = `E:\opt\LMworkstation\toolchain\go`
- `GOPATH` = `E:\opt\LMworkstation\toolchain\gopath`
- `GOCACHE` = `E:\opt\LMworkstation\toolchain\gopath\cache`
- `GOMODCACHE` = `E:\opt\LMworkstation\toolchain\gopath\pkg\mod`
- `GOPROXY` = `https://goproxy.cn,direct`
- `BUN_INSTALL` = `E:\opt\LMworkstation\toolchain\bun`
- `PATH` 前置加入：`go\bin`、`gopath\bin`、`bun\bun-windows-x64`

## 快速激活

在新的 PowerShell 终端中执行：

```powershell
. E:\opt\LMworkstation\toolchain\activate.ps1
```

## 目录结构

```
toolchain/
  go/              Go SDK 1.27.2
  bun/             Bun 运行时
    bun-windows-x64/
      bun.exe
  gopath/          Go 工作空间（模块缓存、编译缓存、bin）
  activate.ps1     环境激活脚本
  README.md        本文件
```

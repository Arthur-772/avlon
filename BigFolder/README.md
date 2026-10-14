# BigFolder

BigFolder 是一个 Windows 桌面“大文件夹”工具。它把常用程序、快捷方式和文件收纳到一个 3×3 网格组件中：前 8 格可以单击直达；当收纳项超过 8 个时，第 9 格显示斜向堆叠图标和剩余数量，单击后展开完整列表。

## MVP 范围

当前版本优先交付以下能力：

- 桌面透明窗口承载单个大文件夹。
- 3×3 紧凑宫格，前 8 格单击打开对应程序或文件。
- 超过 8 个项目时，第 9 格作为溢出入口；单击可展开全部项目。
- 支持从资源管理器拖入 `.lnk`、可执行文件、普通文件或文件夹。
- 支持移除收纳项；移除只影响 BigFolder 配置，不会删除源文件。
- 记住窗口位置和收纳列表。

## 使用方式

### 本地构建

项目内自带 .NET SDK，默认不应依赖系统全局 .NET 安装。在项目根目录执行：

```powershell
.\build.ps1
```

上述命令默认构建 Debug。如需 Release 构建：

```powershell
.\build.ps1 -Configuration Release
```

构建结果位于 `bin\Debug` 或 `bin\Release`。

### 生成免安装版本

在项目根目录执行：

```powershell
.\publish.ps1
```

脚本会使用项目内 SDK `E:\opt\LMworkstation\BigFolder\.dotnet\dotnet.exe` 生成依赖本机 .NET 8 Desktop Runtime 的免安装版本，输出到：

```text
dist\BigFolder-portable-desktop\BigFolder.exe
```

该目录可以直接复制到其他 Windows x64 设备运行；目标机器需要已安装 .NET 8 Desktop Runtime。

## 配置路径

配置文件默认保存在程序目录下，便于免安装和随目录迁移：

```text
config.json
```

配置文件为 UTF-8 JSON。程序会保存收纳项列表、排序和窗口位置。删除该文件会重置 BigFolder 配置；这同样不会删除被收纳的源程序或源文件。

## 当前限制

- MVP 面向 Windows x64 桌面环境，未覆盖 x86 / ARM64。
- 暂不完整支持 UWP / Microsoft Store 应用的自动发现与图标处理。
- 大文件夹窗口会覆盖其矩形区域内的桌面图标；建议把它拖到桌面较空的位置。
- 暂不支持多个显示器分别保存独立位置，主显示器场景优先。
- 移除收纳项不等于卸载或删除源文件。

## 桌面层行为与退出

BigFolder 现在会放到 Windows 桌面底层窗口层级，不再置顶。打开普通应用窗口后，BigFolder 会被这些应用遮住；回到桌面时仍然可以显示和使用。它仍支持拖动到合适位置，位置会保存在配置文件中。

关闭程序：
1. 单击窗口左上角标题行右侧的 `×`。
2. 或右键窗口空白处，选择“退出 BigFolder”。

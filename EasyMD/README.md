# EasyMD

轻量 Markdown 桌面编辑器，面向个人日常写作和多文档处理。当前版本：v0.3.0。

技术栈是 Tauri 2 + Milkdown Crepe：前端负责所见即所得渲染，Rust 后端负责文件 IO、备份、单实例和 Windows 文件关联。

## 功能

### 编辑器

* 所见即所得 Markdown：标题、列表、表格、任务列表、引用、链接、图片、代码块和数学公式
* 源码模式（Ctrl+/），直接编辑 Markdown 源文本
* 查找替换：Ctrl+F / Ctrl+H，覆盖 WYSIWYG 和源码模式
* 大纲面板、字数统计、标题跳转
* Ctrl+滚轮或 Ctrl+=/-/0 调整界面缩放

### 文件与会话

* 多标签页：Ctrl+N 新建，Ctrl+W 关闭
* 打开/保存/另存为：Ctrl+O / Ctrl+S / Ctrl+Shift+S
* 关闭修改中的标签或窗口前确认
* 启动时无感恢复上次会话，包括未保存草稿；可在设置中关闭
* 欢迎页显示最近打开的文件，最多保留 10 项
* 自动保存可开关，间隔可在 5 到 600 秒之间调整，提示默认关闭
* 保存前自动备份到文档同级 `.easymd-bak/<文件名>.<时间戳>.bak`，同一文件保留最近 5 份
* 写入使用临时文件加原子替换；保存时校验外部修改时间，冲突时可选择覆盖或重新加载
* 兼容 UTF-8、UTF-8 BOM、UTF-16 和 GBK/GB2312 读取

### 平台与个性化

* 图片可保存到文档同级 `assets/` 并使用相对路径，也可保持 data URI
* 亮色、暗色和跟随系统主题
* 简体中文/英文界面
* 可选关联 `.md` / `.markdown`，写入 HKCU 注册表，无需管理员权限
* Windows 单实例：再次打开文件会转给已有窗口

## 环境要求

项目使用工作区本地工具链，不依赖全局安装：

```text
Bun:      E:\opt\LMworkstation\toolchain\bun\bun-windows-x64\bun.exe
Rust GNU: E:\opt\LMworkstation\toolchain\cargo\bin
MinGW:    E:\opt\LMworkstation\toolchain\w64devkit\w64devkit\bin
```

## 常用命令

```powershell
$bun = 'E:\opt\LMworkstation\toolchain\bun\bun-windows-x64\bun.exe'
& $bun install
& $bun node_modules\vitest\vitest.mjs run
& $bun node_modules\typescript\bin\tsc
& $bun node_modules\vite\bin\vite.js build

$env:RUSTUP_HOME = 'E:\opt\LMworkstation\toolchain\rustup'
$env:CARGO_HOME = 'E:\opt\LMworkstation\toolchain\cargo'
$env:PATH = "E:\opt\LMworkstation\toolchain\cargo\bin;E:\opt\LMworkstation\toolchain\w64devkit\w64devkit\bin;$env:PATH"
Set-Location 'E:\opt\LMworkstation\EasyMD\src-tauri'
cargo test --offline

Set-Location 'E:\opt\LMworkstation\EasyMD'
& $bun node_modules\@tauri-apps\cli\tauri.js build
```

注意：`tauri.conf.json` 中 `beforeDevCommand` / `beforeBuildCommand` 目前是 `exit 0`。这是为了避免 Bun 在 Tauri 子进程内丢失自身 PATH 的环境问题；完整构建前必须先手动执行 `vite build`，再执行 `tauri.js build`。

## 产物与数据位置

* 可执行文件：`src-tauri\target\release\easymd.exe`
* 安装包：`src-tauri\target\release\bundle\nsis\EasyMD_0.3.0_x64-setup.exe`
* 会话文件：`%APPDATA%\com.lmworkstation.easymd\session.json`

## 项目结构

```text
EasyMD/
├── index.html/                 # Vite 入口与界面骨架
├── src/                        # 编辑器、状态、i18n、设置、查找与会话逻辑
├── src-tauri/
│   ├── src/main.rs             # 文件 IO、备份、信任目录、单实例、关联
│   ├── capabilities/           # Tauri 权限
│   └── .cargo/config.toml      # 离线构建源锚点，勿删
├── scripts/gen_icons.py        # 图标再生成工具
└── dist/                       # Vite 构建产物
```

## 已知限制

* 首选平台是 Windows；当前未做 macOS / Linux 发布验证
* 导出 HTML/PDF/Word 计划放入后续版本
* `CSP` 已收紧为只允许应用自身脚本，但仍建议只打开可信 Markdown 文件

# CS_DEMO

基于 Three.js + TypeScript + Vite 的浏览器端 FPS demo，包含第一人称移动、跳跃、射击、AABB 碰撞和一个带障碍物的室内场景。

## 运行

双击 `run-demo.cmd`，或在命令行执行：

```powershell
.\run-demo.cmd
```

打开 `http://127.0.0.1:3000` 后点击画面进入鼠标锁定模式。

## 操作

- `W/A/S/D`：移动
- `Space`：跳跃
- `Shift`：慢走
- 鼠标：视角
- 左键：射击
- `Esc`：释放鼠标

## 本地环境

Node.js 22.14.0 已放在 `.runtime/` 目录内，依赖安装在 `node_modules/`，不依赖全局 Node。首次运行如缺少依赖，`run-demo.cmd` 会自动安装。

## 验证

```powershell
.\build-demo.cmd
```

构建产物输出到 `dist/`。自动化浏览器验证脚本位于 `tools/screenshot.mjs`，会检查 WebGL、PointerLock、移动、跳跃和射击。

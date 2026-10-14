@echo off
REM ==== TopClip 本地便携 Node 环境活脚本 ====
REM 使用方法: 在 topClip 目录下双击运行 env.cmd 或在 cmd 中执行 call env.cmd
set "TOPCLIP_ROOT=%~dp0"
set "PATH=%TOPCLIP_ROOT%tools\node-v20.18.0-win-x64;%PATH%"
echo [TopClip] Node 环境已激活:
node -v
npm -v
/**
 * main.ts - Electron 主进程入口
 * ------------------------------------------------------------------
 * 负责：
 *  - 应用生命周期
 *  - 创建主窗口
 *  - 启动剪贴板监听
 *  - 建立 IPC 通道，桥接渲染进程
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import {
  loadConfig, saveConfigNow, saveConfigDebounced, getConfig, THEME_NAMES
} from './config'
import { createMainWindow, setTopMost, getMainWindow, minimize } from './window'
import {
  startWatcher, stopWatcher, addClip, togglePin, removeClip,
  copyToSystem, onHistoryChange, emitInitial
} from './clipboard'

// ==================== Chromium 启动优化 ====================
// 禁用不需要的功能以加速启动、降低内存
app.commandLine.appendSwitch('disable-features', [
  'TranslateUI',           // 翻译提示
  'MediaRouter',           // 投屏
  'PrintPreview',          // 打印预览
  'WebRTC',                // WebRTC（剪贴板工具不需要）
  'AutofillServerCommunication', // 自动填充
  'OptimizationGuideModelDownloading', // 模型下载
  'OptimizationTargetMetadata', // 优化元数据
  'OptimizationHints',     // 优化提示
  'MediaSessionService',   // 媒体会话
].join(','))

app.commandLine.appendSwitch('disable-spell-checking')     // 拼写检查
app.commandLine.appendSwitch('disable-hang-monitor')       // 挂起监控
app.commandLine.appendSwitch('disable-ipc-flooding-protection') // IPC 限流保护（减少延迟）
app.commandLine.appendSwitch('disable-renderer-backgrounding')  // 渲染进程后台节流（减少延迟）
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128') // 限制 V8 堆内存

// GPU：保持默认，不做额外限制（避免渲染兼容性问题）

// 保证单例
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

app.whenReady().then(() => {
  // 1. 加载配置（轻量，<5ms）
  loadConfig()

  // 2. 创建窗口（关键路径，尽快显示）
  createMainWindow()

  // 3. 延迟启动剪贴板监听（窗口显示后再开始轮询）
  const win = getMainWindow()
  win?.webContents.on('did-finish-load', () => {
    // 渲染进程加载完毕后启动监听，避免拖慢首屏
    startWatcher(600)
    emitInitial()
    const cfg = getConfig()
    win.webContents.send('config:init', cfg)
  })

  // 广播历史变化到渲染进程
  onHistoryChange(history => {
    const w = getMainWindow()
    if (w && !w.isDestroyed()) {
      w.webContents.send('clip:history', history)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  saveConfigNow()
  stopWatcher()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  saveConfigNow()
})

// -------------------- IPC 接口 --------------------

// 获取初始配置
ipcMain.handle('config:get', () => getConfig())

// 更新主题
ipcMain.handle('theme:set', (_e, payload: { themeName?: string; darkMode?: boolean }) => {
  const cfg = getConfig()
  const nextName = payload.themeName && THEME_NAMES.includes(payload.themeName as any)
    ? payload.themeName
    : cfg.themeInfo.themeName
  const nextDark = typeof payload.darkMode === 'boolean' ? payload.darkMode : cfg.themeInfo.darkMode
  cfg.themeInfo = { themeName: nextName, darkMode: nextDark }
  saveConfigDebounced({ themeInfo: cfg.themeInfo })
  return cfg.themeInfo
})

// 置顶开关
ipcMain.handle('window:setTopMost', (_e, top: boolean) => {
  setTopMost(!!top)
  return getConfig().windowInfo.topMost
})

// 最小化
ipcMain.handle('window:minimize', () => { minimize() })

// 钉住切换
ipcMain.handle('clip:togglePin', (_e, id: number) => {
  togglePin(Number(id))
  return getConfig().clipHistory
})

// 点击条目 → 复制到系统剪贴板
ipcMain.handle('clip:copy', (_e, id: number) => {
  const content = copyToSystem(Number(id))
  return content
})

// 删除条目（辅助接口）
ipcMain.handle('clip:remove', (_e, id: number) => {
  removeClip(Number(id))
  return getConfig().clipHistory
})

// 请求当前历史
ipcMain.handle('clip:list', () => getConfig().clipHistory)

// 直接新增（可选：外部脚本触发）
ipcMain.handle('clip:add', (_e, text: string) => {
  addClip(String(text || ''))
  return getConfig().clipHistory
})

// 崩溃兜底：进程未捕获异常时也尝试写入
process.on('uncaughtException', (err) => {
  console.error('[TopClip] uncaughtException:', err)
  try { saveConfigNow() } catch {}
})
process.on('unhandledRejection', (reason) => {
  console.error('[TopClip] unhandledRejection:', reason)
  try { saveConfigNow() } catch {}
})
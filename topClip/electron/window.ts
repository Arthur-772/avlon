/**
 * window.ts - 主窗口创建与控制模块
 * ------------------------------------------------------------------
 * 职责：
 *  - 创建主 BrowserWindow
 *  - 加载渲染进程（开发/生产两种模式）
 *  - 应用/更新窗口置顶层级
 *  - 监听窗口 move / resize，持久化到 config.json
 */

import { BrowserWindow, screen } from 'electron'
import * as path from 'path'
import { getConfig, saveConfigDebounced, saveConfigNow } from './config'

let mainWin: BrowserWindow | null = null

/** 让坐标不越界（跨屏/单屏切换后可能超出） */
function clampBounds(x: number, y: number, w: number, h: number) {
  const displays = screen.getAllDisplays()
  // 若窗口区域完全落在任一显示器内则原样返回
  const inside = displays.some(d => {
    const b = d.workArea
    return x >= b.x && y >= b.y && x + w <= b.x + b.width && y + h <= b.y + b.height
  })
  if (inside) return { x, y, w, h }
  const primary = screen.getPrimaryDisplay().workArea
  const nw = Math.min(w, primary.width - 20)
  const nh = Math.min(h, primary.height - 20)
  return {
    x: primary.x + Math.max(0, Math.floor((primary.width - nw) / 2)),
    y: primary.y + Math.max(0, Math.floor((primary.height - nh) / 2)),
    w: nw,
    h: nh
  }
}

export function createMainWindow(): BrowserWindow {
  const cfg = getConfig()
  const { x, y, w, h } = clampBounds(
    cfg.windowInfo.x, cfg.windowInfo.y, cfg.windowInfo.width, cfg.windowInfo.height
  )

  mainWin = new BrowserWindow({
    x, y, width: w, height: h,
    minWidth: 320,
    minHeight: 380,
    frame: true,
    title: 'TopClip',
    backgroundColor: '#f0f0f0',  // 浅灰底色（避免透明合成开销，同时不依赖主题色）
    show: false,
    alwaysOnTop: !!cfg.windowInfo.topMost,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false  // 禁用后台节流，保证剪贴板监听响应
    }
  })

  // 置顶层级（screen-saver 保证在几乎所有窗口之上）
  if (cfg.windowInfo.topMost) {
    mainWin.setAlwaysOnTop(true, 'screen-saver')
  }

  // 加载页面
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWin.loadURL(devUrl)
    mainWin.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWin.once('ready-to-show', () => {
    mainWin?.show()
  })

  // 位置 / 尺寸 持久化
  const persistBounds = () => {
    if (!mainWin) return
    const b = mainWin.getBounds()
    const nowCfg = getConfig()
    nowCfg.windowInfo = {
      ...nowCfg.windowInfo,
      x: b.x, y: b.y, width: b.width, height: b.height
    }
    saveConfigDebounced({ windowInfo: nowCfg.windowInfo })
  }
  mainWin.on('move', persistBounds)
  mainWin.on('resize', persistBounds)

  // 关闭前全量落盘
  mainWin.on('close', () => {
    saveConfigNow()
  })

  mainWin.on('closed', () => { mainWin = null })

  return mainWin
}

/** 设置窗口是否置顶 */
export function setTopMost(top: boolean): void {
  if (!mainWin) return
  mainWin.setAlwaysOnTop(top, top ? 'screen-saver' : 'normal')
  const cfg = getConfig()
  cfg.windowInfo.topMost = top
  saveConfigDebounced({ windowInfo: cfg.windowInfo })
}

/** 获取当前主窗口 */
export function getMainWindow(): BrowserWindow | null {
  return mainWin
}

/** 最小化 */
export function minimize(): void { mainWin?.minimize() }
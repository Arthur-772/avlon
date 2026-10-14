/**
 * config.ts - 配置与数据持久化模块
 * ------------------------------------------------------------------
 * 职责：
 *  - 定义 config.json 严格数据结构
 *  - 提供加载、保存（原子写入）、增量更新、损坏兜底能力
 *  - 存储路径：程序同级目录 / 便携模式使用 process.cwd()，安装模式使用 exe 所在目录
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/** 单条剪贴板历史记录 */
export interface ClipItem {
  id: number
  content: string
  pin: boolean
  createTime: string
}

/** 窗口信息 */
export interface WindowInfo {
  topMost: boolean
  x: number
  y: number
  width: number
  height: number
}

/** 主题信息 */
export interface ThemeInfo {
  themeName: string
  darkMode: boolean
}

/** 完整配置结构（严格对齐 BRD） */
export interface AppConfig {
  windowInfo: WindowInfo
  themeInfo: ThemeInfo
  clipHistory: ClipItem[]
}

/** 剪贴板历史容量上限 */
export const MAX_CLIP_HISTORY = 30

/** 允许的主题名（与 UI 主题面板严格对齐） */
export const THEME_NAMES = ['静谧蓝', '活力紫', '极简灰', '暖橙', '暗夜黑'] as const

/** 默认配置 */
export function defaultConfig(): AppConfig {
  return {
    windowInfo: {
      topMost: true,
      x: 100,
      y: 100,
      width: 400,
      height: 500
    },
    themeInfo: {
      themeName: '静谧蓝',
      darkMode: false
    },
    clipHistory: []
  }
}

/**
 * 计算 config.json 存放路径
 * - 打包后 portable 模式：与 exe 同级目录（process.env.PORTABLE_EXECUTABLE_DIR 优先）
 * - 开发模式：项目根目录
 */
export function getConfigPath(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (portableDir) {
    return path.join(portableDir, 'config.json')
  }
  if (app.isPackaged) {
    // 已打包但非 portable：使用 exe 同级目录
    return path.join(path.dirname(app.getPath('exe')), 'config.json')
  }
  // 开发模式：项目根
  return path.join(process.cwd(), 'config.json')
}

/** 校验并修复配置对象，保证结构完整 */
function normalize(input: any): AppConfig {
  const base = defaultConfig()
  if (!input || typeof input !== 'object') return base

  // windowInfo
  const wi = input.windowInfo ?? {}
  base.windowInfo = {
    topMost: typeof wi.topMost === 'boolean' ? wi.topMost : base.windowInfo.topMost,
    x: Number.isFinite(wi.x) ? wi.x : base.windowInfo.x,
    y: Number.isFinite(wi.y) ? wi.y : base.windowInfo.y,
    width: Number.isFinite(wi.width) && wi.width >= 300 ? wi.width : base.windowInfo.width,
    height: Number.isFinite(wi.height) && wi.height >= 300 ? wi.height : base.windowInfo.height
  }

  // themeInfo
  const ti = input.themeInfo ?? {}
  const themeName = THEME_NAMES.includes(ti.themeName) ? ti.themeName : base.themeInfo.themeName
  base.themeInfo = {
    themeName,
    darkMode: typeof ti.darkMode === 'boolean' ? ti.darkMode : base.themeInfo.darkMode
  }

  // clipHistory
  const list = Array.isArray(input.clipHistory) ? input.clipHistory : []
  const seenIds = new Set<number>()
  const cleaned: ClipItem[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.content !== 'string' || item.content.length === 0) continue
    let id = Number(item.id)
    if (!Number.isFinite(id) || seenIds.has(id)) id = Date.now() + cleaned.length
    seenIds.add(id)
    cleaned.push({
      id,
      content: item.content,
      pin: !!item.pin,
      createTime: typeof item.createTime === 'string' ? item.createTime : new Date().toISOString()
    })
    if (cleaned.length >= MAX_CLIP_HISTORY) break
  }
  base.clipHistory = cleaned
  return base
}

let cache: AppConfig | null = null
let writeTimer: NodeJS.Timeout | null = null

/** 读取配置：文件不存在 / 损坏时返回默认值，不抛异常 */
export function loadConfig(): AppConfig {
  const p = getConfigPath()
  try {
    if (!fs.existsSync(p)) {
      cache = defaultConfig()
      return cache
    }
    const raw = fs.readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw)
    cache = normalize(parsed)
    return cache
  } catch (err) {
    console.error('[TopClip] config.json 损坏或不可读，使用默认配置。原因:', err)
    cache = defaultConfig()
    return cache
  }
}

/** 原子写入：先写临时文件再 rename，避免中途崩溃损坏 */
function atomicWrite(target: string, data: string): void {
  const tmp = target + '.tmp'
  fs.writeFileSync(tmp, data, 'utf-8')
  fs.renameSync(tmp, target)
}

/** 立即全量保存 */
export function saveConfigNow(next?: Partial<AppConfig>): void {
  const current = cache ?? loadConfig()
  const merged: AppConfig = normalize({ ...current, ...(next ?? {}) })
  cache = merged
  try {
    atomicWrite(getConfigPath(), JSON.stringify(merged, null, 2))
  } catch (err) {
    console.error('[TopClip] 保存 config.json 失败:', err)
  }
}

/** 防抖增量保存（默认 300ms 合并写入） */
export function saveConfigDebounced(next?: Partial<AppConfig>, delay = 300): void {
  if (next) {
    cache = normalize({ ...(cache ?? loadConfig()), ...next })
  }
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    saveConfigNow()
  }, delay)
}

/** 取当前缓存（未加载则加载） */
export function getConfig(): AppConfig {
  return cache ?? loadConfig()
}
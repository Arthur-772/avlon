/**
 * clipboard.ts - 剪贴板监听模块
 * ------------------------------------------------------------------
 * 职责：
 *  - 使用轮询方式（Electron 官方推荐方案）监听 Windows 剪贴板文本变化
 *  - 仅处理文本内容（BRD 规则：图片 / 文件类不处理）
 *  - 处理去重、容量上限、钉住条目保护、置顶排序
 *  - 通过回调将变更通知给主进程调度层
 */

import { clipboard } from 'electron'
import { getConfig, saveConfigDebounced, MAX_CLIP_HISTORY, ClipItem } from './config'

export type HistoryChangeListener = (history: ClipItem[]) => void

let watchTimer: NodeJS.Timeout | null = null
let lastText: string = ''
let listeners: HistoryChangeListener[] = []

/** 生成单调递增 ID */
function genId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000)
}

/** 按钉住优先 + 时间倒序整理列表 */
function sortHistory(list: ClipItem[]): ClipItem[] {
  const pinned = list.filter(i => i.pin)
  const normal = list.filter(i => !i.pin)
  // 各自保持原来顺序（新在前）
  return [...pinned, ...normal]
}

/** 广播变更 */
function emit(): void {
  const cfg = getConfig()
  for (const l of listeners) {
    try { l(cfg.clipHistory) } catch (e) { console.error(e) }
  }
}

/** 新增一条剪贴板文本（自动去重、淘汰） */
export function addClip(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text
  if (trimmed.length === 0) return false

  const cfg = getConfig()
  const list = cfg.clipHistory.slice()

  // 去重：若已存在同内容 → 移到最前（若是钉住条目，则保持钉住状态）
  const dupIndex = list.findIndex(i => i.content === trimmed)
  if (dupIndex >= 0) {
    const [dup] = list.splice(dupIndex, 1)
    dup.createTime = new Date().toISOString()
    list.unshift(dup)
  } else {
    list.unshift({
      id: genId(),
      content: trimmed,
      pin: false,
      createTime: new Date().toISOString()
    })
  }

  // 淘汰：仅删除最早的未钉住内容，钉住内容永久保留
  while (list.length > MAX_CLIP_HISTORY) {
    // 从末尾向前找第一个未钉住的删除
    let removeIdx = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].pin) { removeIdx = i; break }
    }
    if (removeIdx === -1) break // 全部钉住则不再删除
    list.splice(removeIdx, 1)
  }

  cfg.clipHistory = sortHistory(list)
  saveConfigDebounced({ clipHistory: cfg.clipHistory })
  emit()
  return true
}

/** 切换钉住状态 */
export function togglePin(id: number): void {
  const cfg = getConfig()
  const item = cfg.clipHistory.find(i => i.id === id)
  if (!item) return
  item.pin = !item.pin
  cfg.clipHistory = sortHistory(cfg.clipHistory)
  saveConfigDebounced({ clipHistory: cfg.clipHistory })
  emit()
}

/** 删除指定条目（未在 BRD 强制要求，作为可选辅助能力保留内部使用） */
export function removeClip(id: number): void {
  const cfg = getConfig()
  cfg.clipHistory = cfg.clipHistory.filter(i => i.id !== id)
  saveConfigDebounced({ clipHistory: cfg.clipHistory })
  emit()
}

/** 将指定条目内容写回系统剪贴板 */
export function copyToSystem(id: number): string | null {
  const cfg = getConfig()
  const item = cfg.clipHistory.find(i => i.id === id)
  if (!item) return null
  // 写入系统剪贴板，但要避免立即被监听器再次采集
  lastText = item.content
  clipboard.writeText(item.content)
  return item.content
}

/** 启动轮询监听 */
export function startWatcher(intervalMs = 600): void {
  if (watchTimer) return
  lastText = clipboard.readText() || ''
  watchTimer = setInterval(() => {
    try {
      const text = clipboard.readText()
      if (text && text !== lastText) {
        lastText = text
        addClip(text)
      }
    } catch (e) {
      // 剪贴板短暂锁定属正常情况，忽略
    }
  }, intervalMs)
}

/** 停止监听 */
export function stopWatcher(): void {
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null }
}

/** 订阅历史变更 */
export function onHistoryChange(cb: HistoryChangeListener): () => void {
  listeners.push(cb)
  return () => { listeners = listeners.filter(l => l !== cb) }
}

/** 初始化后广播一次（供渲染进程首次挂载获取数据） */
export function emitInitial(): void { emit() }
/**
 * preload.ts - 预加载脚本
 * ------------------------------------------------------------------
 * 通过 contextBridge 暴露安全的 IPC 桥梁给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron'

interface ClipItem { id: number; content: string; pin: boolean; createTime: string }

const api = {
  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),

  // 主题
  setTheme: (payload: { themeName?: string; darkMode?: boolean }) =>
    ipcRenderer.invoke('theme:set', payload),

  // 窗口
  setTopMost: (top: boolean) => ipcRenderer.invoke('window:setTopMost', top),
  minimize: () => ipcRenderer.invoke('window:minimize'),

  // 剪贴板
  listClips: () => ipcRenderer.invoke('clip:list') as Promise<ClipItem[]>,
  togglePin: (id: number) => ipcRenderer.invoke('clip:togglePin', id) as Promise<ClipItem[]>,
  copyClip: (id: number) => ipcRenderer.invoke('clip:copy', id) as Promise<string | null>,
  removeClip: (id: number) => ipcRenderer.invoke('clip:remove', id) as Promise<ClipItem[]>,
  addClip: (text: string) => ipcRenderer.invoke('clip:add', text) as Promise<ClipItem[]>,

  // 事件订阅
  onHistory: (cb: (list: ClipItem[]) => void) => {
    const listener = (_e: any, list: ClipItem[]) => cb(list)
    ipcRenderer.on('clip:history', listener)
    return () => ipcRenderer.removeListener('clip:history', listener)
  },
  onConfigInit: (cb: (cfg: any) => void) => {
    const listener = (_e: any, cfg: any) => cb(cfg)
    ipcRenderer.on('config:init', listener)
    return () => ipcRenderer.removeListener('config:init', listener)
  }
}

contextBridge.exposeInMainWorld('topclip', api)

// 声明类型，供渲染端使用
export type TopClipAPI = typeof api
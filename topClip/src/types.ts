/**
 * types.ts - 渲染进程共享类型
 */

export interface ClipItem {
  id: number
  content: string
  pin: boolean
  createTime: string
}

export interface WindowInfo {
  topMost: boolean
  x: number; y: number; width: number; height: number
}

export interface ThemeInfo {
  themeName: string
  darkMode: boolean
}

export interface AppConfig {
  windowInfo: WindowInfo
  themeInfo: ThemeInfo
  clipHistory: ClipItem[]
}

/** 与 preload 中 contextBridge 一致的 API 声明 */
export interface TopClipAPI {
  getConfig(): Promise<AppConfig>
  setTheme(p: { themeName?: string; darkMode?: boolean }): Promise<ThemeInfo>
  setTopMost(top: boolean): Promise<boolean>
  minimize(): Promise<void>
  listClips(): Promise<ClipItem[]>
  togglePin(id: number): Promise<ClipItem[]>
  copyClip(id: number): Promise<string | null>
  removeClip(id: number): Promise<ClipItem[]>
  addClip(text: string): Promise<ClipItem[]>
  onHistory(cb: (list: ClipItem[]) => void): () => void
  onConfigInit(cb: (cfg: AppConfig) => void): () => void
}

declare global {
  interface Window { topclip: TopClipAPI }
}
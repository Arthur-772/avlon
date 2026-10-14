<!--
  App.vue - TopClip 主界面
  ------------------------------------------------------------------
  布局：
   - 顶栏：品牌名 + 置顶开关 + 主题设置按钮 + 最小化
   - 中间：剪贴板历史卡片列表
   - 底栏：条目总数 + 模式标识
-->
<template>
  <div class="app-shell">
    <!-- 顶栏 -->
    <div class="top-bar">
      <div class="brand">TopClip</div>
      <div class="actions">
        <div class="icon-btn"
             :class="{ active: topMost }"
             :title="topMost ? '取消置顶' : '窗口置顶'"
             @click="toggleTopMost">
          <!-- 图钉图标 -->
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 3l5 5-3.5 1.5-3 3L14 16l-2 2-4-4-4 4-1-1 4-4-4-4 2-2 3.5 3.5 3-3L14 6.5z"/></svg>
        </div>
        <div class="icon-btn"
             :class="{ active: showTheme }"
             title="主题设置"
             @click="showTheme = !showTheme">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22a10 10 0 010-20c5 0 9 3 9 8 0 3-2 5-5 5h-2c-1 0-1 1-1 2 0 1-1 2-1 3 0 1 0 2 0 2z"/></svg>
        </div>
        <div class="icon-btn" title="最小化" @click="onMinimize">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 12h16v2H4z"/></svg>
        </div>
      </div>

      <!-- 主题面板 -->
      <div class="theme-panel" v-if="showTheme" @click.stop>
        <div class="title">主题</div>
        <div class="theme-list">
          <div v-for="name in themeNames"
               :key="name"
               :class="['theme-chip','chip-'+name,{selected: name === themeName}]"
               @click="pickTheme(name)">{{ name }}</div>
        </div>
        <div class="mode-toggle">
          <span>{{ darkMode ? '深色模式' : '浅色模式' }}</span>
          <div class="switch" :class="{on: darkMode}" @click="toggleDarkMode"></div>
        </div>
      </div>
    </div>

    <!-- 主区域：卡片列表 -->
    <div class="list-area" @click="showTheme = false">
      <div v-if="history.length === 0" class="empty-tip">
        暂无剪贴记录，复制点内容试试吧～
      </div>
      <div v-for="item in history"
           :key="item.id"
           :class="['clip-card',{pinned: item.pin}]"
           :title="'点击复制\n\n'+item.content"
           @click="copyItem(item)">
        <div class="content">{{ item.content }}</div>
        <div class="meta">
          <span>{{ formatTime(item.createTime) }}</span>
          <span v-if="item.pin">📌 已钉住</span>
        </div>
        <div class="pin-btn"
             :title="item.pin ? '取消钉住' : '钉住'"
             @click.stop="togglePin(item)">
          <svg class="svg-icon" viewBox="0 0 24 24">
            <path v-if="item.pin" d="M16 3l5 5-3.5 1.5-3 3L14 16l-2 2-4-4-4 4-1-1 4-4-4-4 2-2 3.5 3.5 3-3L14 6.5z"/>
            <path v-else d="M16 3l5 5-3.5 1.5-3 3L14 16l-2 2-4-4-4 4-1-1 4-4-4-4 2-2 3.5 3.5 3-3L14 6.5z" opacity=".55"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 底栏 -->
    <div class="status-bar">
      <span>共 {{ history.length }} / 30 条</span>
      <span>{{ themeName }} · {{ darkMode ? '深色' : '浅色' }} · {{ topMost ? '置顶' : '普通' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { ClipItem, AppConfig } from './types'

// 五套预设主题名称（顺序对应文档）
const themeNames = ['静谧蓝', '活力紫', '极简灰', '暖橙', '暗夜黑']

const history = ref<ClipItem[]>([])
const themeName = ref('静谧蓝')
const darkMode = ref(false)
const topMost = ref(true)
const showTheme = ref(false)

let disposeHistory: (() => void) | null = null
let disposeConfig: (() => void) | null = null

/** 应用主题到 DOM */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', themeName.value)
  document.documentElement.setAttribute('data-mode', darkMode.value ? 'dark' : 'light')
}
watch([themeName, darkMode], applyTheme, { immediate: true })

/** 初始化 */
async function initFromConfig(cfg: AppConfig) {
  history.value = cfg.clipHistory || []
  themeName.value = cfg.themeInfo?.themeName || '静谧蓝'
  darkMode.value = !!cfg.themeInfo?.darkMode
  topMost.value = !!cfg.windowInfo?.topMost
  applyTheme()
}

onMounted(async () => {
  // 优先立即获取一次配置
  try {
    const cfg = await window.topclip.getConfig()
    await initFromConfig(cfg)
  } catch (e) { console.error(e) }

  disposeHistory = window.topclip.onHistory(list => { history.value = list })
  disposeConfig = window.topclip.onConfigInit(cfg => { initFromConfig(cfg) })
})

onBeforeUnmount(() => {
  disposeHistory?.()
  disposeConfig?.()
})

// ========== 交互 ==========

async function toggleTopMost() {
  const next = !topMost.value
  const applied = await window.topclip.setTopMost(next)
  topMost.value = applied
}

function onMinimize() { window.topclip.minimize() }

async function pickTheme(name: string) {
  themeName.value = name
  await window.topclip.setTheme({ themeName: name })
}
async function toggleDarkMode() {
  darkMode.value = !darkMode.value
  await window.topclip.setTheme({ darkMode: darkMode.value })
}

async function togglePin(item: ClipItem) {
  const list = await window.topclip.togglePin(item.id)
  history.value = list
}

async function copyItem(item: ClipItem) {
  await window.topclip.copyClip(item.id)
  // 视觉反馈：轻微闪烁
  const el = document.activeElement as HTMLElement
  el?.blur?.()
}

/** 时间格式化 HH:mm:ss */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const p = (n: number) => n.toString().padStart(2, '0')
    return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  } catch { return '' }
}
</script>
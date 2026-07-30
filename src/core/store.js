// 全局状态：设置持久化到 localStorage。所有插件只读这里，写也只走这里。
const STORAGE_KEY = 'opwb:state:v1'

// 行业预设（可在设置中心追加自定义）。与行业研究模块的指标/数据源模板对应。
export const INDUSTRY_PRESETS = [
  '建筑规划', '非遗传创', '研学', '自媒体', '通用'
]

export const DATA_SOURCE_PRESETS = [
  { id: 'local', name: '本地文件', desc: '上传/读取本机文件' },
  { id: 'web', name: '联网搜索', desc: '调用联网检索' },
  { id: 'ima', name: 'IMA 知识库', desc: '个人知识库检索' },
  { id: 'tencentDocs', name: '腾讯文档', desc: '在线文档读写' }
]

const defaultState = {
  activePlugin: 'overview',
  settings: {
    apiKeys: {},                                  // { providerId: key }
    defaultProvider: 'deepseek',
    defaultModel: 'deepseek-chat',
    providerConfig: {                             // 各供应商额外配置（如本地模型地址）
      ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.1' }
    },
    customModels: [],                             // [{ id, name, model, baseUrl, apiKey, isDefault }]
    industry: ['建筑规划', '非遗传创'],
    dataSources: { local: true, web: false, ima: false, tencentDocs: false },
    corsProxy: 'https://api.allorigins.win/raw?url=', // 数据自动抓取用的 CORS 代理前缀
    theme: 'light'
  }
}

const clone = (o) => JSON.parse(JSON.stringify(o))

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return clone(defaultState)
    const p = JSON.parse(raw)
    return {
      activePlugin: p.activePlugin || defaultState.activePlugin,
      settings: {
        ...clone(defaultState.settings),
        ...(p.settings || {}),
        apiKeys: { ...(p.apiKeys || {}), ...(p.settings?.apiKeys || {}) },
        providerConfig: { ...clone(defaultState.settings.providerConfig), ...(p.settings?.providerConfig || {}) },
        dataSources: { ...clone(defaultState.settings.dataSources), ...(p.settings?.dataSources || {}) },
        industry: Array.isArray(p.settings?.industry) ? p.settings.industry : clone(defaultState.settings.industry)
      }
    }
  } catch {
    return clone(defaultState)
  }
}

let state = load()
const listeners = new Set()

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getState() { return state }
export function getSettings() { return state.settings }
export function update(fn) { fn(state); persist(); listeners.forEach((l) => l(state)) }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

// ---------- 操作日志（历史记录） ----------
const HISTORY_KEY = 'opwb:history:v1'
const HISTORY_MAX = 300
export function logHistory(action, detail) {
  try {
    const arr = getHistory()
    arr.push({ t: Date.now(), action, detail: detail || '' })
    while (arr.length > HISTORY_MAX) arr.shift()
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr))
  } catch { /* 存储不可用时静默 */ }
}
export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

// ---------- 最近使用（用于侧边栏「常用」与概览「最近」） ----------
const RECENT_KEY = 'opwb:recent:v1'
const RECENT_MAX = 12
export function logRecent(id) {
  try {
    const arr = getRecent().filter((x) => x !== id)
    arr.unshift(id)
    while (arr.length > RECENT_MAX) arr.pop()
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr))
  } catch { /* 忽略 */ }
}
export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

// ---------- 收藏（置顶常用） ----------
const FAV_KEY = 'opwb:fav:v1'
export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}
export function toggleFavorite(id) {
  const arr = getFavorites()
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
  try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)) } catch { /* 忽略 */ }
  return arr
}

// ---------- 首次启动引导标记 ----------
const ONBOARD_KEY = 'opwb:onboarded:v1'
export function isOnboarded() {
  try { return localStorage.getItem(ONBOARD_KEY) === '1' } catch { return false }
}
export function setOnboarded() {
  try { localStorage.setItem(ONBOARD_KEY, '1') } catch { /* 忽略 */ }
}

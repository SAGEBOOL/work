// 全局状态：设置持久化到 localStorage。所有插件只读这里，写也只走这里。
const STORAGE_KEY = 'opwb:state:v1'

// 行业预设（可在设置中心追加自定义）
export const INDUSTRY_PRESETS = [
  '建筑规划', '教育创意', '非遗传创', '研学运营',
  '小说创作', '写作工具', '数据分析', '通用'
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
    industry: ['建筑规划', '非遗传创'],
    dataSources: { local: true, web: false, ima: false, tencentDocs: false },
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
        apiKeys: { ...(p.settings?.apiKeys || {}) },
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

// 命令面板：⌘K / Ctrl+K 全局唤起，模糊搜索功能 + 操作 + 本机数据。
// 键盘：↑↓ 移动、Enter 打开、Esc 关闭；点击遮罩关闭。
import { el, clear, applyTheme } from '../core/ui.js'
import { allPlugins } from '../core/pluginManager.js'
import { getSettings, update } from '../core/store.js'
import { getProvider } from '../core/aiGateway.js'
import { searchData } from '../core/globalSearch.js'

let root = null
let inputEl = null
let listEl = null
let items = []
let activeIdx = 0
let onNavigate = null

function buildActions() {
  const s = getSettings()
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const acts = [
    { type: 'action', id: 'home', icon: '🏠', name: '回到概览', run: () => onNavigate('overview') },
    { type: 'action', id: 'settings', icon: '⚙️', name: '打开设置中心', run: () => onNavigate('settings') },
    {
      type: 'action', id: 'theme', icon: isDark ? '☀️' : '🌙',
      name: isDark ? '切换到浅色主题' : '切换到深色主题',
      run: () => {
        const next = isDark ? 'light' : 'dark'
        applyTheme(next); update((st) => { st.settings.theme = next })
        renderResults('')
      }
    }
  ]
  const prov = getProvider(s.defaultProvider)
  const aiReady = prov && (prov.isLocal ? true : (prov.isCustom ? !!prov.apiKey : !!s.apiKeys[prov.id]))
  if (!aiReady) {
    acts.push({ type: 'action', id: 'ai', icon: '🤖', name: '去配置默认 AI（当前未就绪）', run: () => onNavigate('settings') })
  }
  return acts
}

function pluginItems() {
  return allPlugins()
    .filter((p) => p.id !== 'overview')
    .map((p) => ({ type: 'plugin', id: p.id, icon: p.icon || '•', name: p.name, group: p.group, run: () => onNavigate(p.id) }))
}

function renderResults(q) {
  clear(listEl)
  const query = (q || '').trim()
  let groups = []

  if (!query) {
    // 无输入：显示全部操作 + 全部功能
    groups = [
      { label: '操作', list: buildActions() },
      { label: '功能', list: pluginItems() }
    ]
  } else {
    const lower = query.toLowerCase()
    const acts = buildActions().filter((a) => a.name.toLowerCase().includes(lower))
    const plugs = pluginItems().filter((p) => p.name.toLowerCase().includes(lower) || (p.group || '').toLowerCase().includes(lower))
    const data = searchData(query).map((d) => ({
      type: 'data', id: d.pluginId, icon: '🔍', name: d.title,
      sub: d.sub + (d.pluginId ? ' · ' + (allPlugins().find((p) => p.id === d.pluginId)?.name || '') : ''),
      run: () => onNavigate(d.pluginId)
    }))
    if (acts.length) groups.push({ label: '操作', list: acts })
    if (plugs.length) groups.push({ label: '功能', list: plugs })
    if (data.length) groups.push({ label: '本机数据', list: data })
  }

  items = []
  let gi = 0
  for (const g of groups) {
    if (!g.list.length) continue
    listEl.append(el('div', { class: 'cp-group-label' }, [g.label]))
    for (const it of g.list) {
      const idx = items.length
      const row = el('div', {
        class: 'cp-item',
        onmousedown: (e) => { e.preventDefault(); choose(idx) }
      }, [
        el('span', { class: 'cp-ico' }, [it.icon || '•']),
        el('span', { class: 'cp-name' }, [it.name]),
        it.sub ? el('span', { class: 'cp-sub' }, [it.sub]) : null,
        it.group ? el('span', { class: 'cp-tag' }, [it.group]) : null
      ].filter(Boolean))
      listEl.append(row)
      items.push({ ...it, row })
      gi++
    }
  }
  if (!items.length) listEl.append(el('div', { class: 'cp-empty' }, ['没有匹配结果']))
  activeIdx = 0
  highlight()
}

function highlight() {
  items.forEach((it, i) => it.row.classList.toggle('active', i === activeIdx))
  const cur = items[activeIdx]
  if (cur && cur.row.scrollIntoView) cur.row.scrollIntoView({ block: 'nearest' })
}

function choose(idx) {
  const it = items[idx]
  if (!it) return
  closePalette()
  if (it.run) it.run()
}

export function openPalette() {
  if (!root) return
  root.classList.add('show')
  inputEl.value = ''
  renderResults('')
  setTimeout(() => inputEl.focus(), 20)
}
export function closePalette() {
  if (!root) return
  root.classList.remove('show')
}
export function togglePalette() {
  if (root && root.classList.contains('show')) closePalette(); else openPalette()
}
export function isOpen() {
  return !!root && root.classList.contains('show')
}

export function initCommandPalette({ navigate }) {
  onNavigate = navigate

  inputEl = el('input', {
    class: 'cp-input',
    placeholder: '搜索功能、操作或本机数据…',
    oninput: (e) => { renderResults(e.target.value); activeIdx = 0; highlight() }
  })
  listEl = el('div', { class: 'cp-list' })
  const box = el('div', { class: 'cp-box' }, [
    el('div', { class: 'cp-head' }, [
      el('span', { class: 'cp-ico' }, ['🔎']),
      inputEl
    ]),
    listEl,
    el('div', { class: 'cp-foot' }, [
      el('span', {}, ['↑↓ 选择']),
      el('span', {}, ['↵ 打开']),
      el('span', {}, ['esc 关闭'])
    ])
  ])
  root = el('div', {
    class: 'cp-overlay',
    onclick: (e) => { if (e.target === root) closePalette() }
  }, [box])

  // 键盘导航
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); highlight() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlight() }
    else if (e.key === 'Enter') { e.preventDefault(); choose(activeIdx) }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette() }
  })

  document.body.append(root)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); togglePalette()
    }
  })
}

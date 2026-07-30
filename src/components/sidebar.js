// 侧边栏：LineSidebar 风格的指针感应导航（原生 JS 复刻）。
// 保留分组、图标、当前选中；新增左侧标记线 + 鼠标靠近时横向位移/着色效果。
import { el, clear } from '../core/ui.js'
import { pluginsByGroup } from '../core/pluginManager.js'
import { currentId } from '../core/router.js'
import { closeNav } from './nav.js'
import { getFavorites, toggleFavorite, getRecent } from '../core/store.js'

const GROUP_ORDER = ['概览', '基础办公', '专业功能', '休闲娱乐', '设置']

const FALLOFF = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p
}

// 为单个 <ul class="line-sidebar__list"> 安装指针感应动画
function setupLineList(listEl, opts = {}) {
  const {
    accentColor = 'var(--primary)',
    textColor = 'var(--text-2)',
    markerColor = 'var(--text-3)',
    proximityRadius = 100,
    maxShift = 14,
    falloff = 'smooth',
    markerLength = 28,
    markerGap = 8,
    tickScale = 0.5,
    smoothing = 80
  } = opts

  listEl.style.setProperty('--accent-color', accentColor)
  listEl.style.setProperty('--text-color', textColor)
  listEl.style.setProperty('--marker-color', markerColor)
  listEl.style.setProperty('--marker-length', `${markerLength}px`)
  listEl.style.setProperty('--marker-gap', `${markerGap}px`)
  listEl.style.setProperty('--tick-scale', String(tickScale))
  listEl.style.setProperty('--max-shift', `${maxShift}px`)
  listEl.style.setProperty('--smoothing', `${smoothing}ms`)

  const items = Array.from(listEl.querySelectorAll('.line-sidebar__item'))
  const targets = new Array(items.length).fill(0)
  const currents = new Array(items.length).fill(0)
  let raf = null
  let last = 0

  const ease = FALLOFF[falloff] || FALLOFF.linear

  const runFrame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const tau = Math.max(smoothing, 1) / 1000
    const k = 1 - Math.exp(-dt / tau)
    let moving = false
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const active = item.getAttribute('aria-current') === 'true' ? 1 : 0
      const target = Math.max(targets[i] || 0, active)
      const cur = currents[i] || 0
      const next = cur + (target - cur) * k
      const settled = Math.abs(target - next) < 0.0015
      const value = settled ? target : next
      currents[i] = value
      item.style.setProperty('--effect', value.toFixed(4))
      if (!settled) moving = true
    }
    raf = moving ? requestAnimationFrame(runFrame) : null
  }

  const startLoop = () => {
    if (raf != null) return
    last = performance.now()
    raf = requestAnimationFrame(runFrame)
  }

  const onMove = (e) => {
    const rect = listEl.getBoundingClientRect()
    const pointerY = e.clientY - rect.top
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const center = item.offsetTop + item.offsetHeight / 2
      const distance = Math.abs(pointerY - center)
      targets[i] = ease(Math.max(0, 1 - distance / proximityRadius))
    }
    startLoop()
  }

  const onLeave = () => {
    targets.fill(0)
    startLoop()
  }

  listEl.addEventListener('pointermove', onMove)
  listEl.addEventListener('pointerleave', onLeave)
  // 首次渲染时让 active 项到达目标态
  startLoop()

  return () => {
    if (raf != null) cancelAnimationFrame(raf)
    listEl.removeEventListener('pointermove', onMove)
    listEl.removeEventListener('pointerleave', onLeave)
  }
}

const cleanups = []

// 构造单个侧边栏项（含星标收藏按钮）
function makeItem(p, active, navigate, favSet) {
  const star = el('button', {
    class: 'fav-btn' + (favSet.has(p.id) ? ' on' : ''),
    title: favSet.has(p.id) ? '取消收藏' : '收藏到常用',
    onclick: (e) => {
      e.stopPropagation()
      toggleFavorite(p.id)
      renderSidebar(document.querySelector('.sidebar'), { navigate })
    }
  }, [favSet.has(p.id) ? '★' : '☆'])
  const item = el('li', {
    class: 'line-sidebar__item',
    'aria-current': active === p.id ? 'true' : undefined
  }, [
    star,
    el('span', { class: 'line-sidebar__marker', 'aria-hidden': 'true' }),
    el('span', { class: 'line-sidebar__label' }, [
      el('span', { class: 'line-sidebar__ico' }, [p.icon || '•']),
      el('span', { class: 'line-sidebar__text' }, [p.name])
    ])
  ])
  item.onclick = () => { navigate(p.id); closeNav() }
  return item
}

function addGroup(root, label, items, active, navigate, favSet, cls) {
  if (!items.length) return
  root.append(el('div', { class: 'group-label' + (cls ? ' ' + cls : '') }, [label]))
  const list = el('ul', { class: 'line-sidebar__list' })
  items.forEach((p) => list.append(makeItem(p, active, navigate, favSet)))
  root.append(el('nav', { class: 'line-sidebar line-sidebar--markers line-sidebar--scale-tick' }, [list]))
  cleanups.push(setupLineList(list))
}

export function renderSidebar(root, { navigate }) {
  // 取消旧动画循环
  cleanups.forEach((fn) => fn())
  cleanups.length = 0

  clear(root)
  root.append(
    el('div', { class: 'brand' }, [
      el('span', { class: 'logo' }, ['🏢📚']),
      el('span', { class: 'brand-text' }, ['DSArt·WORK'])
    ])
  )

  const groups = pluginsByGroup()
  const active = currentId()
  const favSet = new Set(getFavorites())

  // 顶部「常用」：收藏 + 最近（去重，排除概览/设置）
  const recent = getRecent().filter((id) => id !== 'overview' && id !== 'settings')
  const favIds = [...new Set([...getFavorites(), ...recent])].filter((id) => id !== 'overview' && id !== 'settings')
  const favPlugins = favIds
    .map((id) => allPluginsLookup().find((p) => p.id === id))
    .filter(Boolean)
  addGroup(root, '常用', favPlugins, active, navigate, favSet, 'fav-group-label')

  for (const g of GROUP_ORDER) {
    const items = groups[g]
    if (!items || !items.length) continue
    addGroup(root, g, items, active, navigate, favSet, null)
  }
}

// 缓存一次全量插件，避免重复调用
let _allCache = null
function allPluginsLookup() {
  if (!_allCache) {
    _allCache = []
    const g = pluginsByGroup()
    Object.values(g).forEach((arr) => _allCache.push(...arr))
  }
  return _allCache
}

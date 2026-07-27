// 侧边栏：LineSidebar 风格的指针感应导航（原生 JS 复刻）。
// 保留分组、图标、当前选中；新增左侧标记线 + 鼠标靠近时横向位移/着色效果。
import { el, clear } from '../core/ui.js'
import { pluginsByGroup } from '../core/pluginManager.js'
import { currentId } from '../core/router.js'
import { closeNav } from './nav.js'

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

export function renderSidebar(root, { navigate }) {
  // 取消旧动画循环
  cleanups.forEach((fn) => fn())
  cleanups.length = 0

  clear(root)
  root.append(
    el('div', { class: 'brand' }, [
      el('img', { class: 'logo', src: '/DSArt-logo.jpg', alt: 'DSArt·WORK' }),
      el('span', { class: 'brand-text' }, ['DSArt·WORK'])
    ])
  )

  const groups = pluginsByGroup()
  const active = currentId()

  for (const g of GROUP_ORDER) {
    const items = groups[g]
    if (!items || !items.length) continue
    root.append(el('div', { class: 'group-label' }, [g]))

    const list = el('ul', { class: 'line-sidebar__list' })
    for (const p of items) {
      const isActive = p.id === active
      const item = el('li', {
        class: 'line-sidebar__item',
        'aria-current': isActive ? 'true' : undefined
      }, [
        el('span', { class: 'line-sidebar__marker', 'aria-hidden': 'true' }),
        el('span', { class: 'line-sidebar__label' }, [
          el('span', { class: 'line-sidebar__ico' }, [p.icon || '•']),
          el('span', { class: 'line-sidebar__text' }, [p.name])
        ])
      ])
      item.onclick = () => { navigate(p.id); closeNav() }
      list.append(item)
    }

    const nav = el('nav', { class: 'line-sidebar line-sidebar--markers line-sidebar--scale-tick' }, [list])
    root.append(nav)
    cleanups.push(setupLineList(list))
  }
}

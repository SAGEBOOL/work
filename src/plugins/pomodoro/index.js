// 番茄钟：纯前端插件，不依赖 AI。
// 计时引擎为模块级单例——状态与计时器挂在插件模块上，路由切换卸载页面时依然存活，
// 因此可后台运行；并在 body 上挂一个持久迷你窗（右上角），切走页面时显示倒计时，点它跳回。
import { el, toast } from '../../core/ui.js'

// —— 共享引擎（模块级单例，跨路由存活）——
let mode = 'focus'      // focus | break
let total = 25 * 60
let left = total
let running = false
let timer = null
const subs = new Set()

const fmt = (s) => {
  s = Math.max(0, s)
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return m + ':' + sec
}

// 阶段结束提示音（Web Audio，无需外部资源；后台标签页也能响）
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ac = new Ctx()
    const tone = (freq, start, dur) => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.connect(g); g.connect(ac.destination)
      o.type = 'sine'; o.frequency.value = freq
      const t0 = ac.currentTime + start
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      o.start(t0); o.stop(t0 + dur + 0.02)
    }
    tone(880, 0, 0.25)
    tone(660, 0.32, 0.35)
  } catch (e) { /* 忽略：无需提示音也能用 */ }
}

const notify = () => subs.forEach(fn => { try { fn() } catch (e) {} })

function tick() {
  left -= 1
  if (left <= 0) {
    left = 0
    pause()
    beep()
    toast(mode === 'focus' ? '🍅 专注结束，休息一下！' : '☕ 休息结束，继续专注！', 'ok')
    return
  }
  notify()
}

function start() { if (running) return; running = true; timer = setInterval(tick, 1000); notify() }
function pause() { running = false; if (timer) { clearInterval(timer); timer = null } notify() }
function toggle() { running ? pause() : start() }
function reset() { if (timer) { clearInterval(timer); timer = null } left = total; running = false; notify() }
function setMode(m) {
  if (timer) { clearInterval(timer); timer = null }
  mode = m
  total = m === 'focus' ? 25 * 60 : 5 * 60
  left = total
  running = false
  notify()
}
function subscribe(fn) { subs.add(fn); fn() }
function unsubscribe(fn) { subs.delete(fn) }

const isPomoRoute = () => (location.hash.replace('#/', '') || 'overview') === 'pomodoro'
const hasSession = () => running || left < total

// —— 右上角迷你窗（持久浮层，挂在 body 上，不受路由卸载影响）——
let miniEl = null
let miniTime, miniMode, miniToggle
function ensureMini() {
  if (miniEl || !document.body) return
  miniTime = el('div', { class: 'pm-time' }, ['25:00'])
  miniMode = el('div', { class: 'pm-mode' }, ['专注'])
  miniToggle = el('button', {
    class: 'pm-btn', title: '暂停 / 继续',
    onclick: (e) => { e.stopPropagation(); toggle() }
  }, ['⏸'])
  miniEl = el('div', {
    class: 'pomo-mini hidden',
    title: '点击回到番茄钟',
    onclick: () => { location.hash = '#/pomodoro' }
  }, [
    el('div', { style: 'display:flex;flex-direction:column;line-height:1.15' }, [miniMode, miniTime]),
    miniToggle
  ])
  document.body.appendChild(miniEl)
  subscribe(renderMini)
}
function renderMini() {
  if (!miniEl) return
  const onPage = isPomoRoute()
  const show = !onPage && hasSession()
  miniEl.classList.toggle('hidden', !show)
  if (!show) return
  miniTime.textContent = fmt(left)
  miniMode.textContent = mode === 'focus' ? '专注' : '休息'
  miniToggle.textContent = running ? '⏸' : '▶'
}
window.addEventListener('hashchange', () => { if (miniEl) renderMini() })

export const pomodoroPlugin = {
  id: 'pomodoro',
  name: '番茄钟',
  icon: '🍅',
  group: '休闲娱乐',
  mount(root) {
    ensureMini()
    renderMini() // 进入页面时隐藏迷你窗（页面本身已完整显示）

    let modeEl, timeEl, startBtn
    const render = () => {
      // 页面被路由卸载后，自动退订，避免泄漏
      if (timeEl && !timeEl.isConnected) { unsubscribe(render); return }
      modeEl.textContent = mode === 'focus' ? '专注' : '休息'
      timeEl.textContent = fmt(left)
      startBtn.textContent = running ? '暂停' : '开始'
    }

    modeEl = el('div', { class: 'mode' }, [])
    timeEl = el('div', { class: 'time' }, [])
    startBtn = el('button', { class: 'btn' }, [])
    const resetBtn = el('button', { class: 'btn ghost' }, ['重置'])

    startBtn.onclick = () => toggle()
    resetBtn.onclick = () => reset()

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['番茄钟']),
      el('p', { class: 'sub' }, ['25 分钟专注 / 5 分钟休息，保持节奏。计时在后台运行——切到其他功能也会继续；右上角会出现迷你计时窗，点它随时回来。']),
      el('div', { class: 'card pomo' }, [
        modeEl, timeEl,
        el('div', { class: 'ctr' }, [
          startBtn, resetBtn,
          el('button', { class: 'btn ghost', onclick: () => setMode('focus') }, ['专注']),
          el('button', { class: 'btn ghost', onclick: () => setMode('break') }, ['休息'])
        ])
      ])
    ])
    root.append(page)
    subscribe(render)
  }
}

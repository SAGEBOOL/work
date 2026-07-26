// 番茄钟：纯前端插件，不依赖 AI。验证「非 AI 功能」也能以插件形式接入。
import { el } from '../../core/ui.js'

export const pomodoroPlugin = {
  id: 'pomodoro',
  name: '番茄钟',
  icon: '🍅',
  group: '休闲娱乐',
  mount(root) {
    let mode = 'focus' // focus | break
    let total = 25 * 60
    let left = total
    let timer = null

    const timeEl = el('div', { class: 'time' }, ['25:00'])
    const modeEl = el('div', { class: 'mode' }, ['专注'])
    const startBtn = el('button', { class: 'btn' }, ['开始'])
    const resetBtn = el('button', { class: 'btn ghost' }, ['重置'])

    const fmt = (s) => {
      const m = String(Math.floor(s / 60)).padStart(2, '0')
      const sec = String(s % 60).padStart(2, '0')
      return m + ':' + sec
    }
    const render = () => { timeEl.textContent = fmt(left) }

    const setMode = (m) => {
      mode = m
      total = m === 'focus' ? 25 * 60 : 5 * 60
      left = total
      modeEl.textContent = m === 'focus' ? '专注' : '休息'
      render()
    }

    const tick = () => {
      if (left <= 0) {
        clearInterval(timer); timer = null
        startBtn.textContent = '开始'
        return
      }
      left -= 1
      render()
    }

    startBtn.onclick = () => {
      if (timer) { clearInterval(timer); timer = null; startBtn.textContent = '开始' }
      else { timer = setInterval(tick, 1000); startBtn.textContent = '暂停' }
    }
    resetBtn.onclick = () => { if (timer) { clearInterval(timer); timer = null } setMode(mode) ; startBtn.textContent = '开始' }

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['番茄钟']),
      el('p', { class: 'sub' }, ['25 分钟专注 / 5 分钟休息，保持节奏。']),
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
    render()
  }
}

// 休闲娱乐 · 五子棋：借鉴 dsart-work.html 的像素风棋盘 + 启发式 AI。
// 封装为独立插件，分组「休闲娱乐」。纯前端，无依赖。
import { el, clear, toast } from '../../core/ui.js'

const N = 15          // 15×15 棋盘
const SIZE = 450      // canvas 像素尺寸
const M = 20          // 边距
const CELL = () => (SIZE - 2 * M) / (N - 1)

// 棋盘配色随明暗主题变化（每次绘制时读取，切换主题后重开/落子即刷新）
function colors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  if (dark) return { bg: '#10202e', line: 'rgba(120,150,220,.28)', border: 'rgba(120,150,220,.35)', s1: '#0a0e1a', s1s: 'rgba(255,255,255,.25)', s2: '#e8ecf8', s2s: 'rgba(0,0,0,.25)', last: '#ffcb45' }
  return { bg: '#efe2c8', line: 'rgba(80,60,30,.35)', border: 'rgba(80,60,30,.4)', s1: '#1f2329', s1s: 'rgba(255,255,255,.25)', s2: '#fafafa', s2s: 'rgba(0,0,0,.25)', last: '#ff9800' }
}

export const gomokuPlugin = {
  id: 'gomoku',
  name: '五子棋',
  icon: '⚫',
  group: '休闲娱乐',
  mount(root) {
    let state = null

    const cv = el('canvas', {
      id: 'gokuCanvas', width: SIZE, height: SIZE,
      style: 'display:block;margin:0 auto;max-width:100%;height:auto;border:2px solid var(--border);border-radius:8px;touch-action:none;cursor:pointer;background:var(--panel-2)'
    })
    const statusEl = el('div', { class: 'muted', style: 'font-size:14px;margin:8px 0;text-align:center' }, ['⚫ 黑方落子（你）'])
    const modeSel = el('select', {}, [
      el('option', { value: 'ai' }, ['人机对战（你执黑）']),
      el('option', { value: 'pvp' }, ['双人对战'])
    ])
    const restartBtn = el('button', { class: 'btn' }, ['🔄 重开'])
    const hintEl = el('div', { class: 'muted', style: 'font-size:12px;margin-top:8px;text-align:center' }, ['点击 / 触摸交叉点落子 · 五子连珠即胜'])

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['五子棋']),
      el('p', { class: 'sub' }, ['人机 / 双人像素风对弈，五子连珠即胜。黑先白后。']),
      el('div', { class: 'card' }, [
        el('div', { style: 'display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:6px' }, [
          el('span', { class: 'muted', style: 'font-size:13px' }, ['模式']), modeSel
        ]),
        statusEl,
        el('div', { style: 'overflow-x:auto' }, [cv]),
        el('div', { style: 'margin-top:12px;display:flex;gap:10px;justify-content:center' }, [restartBtn]),
        hintEl
      ])
    ])

    const init = () => {
      state = { board: Array.from({ length: N }, () => Array(N).fill(0)), turn: 1, over: false, last: null, mode: modeSel.value, human: 1, ai: 2 }
      draw()
      updateStatus()
      bind()
    }

    const draw = () => {
      const ctx = cv.getContext('2d')
      const c = colors()
      const cell = CELL()
      ctx.fillStyle = c.bg
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.strokeStyle = c.line
      ctx.lineWidth = 1
      for (let i = 0; i < N; i++) {
        const p = M + i * cell
        ctx.beginPath(); ctx.moveTo(p, M); ctx.lineTo(p, SIZE - M); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(M, p); ctx.lineTo(SIZE - M, p); ctx.stroke()
      }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = state.board[y][x]
        if (v) drawStone(ctx, M + x * cell, M + y * cell, cell, v === 1 ? c.s1 : c.s2, v === 1 ? c.s1s : c.s2s)
      }
      if (state.last) {
        const [lx, ly] = state.last
        ctx.strokeStyle = c.last; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(M + lx * cell, M + ly * cell, cell * 0.42, 0, Math.PI * 2); ctx.stroke()
      }
    }

    const drawStone = (ctx, cx, cy, cell, fill, stroke) => {
      ctx.fillStyle = fill
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke()
    }

    const gomokuPlace = (clientX, clientY) => {
      if (!state || state.over) return
      if (state.mode === 'ai' && state.turn !== state.human) return
      const r = cv.getBoundingClientRect()
      const cell = CELL()
      const scaleX = cv.width / r.width
      const px = (clientX - r.left) * scaleX, py = (clientY - r.top) * scaleX
      const gx = Math.round((px - M) / cell), gy = Math.round((py - M) / cell)
      placeStone(gx, gy)
    }

    const placeStone = (x, y) => {
      if (!state || state.over) return false
      const player = state.turn
      if (x < 0 || y < 0 || x >= N || y >= N || state.board[y][x] !== 0) return false
      state.board[y][x] = player
      state.last = [x, y]
      if (checkWin(x, y, player)) {
        state.over = true
        const isAI = (state.mode === 'ai' && player === state.ai)
        const winner = player === 1 ? '⚫ 黑方' : '⚪ 白方'
        updateStatus(winner + (isAI ? '（电脑）' : '') + ' 胜利！')
        toast('🎉 ' + winner + '胜利！', 'ok')
        draw()
        return true
      }
      state.turn = player === 1 ? 2 : 1
      updateStatus()
      draw()
      if (state.mode === 'ai' && !state.over && state.turn === state.ai) setTimeout(aiMove, 350)
      return true
    }

    const aiMove = () => {
      if (!state || state.over || state.turn !== state.ai) return
      const me = state.ai, opp = state.human
      let best = null, bestScore = -1
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (state.board[y][x] !== 0) continue
        const score = cellScore(x, y, me) + cellScore(x, y, opp) * 0.95
        if (score > bestScore) { bestScore = score; best = { x, y } }
      }
      if (!best) best = { x: 7, y: 7 }
      placeStone(best.x, best.y)
    }

    const cellScore = (x, y, player) => {
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
      let total = 0
      for (const [dx, dy] of dirs) {
        let cnt = 1, open = 0
        let nx = x + dx, ny = y + dy
        while (nx >= 0 && ny >= 0 && nx < N && ny < N && state.board[ny][nx] === player) { cnt++; nx += dx; ny += dy }
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && state.board[ny][nx] === 0) open++
        nx = x - dx; ny = y - dy
        while (nx >= 0 && ny >= 0 && nx < N && ny < N && state.board[ny][nx] === player) { cnt++; nx -= dx; ny -= dy }
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && state.board[ny][nx] === 0) open++
        total += lineScore(cnt, open)
      }
      return total
    }

    const lineScore = (cnt, open) => {
      if (cnt >= 5) return 1e9
      if (cnt === 4) return open === 2 ? 1e7 : open === 1 ? 1e5 : 0
      if (cnt === 3) return open === 2 ? 5000 : open === 1 ? 500 : 0
      if (cnt === 2) return open === 2 ? 200 : open === 1 ? 50 : 0
      if (cnt === 1) return open >= 1 ? 10 : 0
      return 0
    }

    const checkWin = (x, y, p) => {
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
      for (const [dx, dy] of dirs) {
        let cnt = 1
        for (let s = 1; s < 5; s++) { const nx = x + dx * s, ny = y + dy * s; if (nx < 0 || ny < 0 || nx >= N || ny >= N || state.board[ny][nx] !== p) break; cnt++ }
        for (let s = 1; s < 5; s++) { const nx = x - dx * s, ny = y - dy * s; if (nx < 0 || ny < 0 || nx >= N || ny >= N || state.board[ny][nx] !== p) break; cnt++ }
        if (cnt >= 5) return true
      }
      return false
    }

    const updateStatus = (text) => {
      if (text) { statusEl.textContent = text; return }
      if (state.mode === 'ai' && state.turn === state.ai) { statusEl.textContent = '🤖 电脑思考中…'; return }
      statusEl.textContent = (state.turn === 1 ? '⚫ 黑方落子（你）' : '⚪ 白方落子' + (state.mode === 'ai' ? '（电脑）' : ''))
    }

    const bind = () => {
      cv.style.touchAction = 'none'
      cv.onpointerdown = (e) => { e.preventDefault(); gomokuPlace(e.clientX, e.clientY) }
    }

    modeSel.onchange = init
    restartBtn.onclick = init

    root.append(page)
    init()
  }
}

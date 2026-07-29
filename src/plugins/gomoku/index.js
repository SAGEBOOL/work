// 休闲娱乐 · 五子棋：像素风棋盘 + 启发式 AI + 本地双人 + 联网对战（MQTT 中继，发链接即连）。
// 纯前端，无后端。联网模式用免费公共 MQTT broker（EMQX，国内可达）做信令 + 棋步转发：
// 创建房间生成 ?room=xxxx 链接发给好友，对方点开自动进同一房间、直接开战，无需任何手动复制或应答码。
import { el, toast } from '../../core/ui.js'
import mqtt from 'mqtt'

const N = 15          // 15×15 棋盘
const SIZE = 450      // canvas 像素尺寸
const M = 20          // 边距
const CELL = () => (SIZE - 2 * M) / (N - 1)

// 免费公共 MQTT broker（WebSocket Secure）。优先 EMQX（国产、国内可达），失败回退 HiveMQ。
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
]
const TOPIC = (room) => 'gomoku/room/' + room
const randRoom = () => Math.random().toString(36).slice(2, 10) // 8 位随机房号

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
    let mqttClient = null, connected = false, myColor = 0, isHost = false, roomId = null

    const cv = el('canvas', {
      id: 'gokuCanvas', width: SIZE, height: SIZE,
      style: 'display:block;margin:0 auto;max-width:100%;height:auto;border:2px solid var(--border);border-radius:8px;touch-action:none;cursor:pointer;background:var(--panel-2)'
    })
    const statusEl = el('div', { class: 'muted', style: 'font-size:14px;margin:8px 0;text-align:center' }, ['⚫ 黑方落子（你）'])
    const modeSel = el('select', {}, [
      el('option', { value: 'ai' }, ['人机对战（你执黑）']),
      el('option', { value: 'pvp' }, ['双人对战（同屏）']),
      el('option', { value: 'online' }, ['联网对战（邀请好友）'])
    ])
    const restartBtn = el('button', { class: 'btn' }, ['🔄 重开'])
    const hintEl = el('div', { class: 'muted', style: 'font-size:12px;margin-top:8px;text-align:center' }, ['点击 / 触摸交叉点落子 · 五子连珠即胜'])

    // —— 联网对战 UI ——
    const onlineStatusEl = el('span', { class: 'muted' }, [''])
    const inviteUrl = el('input', { type: 'text', readonly: true, placeholder: '点「创建房间」自动生成邀请链接', style: 'flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
    const copyBtn = el('button', { class: 'btn' }, ['📋 复制链接'])
    const createBtn = el('button', { class: 'btn primary' }, ['➕ 创建房间'])
    const onlinePanel = el('div', { class: 'card', style: 'margin-top:16px;display:none' }, [
      el('p', { class: 'sub' }, ['联网对战：点「创建房间」生成一条邀请链接，发给好友；对方点开链接自动进入同一房间、直接开战，无需任何手动复制或应答码。棋步经免费公共 MQTT 中继转发（EMQX，国内可达），站点本身仍纯静态、无后端。']),
      el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;align-items:center' }, [createBtn, onlineStatusEl]),
      el('div', { style: 'margin-top:8px;display:flex;gap:8px;align-items:center' }, [inviteUrl, copyBtn])
    ])

    const onlineStatus = (msg) => { onlineStatusEl.textContent = msg }

    // —— 初始化棋局 ——
    const init = () => {
      state = { board: Array.from({ length: N }, () => Array(N).fill(0)), turn: 1, over: false, last: null, mode: modeSel.value, human: 1, ai: 2 }
      draw()
      updateStatus()
      bind()
      updateOnlineUI()
    }

    const draw = () => {
      const ctx = cv.getContext('2d')
      if (!ctx) return
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
      if (state.mode === 'online') {
        if (!connected) { toast('请先创建房间并等待连接', 'err'); return }
        if (state.turn !== myColor) { toast('等待对方落子…', 'err'); return }
      }
      const r = cv.getBoundingClientRect()
      const cell = CELL()
      const scaleX = (r.width ? cv.width / r.width : 1)
      const px = (clientX - r.left) * scaleX, py = (clientY - r.top) * scaleX
      const gx = Math.round((px - M) / cell), gy = Math.round((py - M) / cell)
      placeStone(gx, gy, false)
    }

    const placeStone = (x, y, fromRemote, player) => {
      if (!state || state.over) return false
      const p = (player != null) ? player : state.turn
      if (x < 0 || y < 0 || x >= N || y >= N || state.board[y][x] !== 0) return false
      state.board[y][x] = p
      state.last = [x, y]
      const win = checkWin(x, y, p)
      if (win) {
        state.over = true
        const isAI = (state.mode === 'ai' && p === state.ai)
        const winner = p === 1 ? '⚫ 黑方' : '⚪ 白方'
        updateStatus(winner + (isAI ? '（电脑）' : '') + ' 胜利！')
        toast('🎉 ' + winner + '胜利！', 'ok')
      } else {
        state.turn = p === 1 ? 2 : 1
        updateStatus()
      }
      draw()
      if (state.mode === 'online' && !fromRemote && connected) sendMove(x, y, p)
      if (state.mode === 'ai' && !state.over && state.turn === state.ai) setTimeout(aiMove, 350)
      return true
    }

    const applyRemote = (x, y, color) => placeStone(x, y, true, color)

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
      placeStone(best.x, best.y, false)
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
      if (state.mode === 'online') {
        if (!connected) { statusEl.textContent = '🔗 连接中…'; return }
        if (state.over) return
        if (myColor && state.turn !== myColor) { statusEl.textContent = '⏳ 等待对方落子…'; return }
        statusEl.textContent = '👉 轮到你落子（' + (myColor === 1 ? '⚫黑' : '⚪白') + '）'
        return
      }
      if (state.mode === 'ai' && state.turn === state.ai) { statusEl.textContent = '🤖 电脑思考中…'; return }
      statusEl.textContent = (state.turn === 1 ? '⚫ 黑方落子（你）' : '⚪ 白方落子' + (state.mode === 'ai' ? '（电脑）' : ''))
    }

    const bind = () => {
      cv.style.touchAction = 'none'
      cv.onpointerdown = (e) => { e.preventDefault(); gomokuPlace(e.clientX, e.clientY) }
    }

    // —— 联网：MQTT 中继（免费公共 broker，国内可达）——
    const sendMove = (x, y, color) => {
      if (mqttClient && mqttClient.connected) mqttClient.publish(TOPIC(roomId), JSON.stringify({ t: 'move', x, y, color }))
    }
    const handleMsg = (m) => {
      if (!m || !state || state.mode !== 'online') return
      if (m.t === 'join') {
        if (isHost) mqttClient.publish(TOPIC(roomId), JSON.stringify({ t: 'state', board: state.board, turn: state.turn }))
      } else if (m.t === 'state') {
        if (!isHost) {
          state.board = m.board.map(r => r.slice())
          state.turn = m.turn
          state.over = false
          draw(); updateStatus()
        }
      } else if (m.t === 'move') {
        if (m.color && m.color !== myColor && m.color === state.turn) applyRemote(m.x, m.y, m.color)
      } else if (m.t === 'restart') {
        init()
      }
    }

    const connectRoom = (room, host) => {
      roomId = room; isHost = host; myColor = host ? 1 : 2
      // 测试 / 无 WebSocket 环境直接跳过，避免发起真实连接
      if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') { onlineStatus('（测试环境，跳过连接）'); return }
      let fallbackDone = false
      const tryConnect = (i) => {
        if (i >= BROKERS.length) { onlineStatus('❌ 无法连接中继服务（请检查网络）'); return }
        try {
          mqttClient = mqtt.connect(BROKERS[i], {
            clientId: 'goku_' + Math.random().toString(16).slice(2, 10),
            clean: true, connectTimeout: 15000, reconnectPeriod: 3000
          })
        } catch (e) { onlineStatus('❌ 连接失败：' + e.message); return }
        mqttClient.on('connect', () => {
          mqttClient.subscribe(TOPIC(roomId), { qos: 0 })
          connected = true
          onlineStatus(host ? '✅ 房间已就绪（你执黑，先手），等待好友加入…' : '✅ 已加入房间（你执白，后手），等待对手落子…')
          updateStatus()
          if (!host) mqttClient.publish(TOPIC(roomId), JSON.stringify({ t: 'join' }))
        })
        mqttClient.on('message', (topic, payload) => { try { handleMsg(JSON.parse(payload.toString())) } catch (e) {} })
        mqttClient.on('close', () => { if (connected) { connected = false; onlineStatus('⚠️ 与中继断开，正在重连…'); updateStatus() } })
        mqttClient.on('error', (err) => {
          if (connected) return
          if (!fallbackDone) { fallbackDone = true; try { mqttClient.end(true) } catch (e) {}; tryConnect(i + 1) }
          else onlineStatus('⚠️ 连接异常：' + (err && err.message ? err.message : String(err)))
        })
      }
      tryConnect(0)
    }

    const closeConn = () => {
      if (mqttClient) { try { mqttClient.publish(TOPIC(roomId), JSON.stringify({ t: 'leave' })) } catch (e) {}; try { mqttClient.end(true) } catch (e) {} }
      mqttClient = null; connected = false; myColor = 0; isHost = false; roomId = null
      inviteUrl.value = ''
    }

    const updateOnlineUI = () => {
      const on = state && state.mode === 'online'
      onlinePanel.style.display = on ? '' : 'none'
      if (!on) return
      if (isGuest) { createBtn.style.display = 'none'; inviteUrl.style.display = 'none'; copyBtn.style.display = 'none' }
      else { createBtn.style.display = ''; inviteUrl.style.display = ''; copyBtn.style.display = '' }
    }

    // —— 事件 ——
    const onModeChange = () => { closeConn(); init() }
    modeSel.onchange = onModeChange
    restartBtn.onclick = () => { if (state && state.mode === 'online' && connected) mqttClient.publish(TOPIC(roomId), JSON.stringify({ t: 'restart' })); init() }
    createBtn.onclick = () => {
      const room = randRoom()
      const url = location.origin + location.pathname + '?room=' + room + '#/gomoku'
      inviteUrl.value = url
      try { navigator.clipboard.writeText(url); toast('邀请链接已复制，发给好友即可') } catch (e) { toast('链接已生成，请手动复制') }
      connectRoom(room, true)
    }
    copyBtn.onclick = () => { try { navigator.clipboard.writeText(inviteUrl.value); toast('已复制邀请链接') } catch (e) { toast('复制失败，请手动复制', 'err') } }

    // —— 挂载 ——
    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['五子棋']),
      el('p', { class: 'sub' }, ['人机 / 同屏双人 / 联网对战（发链接即连）。五子连珠即胜，黑先白后。']),
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
    root.append(page, onlinePanel)

    const pendingRoom = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search).get('room') : null
    const isGuest = !!pendingRoom
    init()
    if (pendingRoom) {
      modeSel.value = 'online'
      state.mode = 'online'
      updateOnlineUI()
      connectRoom(pendingRoom, false)
    }
  }
}

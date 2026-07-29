// 休闲娱乐 · 五子棋：像素风棋盘 + 启发式 AI + 本地双人 + 联网对战（WebRTC 点对点直连）。
// 纯前端，无后端。联网模式用浏览器原生 RTCPeerConnection + 手动 offer/answer 信令（邀请链接 + 应答码），
// 棋步通过 RTCDataChannel 点对点直传，不经任何服务器，故在国内（北京）也可稳定使用（仅需 Google STUN 做 NAT 穿透）。
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

const b64enc = (s) => btoa(unescape(encodeURIComponent(s)))
const b64dec = (b) => decodeURIComponent(escape(atob(b)))

export const gomokuPlugin = {
  id: 'gomoku',
  name: '五子棋',
  icon: '⚫',
  group: '休闲娱乐',
  mount(root) {
    let state = null
    let pcRef = null, dc = null, connected = false, myColor = 0, isHost = false

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

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['五子棋']),
      el('p', { class: 'sub' }, ['人机 / 同屏双人 / 联网对战（邀请好友点对点直连）。五子连珠即胜，黑先白后。']),
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

    // —— 联网对战 UI ——
    const onlineStatusEl = el('span', { class: 'muted' }, [''])
    const inviteUrl = el('input', { type: 'text', readonly: true, placeholder: '创建房间后这里生成邀请链接', style: 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
    const answerInput = el('input', { type: 'text', placeholder: '粘贴好友发来的「应答码」', style: 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);margin-top:6px' })
    const answerCode = el('input', { type: 'text', readonly: true, placeholder: '生成中…', style: 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);margin-top:6px' })
    const createBtn = el('button', { class: 'btn primary' }, ['➕ 创建房间'])
    const connectBtn = el('button', { class: 'btn primary' }, ['✅ 完成连接'])
    const copyInviteBtn = el('button', { class: 'btn' }, ['复制邀请链接'])
    const copyAnswerBtn = el('button', { class: 'btn' }, ['复制应答码'])
    const hostBox = el('div', {}, [
      el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;align-items:center' }, [createBtn, onlineStatusEl]),
      el('div', { style: 'margin-top:8px' }, [inviteUrl, copyInviteBtn]),
      el('div', { style: 'margin-top:6px' }, [el('label', { class: 'muted' }, ['好友发来的「应答码」：']), answerInput, connectBtn])
    ])
    const guestBox = el('div', {}, [
      el('p', { class: 'muted', style: 'margin:0 0 4px' }, ['已读取邀请链接。把下面这段「应答码」发给好友，等对方点击「完成连接」后即可开始（你执白，后手）：']),
      answerCode, copyAnswerBtn
    ])
    const onlinePanel = el('div', { class: 'card', style: 'margin-top:16px;display:none' }, [
      el('p', { class: 'sub' }, ['联网对战：棋步通过 WebRTC 点对点直连，不经任何服务器。流程：创建房间 → 复制邀请链接发给好友 → 好友打开并回传「应答码」→ 连接成功即开始。黑方先手。']),
      hostBox, guestBox
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
        if (!connected) { toast('请先连接好友', 'err'); return }
        if (state.turn !== myColor) { toast('等待对方落子…', 'err'); return }
      }
      const r = cv.getBoundingClientRect()
      const cell = CELL()
      const scaleX = (r.width ? cv.width / r.width : 1)
      const px = (clientX - r.left) * scaleX, py = (clientY - r.top) * scaleX
      const gx = Math.round((px - M) / cell), gy = Math.round((py - M) / cell)
      placeStone(gx, gy, false)
    }

    const placeStone = (x, y, fromRemote) => {
      if (!state || state.over) return false
      const player = state.turn
      if (x < 0 || y < 0 || x >= N || y >= N || state.board[y][x] !== 0) return false
      state.board[y][x] = player
      state.last = [x, y]
      const win = checkWin(x, y, player)
      if (win) {
        state.over = true
        const isAI = (state.mode === 'ai' && player === state.ai)
        const winner = player === 1 ? '⚫ 黑方' : '⚪ 白方'
        updateStatus(winner + (isAI ? '（电脑）' : '') + ' 胜利！')
        toast('🎉 ' + winner + '胜利！', 'ok')
      } else {
        state.turn = player === 1 ? 2 : 1
        updateStatus()
      }
      draw()
      if (state.mode === 'online' && !fromRemote && connected) {
        try { sendMsg({ t: 'move', x, y }) } catch (e) {}
      }
      if (state.mode === 'ai' && !state.over && state.turn === state.ai) setTimeout(aiMove, 350)
      return true
    }

    const applyRemote = (x, y) => placeStone(x, y, true)

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
        if (!connected) { statusEl.textContent = '🔗 等待连接好友…'; return }
        if (state.over) return
        statusEl.textContent = (state.turn === myColor ? '👉 轮到你落子（' + (myColor === 1 ? '⚫黑' : '⚪白') + '）' : '⏳ 等待对方落子…')
        return
      }
      if (state.mode === 'ai' && state.turn === state.ai) { statusEl.textContent = '🤖 电脑思考中…'; return }
      statusEl.textContent = (state.turn === 1 ? '⚫ 黑方落子（你）' : '⚪ 白方落子' + (state.mode === 'ai' ? '（电脑）' : ''))
    }

    const bind = () => {
      cv.style.touchAction = 'none'
      cv.onpointerdown = (e) => { e.preventDefault(); gomokuPlace(e.clientX, e.clientY) }
    }

    // —— 联网：WebRTC 点对点 ——
    const sendMsg = (obj) => { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)) }
    const handleMsg = (m) => {
      if (!m) return
      if (m.t === 'move') applyRemote(m.x, m.y)
      else if (m.t === 'restart') { if (state && state.mode === 'online') init() }
    }
    const wireChannel = (ch) => {
      ch.onopen = () => {
        connected = true
        myColor = isHost ? 1 : 2
        onlineStatus(isHost ? '✅ 已连接（你执黑，先手）' : '✅ 已连接（你执白，后手）')
        updateStatus(); draw()
      }
      ch.onmessage = (e) => { try { handleMsg(JSON.parse(e.data)) } catch (err) {} }
      ch.onclose = () => { connected = false; onlineStatus('⚠️ 对方已断开，可点「重开」'); updateStatus() }
    }
    const newPC = () => new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })

    const setupHost = () => {
      try {
        isHost = true
        const pc = newPC()
        pcRef = pc
        dc = pc.createDataChannel('gomoku')
        wireChannel(dc)
        pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') onlineStatus('❌ 连接失败（NAT 穿透受阻，请改用同屏双人）') }
        pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => {
          const sdp = b64enc(JSON.stringify(pc.localDescription))
          const url = location.origin + location.pathname + '?offer=' + encodeURIComponent(sdp) + '#/gomoku'
          inviteUrl.value = url
          onlineStatus('🔗 已生成邀请链接，发给好友…')
        }).catch(err => onlineStatus('❌ 创建房间失败：' + err.message))
      } catch (e) { onlineStatus('❌ 浏览器不支持 WebRTC：' + e.message) }
    }

    const setupGuest = (offerB64) => {
      try {
        isHost = false
        const pc = newPC()
        pcRef = pc
        pc.ondatachannel = (e) => { dc = e.channel; wireChannel(dc) }
        pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') onlineStatus('❌ 连接失败（NAT 穿透受阻）') }
        const offer = JSON.parse(b64dec(offerB64))
        pc.setRemoteDescription(offer).then(() => pc.createAnswer()).then(a => pc.setLocalDescription(a)).then(() => {
          answerCode.value = b64enc(JSON.stringify(pc.localDescription))
          onlineStatus('📤 已生成应答码，请发给好友…')
        }).catch(err => onlineStatus('❌ 加入失败：' + err.message))
      } catch (e) { onlineStatus('❌ 解析邀请链接失败：' + e.message) }
    }

    const connectHost = (answerB64) => {
      if (!pcRef) { onlineStatus('请先「创建房间」'); return }
      try {
        const ans = JSON.parse(b64dec(answerB64))
        pcRef.setRemoteDescription(ans).then(() => onlineStatus('✅ 已连接，黑方先手！')).catch(err => onlineStatus('❌ 连接失败：' + err.message))
      } catch (e) { onlineStatus('❌ 应答码无效') }
    }

    const closeConn = () => {
      try { if (dc) dc.close() } catch (e) {}
      try { if (pcRef) pcRef.close() } catch (e) {}
      dc = null; pcRef = null; connected = false; myColor = 0; isHost = false
      inviteUrl.value = ''; answerInput.value = ''; answerCode.value = ''
    }

    const updateOnlineUI = () => {
      const on = state && state.mode === 'online'
      onlinePanel.style.display = on ? '' : 'none'
      if (!on) return
      if (isGuest) { hostBox.style.display = 'none'; guestBox.style.display = '' }
      else { hostBox.style.display = ''; guestBox.style.display = 'none' }
    }

    // —— 事件 ——
    const onModeChange = () => { closeConn(); init() }
    modeSel.onchange = onModeChange
    restartBtn.onclick = () => { if (state && state.mode === 'online' && connected) sendMsg({ t: 'restart' }); init() }
    createBtn.onclick = setupHost
    connectBtn.onclick = () => connectHost(answerInput.value.trim())
    copyInviteBtn.onclick = () => { try { navigator.clipboard.writeText(inviteUrl.value); toast('已复制邀请链接') } catch (e) { toast('复制失败，请手动复制', 'err') } }
    copyAnswerBtn.onclick = () => { try { navigator.clipboard.writeText(answerCode.value); toast('已复制应答码') } catch (e) { toast('复制失败，请手动复制', 'err') } }

    // —— 挂载 ——
    root.append(page, onlinePanel)
    const pendingOffer = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search).get('offer') : null
    const isGuest = !!pendingOffer
    init()
    if (pendingOffer) {
      modeSel.value = 'online'
      onModeChange()
      setupGuest(pendingOffer)
    }
  }
}

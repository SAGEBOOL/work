// 视频娱乐：①外部视频站点入口（原功能）②文字转音频（浏览器原生 TTS + 内嵌 md-to-mp3 离线技能包）
import { el, clear, toast } from '../../core/ui.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'
// base 为 './'，静态资源放 public/ 即可，按文档基址相对解析（容错兜底，便于无 Vite 环境求值）
const SKILL_ZIP = ((import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : './') + 'skills/md-to-mp3-skill.zip'

// —— 本地持久化（与全站 opwb:* 约定一致）——
const LS = (k, d) => { try { const v = localStorage.getItem('opwb:tts:' + k); return v == null ? d : v } catch (e) { return d } }
const LSset = (k, v) => { try { localStorage.setItem('opwb:tts:' + k, v) } catch (e) {} }

// 清理 Markdown 标记，提取纯净正文（复刻 md-to-mp3 的清理规则，适配浏览器 TTS）
function cleanMarkdown(text) {
  let t = text || ''
  t = t.replace(/^---[\s\S]*?---\s*/, '')          // YAML frontmatter
  t = t.replace(/```[\s\S]*?```/g, ' ')            // 代码块
  t = t.replace(/`([^`]+)`/g, '$1')                // 行内代码
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')   // 图片 -> alt
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')    // 链接 -> text
  t = t.replace(/^#{1,6}\s+/gm, '')                // 标题
  t = t.replace(/^\s*>\s?/gm, '')                  // 引用
  t = t.replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')    // 列表
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2')         // 加粗
  t = t.replace(/(\*|_)(.*?)\1/g, '$2')            // 斜体
  t = t.replace(/==([^=]+)==/g, '$1')              // 高亮
  t = t.replace(/~~([^~]+)~~/g, '$1')              // 删除线
  t = t.replace(/\[\^[^\]]*\]/g, '')               // 脚注引用
  t = t.replace(/^\s*\[\^[^\]]+\]:.*$/gm, '')      // 脚注定义
  t = t.replace(/^\s*\|[-:\s|]+\|\s*$/gm, '')      // 表格分隔行
  t = t.replace(/\s*\|\s*/g, ' ')                  // 表格列分隔
  t = t.replace(/^[-*_]{3,}\s*$/gm, '')            // 水平线
  t = t.replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

// —— 标签①：视频娱乐站 ——
function renderTv(panel) {
  const go = () => window.open(TV_URL, '_blank', 'noopener')
  const card = el('div', { class: 'card', style: 'text-align:center;padding:36px 20px' }, [
    el('div', { style: 'font-size:52px;margin-bottom:10px' }, ['📺']),
    el('div', { style: 'font-size:18px;font-weight:700;margin-bottom:4px' }, ['DSArt 视频娱乐站']),
    el('div', { class: 'muted' }, [TV_URL]),
    el('button', { class: 'btn primary', style: 'margin-top:18px;font-size:16px;padding:12px 30px', onclick: go }, ['前往视频娱乐站 →'])
  ])
  panel.append(
    el('p', { class: 'sub' }, ['外部视频站点，点击下方按钮在新标签页打开（不离开本工作台）。']),
    card,
    el('p', { class: 'hint' }, ['该站点为外部服务，账号、内容与可用性由其运营方负责；工作台仅提供跳转入口。'])
  )
}

// —— 标签②：文字转音频 ——
function renderTextToAudio(panel) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  let voices = []
  const state = { playing: false, paused: false, idx: 0, total: 0, spoken: 0, chunks: [], rate: 0.9, pitch: 1 }

  // 控件
  const fileInput = el('input', { type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain', style: 'display:none' })
  const loadBtn = el('button', { class: 'btn' }, ['📂 载入 .md/.txt'])
  const textArea = el('textarea', {
    placeholder: '在此粘贴或输入要朗读的文本；或点击「载入 .md/.txt」导入并自动去除 Markdown 标记。',
    style: 'width:100%;min-height:220px;resize:vertical;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;box-sizing:border-box'
  })
  const charCount = el('span', { class: 'muted' }, ['0 字'])
  const voiceSel = el('select', {})
  const rate = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: LS('rate', '0.9') })
  const rateVal = el('span', { class: 'muted' }, [(+rate.value).toFixed(2) + '×'])
  const pitch = el('input', { type: 'range', min: '0', max: '2', step: '0.05', value: LS('pitch', '1') })
  const pitchVal = el('span', { class: 'muted' }, [(+pitch.value).toFixed(2)])
  const playBtn = el('button', { class: 'btn primary' }, ['▶ 朗读'])
  const pauseBtn = el('button', { class: 'btn' }, ['⏸ 暂停'])
  const stopBtn = el('button', { class: 'btn ghost' }, ['⏹ 停止'])
  const track = el('div', { style: 'height:8px;background:var(--panel-2);border-radius:6px;overflow:hidden;margin-top:4px' })
  const fill = el('div', { style: 'height:100%;width:0%;background:var(--primary);transition:width .15s' })
  track.append(fill)
  const progText = el('span', { class: 'muted' }, ['0 / 0 字'])
  const status = el('div', { class: 'alert', style: 'margin-top:10px' }, ['就绪'])

  const setStatus = (msg, type) => { status.className = 'alert' + (type ? ' ' + type : ''); status.textContent = msg }
  const updateProgress = (done, total) => {
    fill.style.width = (total ? Math.min(100, done / total * 100) : 0) + '%'
    progText.textContent = `${done} / ${total} 字`
  }
  const loadVoices = () => { voices = (window.speechSynthesis && speechSynthesis.getVoices()) || []; return voices }
  const pickDefault = (list) => list.find(v => /zh[-_]?CN/i.test(v.lang)) || list.find(v => /^zh/i.test(v.lang)) || list[0]
  const refreshVoices = () => {
    loadVoices()
    const cur = voiceSel.value
    clear(voiceSel)
    if (!voices.length) { voiceSel.append(el('option', { value: '' }, ['（浏览器未提供音色，请换用 Chrome/Edge/Safari）'])); return }
    const sorted = [...voices].sort((a, b) => {
      const az = /zh/i.test(a.lang) ? 0 : 1, bz = /zh/i.test(b.lang) ? 0 : 1
      return az - bz || a.name.localeCompare(b.name)
    })
    for (const v of sorted) voiceSel.append(el('option', { value: v.voiceURI }, [`${v.name} · ${v.lang}`]))
    if (cur && sorted.some(v => v.voiceURI === cur)) voiceSel.value = cur
    else { const d = pickDefault(sorted); if (d) voiceSel.value = d.voiceURI }
  }

  // 长文本分块（按句切分，单块 ≤ 1800 字，提升浏览器可靠性与进度精度）
  const MAX_CHUNK = 1800
  const splitChunks = (text) => {
    const sentences = text.match(/[^。！？!?；;\n]+[。！？!?；;\n]*/g) || [text]
    const out = []
    let buf = ''
    for (const s of sentences) {
      if ((buf + s).length > MAX_CHUNK) {
        if (buf) out.push(buf)
        if (s.length > MAX_CHUNK) { for (let i = 0; i < s.length; i += MAX_CHUNK) out.push(s.slice(i, i + MAX_CHUNK)) }
        else buf = s
      } else buf += s
    }
    if (buf) out.push(buf)
    return out.filter(c => c.trim())
  }

  let currentU = null
  const speakNext = () => {
    if (state.idx >= state.chunks.length) {
      state.playing = false; state.paused = false
      setStatus('✓ 朗读完成', 'ok'); updateProgress(state.total, state.total)
      playBtn.textContent = '▶ 朗读'
      return
    }
    const u = new SpeechSynthesisUtterance(state.chunks[state.idx])
    const v = voices.find(x => x.voiceURI === voiceSel.value) || pickDefault(voices)
    if (v) { u.voice = v; u.lang = v.lang } else u.lang = 'zh-CN'
    u.rate = state.rate; u.pitch = state.pitch
    u.onboundary = (e) => {
      const base = state.chunks.slice(0, state.idx).reduce((a, c) => a + c.length, 0)
      updateProgress(state.total, Math.min(state.total, base + (e.charIndex || 0)))
    }
    u.onend = () => {
      if (!state.playing) return
      state.spoken += state.chunks[state.idx].length
      state.idx++
      speakNext()
    }
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled' || e.error === 'cancelled') return
      state.playing = false; state.paused = false
      setStatus('✗ 朗读出错：' + (e.error || '未知'), 'err')
      playBtn.textContent = '▶ 朗读'
    }
    currentU = u
    speechSynthesis.speak(u)
  }

  const play = () => {
    if (!supported) { toast('当前浏览器不支持语音合成（Web Speech API）', 'err'); return }
    if (state.paused) { speechSynthesis.resume(); state.paused = false; setStatus('🔊 朗读中…'); playBtn.textContent = '▶ 朗读'; return }
    const text = cleanMarkdown(textArea.value)
    if (!text) { toast('没有可朗读的文本', 'err'); return }
    speechSynthesis.cancel()
    const chunks = splitChunks(text)
    if (!chunks.length) { toast('没有可朗读的文本', 'err'); return }
    state.total = text.length
    state.spoken = 0; state.idx = 0; state.chunks = chunks
    state.rate = +rate.value; state.pitch = +pitch.value
    state.playing = true; state.paused = false
    setStatus('🔊 朗读中…'); updateProgress(0, state.total); playBtn.textContent = '▶ 朗读'
    speakNext()
  }
  const pause = () => {
    if (state.playing && !state.paused) { speechSynthesis.pause(); state.paused = true; setStatus('⏸ 已暂停'); playBtn.textContent = '▶ 继续' }
  }
  const stop = () => {
    if (supported) speechSynthesis.cancel()
    state.playing = false; state.paused = false; state.idx = 0; state.spoken = 0
    setStatus('就绪'); updateProgress(0, 0); playBtn.textContent = '▶ 朗读'
  }

  // 事件
  loadBtn.onclick = () => fileInput.click()
  fileInput.onchange = () => {
    const f = fileInput.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => { textArea.value = cleanMarkdown(String(r.result || '')); onText(); toast('已载入并清理：' + f.name) }
    r.readAsText(f)
    fileInput.value = ''
  }
  let saveTimer = null
  const onText = () => {
    charCount.textContent = (textArea.value.length) + ' 字（朗读前自动清理 Markdown）'
    clearTimeout(saveTimer); saveTimer = setTimeout(() => LSset('text', textArea.value), 400)
  }
  textArea.oninput = onText
  voiceSel.onchange = () => LSset('voice', voiceSel.value)
  rate.oninput = () => { rateVal.textContent = (+rate.value).toFixed(2) + '×'; LSset('rate', rate.value) }
  pitch.oninput = () => { pitchVal.textContent = (+pitch.value).toFixed(2); LSset('pitch', pitch.value) }
  playBtn.onclick = play
  pauseBtn.onclick = pause
  stopBtn.onclick = stop

  // 初始化
  if (supported) {
    refreshVoices()
    if ('onvoiceschanged' in speechSynthesis) speechSynthesis.onvoiceschanged = refreshVoices
    const sv = LS('voice', '')
    if (sv && [...voiceSel.options].some(o => o.value === sv)) voiceSel.value = sv
  } else {
    voiceSel.append(el('option', { value: '' }, ['（不支持语音合成）']))
    playBtn.disabled = true; pauseBtn.disabled = true; stopBtn.disabled = true
    setStatus('当前浏览器不支持 Web Speech API，无法朗读', 'err')
  }
  if (LS('text', '')) textArea.value = LS('text', '')
  onText()

  // 离线技能包下载卡片
  const skillCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
    el('h3', {}, ['📦 离线生成 MP3 —— md-to-mp3 技能包']),
    el('p', { class: 'muted', style: 'line-height:1.65' }, ['上方朗读由浏览器原生语音合成驱动（即时、无需联网与密钥，纯前端）。如需把文字 / Markdown 导出为可下载的 .mp3 文件，可使用下方离线技能包：它在你本机用 Python + 微软 Edge 免费 TTS 批量生成 MP3（无需 API Key）。']),
    el('a', { class: 'btn primary', href: SKILL_ZIP, download: 'md-to-mp3-skill.zip', style: 'display:inline-block;text-decoration:none;margin-top:6px' }, ['⬇ 下载技能包 (.zip)']),
    el('div', { class: 'muted', style: 'margin:12px 0 6px' }, ['本机使用方法：']),
    el('pre', { style: 'background:var(--panel-2);padding:10px 12px;border-radius:8px;overflow:auto;font-size:12px;margin:0' },
      ['pip install edge-tts\nunzip md-to-mp3-skill.zip\npython3 md-to-mp3/scripts/md_to_mp3.py 你的文件.md\n# 可选：--voice zh-CN-XiaoxiaoNeural --rate 0.9 --bgm bgm.mp3'])
  ])

  panel.append(
    el('p', { class: 'sub' }, ['浏览器原生语音合成（Web Speech API）：即时朗读、纯前端、无需密钥；并内嵌 md-to-mp3 离线技能包用于导出真实 MP3。']),
    el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [loadBtn, charCount]),
      fileInput,
      textArea,
      el('p', { class: 'hint', style: 'margin-top:6px' }, ['粘贴的 Markdown（# 标题、**加粗**、链接等）会在朗读前自动清理为纯净正文。文本自动保存在本机。'])
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'field' }, [el('label', {}, ['音色（优先中文）']), voiceSel]),
        el('div', { class: 'field' }, [el('label', {}, ['语调']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [pitch, pitchVal])])
      ]),
      el('div', { class: 'field' }, [el('label', {}, ['语速（默认 0.9×）']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [rate, rateVal])]),
      el('div', { class: 'row', style: 'margin-top:4px' }, [playBtn, pauseBtn, stopBtn]),
      track, progText,
      status
    ]),
    skillCard
  )
}

export const videoEntertainmentPlugin = {
  id: 'video-entertainment',
  name: '视频娱乐',
  icon: '📺',
  group: '休闲娱乐',
  mount(root) {
    const tabsDef = [
      { label: '📺 视频娱乐站', render: renderTv },
      { label: '🔊 文字转音频', render: renderTextToAudio }
    ]
    const seg = el('div', { class: 'seg' })
    const buttons = tabsDef.map((t, i) => {
      const b = el('button', { class: 'seg-btn' + (i === 0 ? ' on' : ''), onclick: () => setTab(i) }, [t.label])
      seg.append(b)
      return b
    })
    const panel = el('div', {})
    const setTab = (i) => {
      buttons.forEach((b, idx) => b.classList.toggle('on', idx === i))
      clear(panel)
      tabsDef[i].render(panel)
    }
    setTab(0)

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['视频娱乐']),
      seg, panel
    ])
    root.append(page)
  }
}

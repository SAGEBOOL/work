// 视频娱乐：①外部视频站点入口（原功能）②文字转音频
// 设计原则：核心「文字转语音」严格遵循 md-to-mp3 技能 —— 调用微软 Edge 免费 TTS 真实合成（5 个微软音色、默认 0.9×、长文分块、自动清理 Markdown）。
// 合成由本机 edge-tts 服务完成（POST /tts），浏览器端拿到真实 MP3 后播放/下载；无任何浏览器自带机械音。
import { el, clear, toast } from '../../core/ui.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'
// 本机 edge-tts 服务地址：同源（一键启动器托管站点）或 127.0.0.1:8765（线上 --online 模式）。
const isLocalHost = (typeof location !== 'undefined') && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
const TTS_BASE = isLocalHost ? location.origin : 'http://127.0.0.1:8765'

// —— 本地持久化（与全站 opwb:* 约定一致）——
const LS = (k, d) => { try { const v = localStorage.getItem('opwb:tts:' + k); return v == null ? d : v } catch (e) { return d } }
const LSset = (k, v) => { try { localStorage.setItem('opwb:tts:' + k, v) } catch (e) {} }

// —— 清理 Markdown（忠实复刻 md_to_mp3.py 的 strip_markdown，提取纯净正文）——
function cleanMarkdown(text) {
  let t = text || ''
  t = t.replace(/^---[\s\S]*?---\s*\n?/, '')                          // 1. YAML 头
  t = t.replace(/\*\*【本章概要】\*\*[\s\S]*?(?=\n---)/g, '')          // 2. 章节概要块
  t = t.replace(/\*\*【本章概要】\*\*[\s\S]*?(?=---)/g, '')
  t = t.replace(/\*\*【第[一二三四五六七八九十\d]+章完\s*[·・]?\s*约?\d*字?】\*\*/g, '') // 3. 章末统计
  t = t.replace(/^\*字数[：:].*$/gm, '')
  t = t.replace(/^\*主角[：:].*$/gm, '')
  t = t.replace(/^\*保存路径[：:].*$/gm, '')
  t = t.replace(/^\[\^[^\]]+\]:.*$/gm, '')                            // 4. 脚注定义
  t = t.replace(/\[\^\d+\]/g, '')                                     //    脚注引用
  t = t.replace(/==([^=\n]+)==/g, '$1')                              // 5. 高亮
  t = t.replace(/~~([^~\n]+)~~/g, '$1')                              //    删除线
  t = t.replace(/(?<!=)==(?!=)/g, '')
  t = t.replace(/(?<!~)~~(?!~)/g, '')
  t = t.replace(/```[\s\S]*?```/g, ' ')                             // 6. 代码块
  t = t.replace(/`[^`]*`/g, '')                                       //    行内代码
  t = t.replace(/<[^>]+>/g, '')                                       // 7. HTML 标签
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                     // 8. 图片 -> alt
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')                     //    链接 -> text
  t = t.replace(/^#{1,6}\s+/gm, '')                                  // 9. 标题
  t = t.replace(/^[-*_]{3,}\s*$/gm, '')                              // 10. 水平线
  t = t.replace(/\*{2}([^*]+)\*{2}/g, '$1')                         // 11. 加粗
  t = t.replace(/\*([^*]+)\*/g, '$1')                              //     斜体
  t = t.replace(/_{2}([^_]+)_{2}/g, '$1')
  t = t.replace(/_([^_]+)_/g, '$1')
  t = t.replace(/^\s*[-*+]\s+/gm, '')                              // 12. 列表
  t = t.replace(/^\s*\d+\.\s+/gm, '')
  t = t.replace(/^\s*>\s?/gm, '')                                   // 13. 引用
  t = t.replace(/^\|?\s*:?-+:?\s*\|?\s*$/gm, '')                    // 14. 表格分隔
  t = t.replace(/\|\s*/g, ' ')                                       //     表格列
  t = t.replace(/\n{3,}/g, '\n\n')                                  // 15. 空白压缩
  t = t.replace(/[ \t]{2,}/g, ' ')
  return t.trim()
}

// —— 调用本机 edge-tts 服务（md-to-mp3 技能同一后端）合成 MP3 字节 ——
async function localTTS(text, voice, ratePct) {
  const resp = await fetch(TTS_BASE + '/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate: ratePct }),
    targetAddressSpace: 'local'
  })
  if (!resp.ok) {
    const msg = await resp.text().catch(() => 'unknown')
    throw new Error('合成失败（HTTP ' + resp.status + '）：' + msg)
  }
  return await resp.blob()
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

// —— 标签②：文字转音频（微软 Edge TTS 真实合成，与 md-to-mp3 技能一致）——
function renderTextToAudio(panel) {
  // —— 输入区 ——
  const fileInput = el('input', { type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain', style: 'display:none' })
  const loadBtn = el('button', { class: 'btn' }, ['📂 载入 .md/.txt'])
  const textArea = el('textarea', {
    placeholder: '在此粘贴或输入文字 / Markdown；或点击「载入 .md/.txt」导入并自动清理为纯净正文。',
    style: 'width:100%;min-height:200px;resize:vertical;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;box-sizing:border-box'
  })
  const charCount = el('span', { class: 'muted' }, ['0 字'])

  // —— 音色：严格采用 md-to-mp3 技能定义的 5 个微软 Edge Neural 音色 ——
  const VOICES = [
    { id: 'zh-CN-YunxiNeural', name: '男声·云希（默认·小说朗读）' },
    { id: 'zh-CN-XiaoxiaoNeural', name: '女声·晓晓（温和）' },
    { id: 'zh-CN-YunyangNeural', name: '男声·云扬（新闻播报）' },
    { id: 'zh-CN-XiaoyiNeural', name: '女声·晓伊（活泼）' },
    { id: 'zh-CN-YunyeNeural', name: '男声·云野（温和）' }
  ]
  const voiceSel = el('select', {})
  for (const v of VOICES) voiceSel.append(el('option', { value: v.id }, [v.name]))
  const savedVoice = LS('voiceId', 'zh-CN-YunxiNeural')
  if (VOICES.some(v => v.id === savedVoice)) voiceSel.value = savedVoice
  const voiceName = () => (VOICES.find(v => v.id === voiceSel.value) || VOICES[0]).name

  // 语速：默认 0.9×（md-to-mp3 技能默认 rate=0.9）
  const rate = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: LS('rate', '0.9') })
  const rateVal = el('span', { class: 'muted' }, [(+rate.value).toFixed(2) + '×'])
  const computeRatePct = () => { const pct = Math.round((+rate.value - 1) * 100); return (pct > 0 ? '+' : '') + pct + '%' }

  // —— 状态 / 进度 / 播放 ——
  const status = el('div', { class: 'alert' }, ['检测本机服务中…'])
  const fill = el('div', { style: 'height:100%;width:0%;background:var(--primary);transition:width .15s' })
  const progress = el('div', { style: 'height:8px;background:var(--panel-2);border-radius:6px;overflow:hidden;margin-top:4px' }, [fill])
  const progText = el('span', { class: 'muted' }, [''])

  const playBtn = el('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 22px' }, ['🔊 生成语音并播放'])
  const previewBtn = el('button', { class: 'btn' }, ['🎧 试听前几句'])
  const fileNameInput = el('input', { type: 'text', placeholder: '输出文件名（不含扩展名）', style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const downloadBtn = el('button', { class: 'btn primary' }, ['⬇ 下载 MP3'])
  const audioEl = el('audio', { controls: true, style: 'width:100%;margin-top:10px' })
  downloadBtn.disabled = true

  let currentBlobUrl = null
  let serverOk = false

  // 未连服务时的极简启用提示（一行命令）
  const makeCmd = () => 'python run-workbench.py'
  const copyBtn = el('button', { class: 'btn', style: 'padding:4px 10px' }, ['复制'])
  copyBtn.onclick = () => { try { navigator.clipboard.writeText(makeCmd()); toast('已复制命令') } catch (e) { toast('复制失败，请手动复制', 'err') } }
  const hint = el('div', { class: 'alert', style: 'margin-top:10px' }, [
    el('span', {}, ['💡 本功能调用微软 Edge 语音（与 md-to-mp3 技能一致）。在本机终端运行一行命令即可启用：']),
    el('code', { style: 'display:inline-block;background:var(--panel-2);padding:6px 10px;border-radius:8px;margin:0 8px;font-size:13px' }, [makeCmd()]),
    copyBtn
  ])

  const setServerUI = () => {
    const ok = serverOk
    playBtn.disabled = !ok
    previewBtn.disabled = !ok
    downloadBtn.disabled = !ok && !currentBlobUrl
    hint.style.display = ok ? 'none' : ''
    if (ok) { status.className = 'alert ok'; status.textContent = '✓ 已连接本机 Edge TTS 服务，可生成语音' }
    else if (status.textContent.indexOf('合成') < 0 && status.textContent.indexOf('完成') < 0 && status.textContent.indexOf('失败') < 0) { status.className = 'alert'; status.textContent = '· 未连接本机服务：运行命令后刷新即可（见下方）' }
  }

  const checkServer = async () => {
    try {
      const resp = await fetch(TTS_BASE + '/', { method: 'GET', mode: 'cors', targetAddressSpace: 'local' })
      serverOk = resp.ok
    } catch (e) { serverOk = false }
    setServerUI()
    return serverOk
  }

  // —— 生成（合成真实 MP3，可播放 / 可下载）——
  const gen = async (snippet) => {
    if (!serverOk) { await checkServer(); if (!serverOk) { toast('请先在本机运行命令启动服务（见下方提示）', 'err'); return } }
    const full = cleanMarkdown(textArea.value)
    if (!full.trim()) { toast('没有可转换的文本', 'err'); return }
    const text = snippet ? full.slice(0, 200) : full
    const name = voiceName()
    status.className = 'alert'; status.textContent = '⏳ 正在用微软 Edge 语音合成（' + name + '，' + (+rate.value).toFixed(2) + '×）…'
    try {
      const blob = await localTTS(text, voiceSel.value, computeRatePct())
      if (currentBlobUrl) { try { URL.revokeObjectURL(currentBlobUrl) } catch (e) {} }
      currentBlobUrl = URL.createObjectURL(blob)
      audioEl.src = currentBlobUrl
      const fname = (fileNameInput.value.trim() || ('tts-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'))) + '.mp3'
      downloadBtn.disabled = false
      downloadBtn.onclick = () => { const a = el('a', { href: currentBlobUrl, download: fname }); document.body.append(a); a.click(); a.remove() }
      status.className = 'alert ok'; status.textContent = '✓ 合成完成：' + (blob.size / 1024).toFixed(1) + ' KB' + (snippet ? '（试听前几句）' : '')
      const pp = audioEl.play(); if (pp && typeof pp.catch === 'function') pp.catch(() => {})
      saveHistory({ name: (full.slice(0, 12) || '未命名') + '…', kind: 'tts', rate: (+rate.value).toFixed(2), time: Date.now() }); renderHistory()
    } catch (e) {
      status.className = 'alert err'; status.textContent = '✗ ' + e.message
    }
  }
  playBtn.onclick = () => gen(false)
  previewBtn.onclick = () => gen(true)

  // —— 历史 ——
  const historyBox = el('div', { style: 'margin-top:8px' })
  const saveHistory = (item) => {
    let list = []
    try { list = JSON.parse(LS('history', '[]')) || [] } catch (e) {}
    list.unshift(item)
    if (list.length > 20) list = list.slice(0, 20)
    LSset('history', JSON.stringify(list))
  }
  const renderHistory = () => {
    let list = []
    try { list = JSON.parse(LS('history', '[]')) || [] } catch (e) {}
    clear(historyBox)
    if (!list.length) { historyBox.append(el('p', { class: 'muted' }, ['暂无记录'])); return }
    historyBox.append(el('p', { class: 'muted' }, ['最近记录（' + list.length + '）：']))
    for (const it of list) {
      historyBox.append(el('div', { style: 'display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px' }, [
        el('span', {}, [it.name + ' · 语音合成 · ' + it.rate + '×']),
        el('span', { class: 'muted' }, [new Date(it.time).toLocaleString()])
      ]))
    }
  }

  // 事件绑定
  loadBtn.onclick = () => fileInput.click()
  fileInput.onchange = () => {
    const f = fileInput.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => { textArea.value = cleanMarkdown(String(r.result || '')); onText(); toast('已载入并清理：' + f.name) }
    r.readAsText(f); fileInput.value = ''
  }
  let saveTimer = null
  const onText = () => {
    const n = textArea.value.length
    charCount.textContent = n + ' 字（合成前自动清理 Markdown）'
    clearTimeout(saveTimer); saveTimer = setTimeout(() => LSset('text', textArea.value), 400)
  }
  textArea.oninput = onText
  voiceSel.onchange = () => { LSset('voiceId', voiceSel.value) }
  rate.oninput = () => { rateVal.textContent = (+rate.value).toFixed(2) + '×'; LSset('rate', rate.value) }

  if (LS('text', '')) textArea.value = LS('text', '')
  onText()
  renderHistory()
  checkServer()
  let poll = 0
  const pollTimer = setInterval(async () => { if (serverOk || ++poll > 8) { clearInterval(pollTimer); return } await checkServer() }, 3000)

  panel.append(
    el('p', { class: 'sub' }, ['调用微软 Edge 免费 TTS 真实合成语音（与 md-to-mp3 技能完全一致）：5 个微软音色、默认 0.9×、自动清理 Markdown、长文按句分块。需在本机启动语音服务（一行命令）。']),
    el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [loadBtn, charCount]),
      fileInput, textArea,
      el('p', { class: 'hint', style: 'margin-top:6px' }, ['Markdown（# 标题、**加粗**、链接、代码块、表格、脚注、章末统计等）会在合成前自动清理为纯净正文；文本自动保存在本机。'])
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'field' }, [el('label', {}, ['音色（微软 Edge，与 md-to-mp3 技能一致）']), voiceSel]),
        el('div', { class: 'field' }, [el('label', {}, ['语速（默认 0.9×）']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [rate, rateVal])])
      ]),
      el('div', { class: 'field', style: 'margin-top:10px' }, [el('label', {}, ['输出文件名（可选）']), fileNameInput]),
      el('div', { class: 'row', style: 'margin-top:12px;flex-wrap:wrap;gap:10px' }, [playBtn, previewBtn, downloadBtn]),
      audioEl, progress, progText, status, hint
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [historyBox])
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
    const page = el('div', { class: 'page' }, [el('h1', {}, ['视频娱乐']), seg, panel])
    root.append(page)
  }
}

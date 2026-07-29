// 视频娱乐：①外部视频站点入口（原功能）②文字转音频 ③网络收音机
// 设计原则：「文字转语音」严格遵循 md-to-mp3 技能 —— 调用微软 Edge 免费 TTS 真实合成（5 个微软音色、默认 0.9×、长文分块、自动清理 Markdown）。
// 真实 MP3 由本机 edge-tts 服务完成（POST /tts）；朗读/试听在本机服务未启动时自动降级为浏览器原生语音，保证页面始终可用。
import { el, clear, toast } from '../../core/ui.js'
import Hls from 'hls.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'
// 本机 edge-tts 服务地址：同源（一键启动器托管站点）或 127.0.0.1:8765（线上 --online 模式）。
const isLocalHost = (typeof location !== 'undefined') && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
const TTS_BASE = isLocalHost ? location.origin : 'http://127.0.0.1:8765'

// —— 本地持久化（与全站 opwb:* 约定一致）——
const LS = (k, d) => { try { const v = localStorage.getItem('opwb:tts:' + k); return v == null ? d : v } catch (e) { return d } }
const LSset = (k, v) => { try { localStorage.setItem('opwb:tts:' + k, v) } catch (e) {} }

// —— 网络电视（IPTV）本地持久化与默认数据 ——
const iptvLS = (k, d) => { try { const v = localStorage.getItem('opwb:iptv:' + k); return v == null ? d : v } catch (e) { return d } }
const iptvLSset = (k, v) => { try { localStorage.setItem('opwb:iptv:' + k, v) } catch (e) {} }

// 内置演示流：用于验证播放器可用（全球可用性取决于网络）。
const IPTV_DEMO = [
  { group: '🎬 演示流', name: 'Apple HLS 测试', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8', note: 'HLS 测试流，确认播放器可用' },
  { group: '🎬 演示流', name: 'Mux HLS 测试', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', note: 'HLS 测试流' }
]
// 内置精选影片/频道：全部为公开、长期稳定的合法免费 HLS 源（已逐一实测 HTTP 200 且为有效播放列表），
// 不含任何付费 / 盗版内容。免费公开流里没有 HBO 等付费台合法直链；
// 看 HBO / 带中文字幕的好莱坞影片请用你自己的订阅源（运营商 / IPTV 提供商的 m3u）。
const IPTV_MOVIES = [
  { group: '🎬 精选影片', name: 'Angel One 科幻剧集', url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8', note: '免费科幻剧集（Shaka 官方源）' },
  { group: '🎬 精选影片', name: 'Apple 多码率演示', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8', note: 'HLS 多音轨 / 字幕演示' },
  { group: '🎬 精选影片', name: 'Mux 时序测试流', url: 'https://test-streams.mux.dev/pts_shift/master.m3u8', note: '免费测试影片流' }
]
// 一键载入预设（iptv-org 公开播放列表，可能受网络 / 跨域影响）。
const IPTV_PRESETS = [
  { name: '全球精选', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: '中国频道', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u' },
  { name: '新闻', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { name: '体育', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: '电影影视', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { name: '娱乐综艺', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u' }
]

// 解析 m3u / m3u8 文本为标准频道数组
function parseM3U(text) {
  const lines = String(text || '').split(/\r?\n/)
  const out = []
  let cur = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',')
      const meta = comma > -1 ? line.slice(0, comma) : line
      const name = comma > -1 ? line.slice(comma + 1).trim() : '频道'
      const g = meta.match(/group-title="([^"]*)"/i)
      cur = { name: name || '频道', group: g ? g[1] : '导入' }
    } else if (line.startsWith('#EXTGRP:')) {
      const gname = line.slice(8).trim()
      if (cur) cur.group = gname || cur.group
    } else if (line.startsWith('#')) {
      continue
    } else {
      if (cur) { cur.url = line; out.push(cur); cur = null }
      else out.push({ name: '频道', group: '导入', url: line })
    }
  }
  return out
}

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

// —— 浏览器原生语音兜底（服务未启动时也能朗读/试听，并按技能音色名称匹配）——
const VOICES = [
  { id: 'zh-CN-YunxiNeural', name: '男声·云希（默认·小说朗读）', kw: 'yunxi' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '女声·晓晓（温和）', kw: 'xiaoxiao' },
  { id: 'zh-CN-YunyangNeural', name: '男声·云扬（新闻播报）', kw: 'yunyang' },
  { id: 'zh-CN-XiaoyiNeural', name: '女声·晓伊（活泼）', kw: 'xiaoyi' },
  { id: 'zh-CN-YunyeNeural', name: '男声·云野（温和）', kw: 'yunye' }
]

function loadBrowserVoices(ss = (typeof window !== 'undefined' ? window.speechSynthesis : null)) {
  return new Promise((resolve) => {
    const voices = ss ? ss.getVoices() : []
    if (voices && voices.length) { resolve(voices); return }
    if (ss) {
      ss.onvoiceschanged = () => resolve(ss.getVoices())
    }
    setTimeout(() => resolve(ss ? ss.getVoices() : []), 5000)
  })
}
function matchBrowserVoice(voiceId, voices) {
  if (!voices || !voices.length) return null
  const cfg = VOICES.find(v => v.id === voiceId) || VOICES[0]
  const hay = (v) => (v.voiceURI + ' ' + v.name + ' ' + (v.lang || '')).toLowerCase()
  // 1. 按技能定义的关键词匹配（如 yunxi / xiaoxiao）
  let hit = voices.find(v => cfg.kw && hay(v).includes(cfg.kw))
  if (hit) return hit
  // 2. 按 ID 关键词匹配
  const key = voiceId.replace(/^zh-CN-/, '').replace(/Neural$/i, '').toLowerCase()
  hit = voices.find(v => hay(v).includes(key))
  if (hit) return hit
  // 3. 匹配任意中文语音
  const zh = voices.filter(v => (v.lang || '').toLowerCase().startsWith('zh'))
  if (zh.length) return zh[0]
  // 4. 兜底第一个
  return voices[0]
}

// —— 标签①：视频娱乐站 ——
function renderTv(panel) {
  const go = () => window.open(TV_URL, '_blank', 'noopener')
  const card = el('div', { class: 'card', style: 'text-align:center;padding:36px 20px' }, [
    el('div', { style: 'font-size:52px;margin-bottom:10px' }, ['📺']),
    el('div', { style: 'font-size:18px;font-weight:700;margin-bottom:4px' }, ['DSArt 私人电影院']),
    el('div', { class: 'muted' }, [TV_URL]),
    el('button', { class: 'btn primary', style: 'margin-top:18px;font-size:16px;padding:12px 30px', onclick: go }, ['前往私人电影院 →'])
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
  const voiceSel = el('select', {})
  for (const v of VOICES) voiceSel.append(el('option', { value: v.id }, [v.name]))
  const savedVoice = LS('voiceId', 'zh-CN-YunxiNeural')
  if (VOICES.some(v => v.id === savedVoice)) voiceSel.value = savedVoice
  const voiceName = () => (VOICES.find(v => v.id === voiceSel.value) || VOICES[0]).name

  // 语速：默认 0.9×（md-to-mp3 技能默认 rate=0.9）
  const rate = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: LS('rate', '0.9') })
  const rateVal = el('span', { class: 'muted' }, [(+rate.value).toFixed(2) + '×'])
  const computeRatePct = () => { const pct = Math.round((+rate.value - 1) * 100); return (pct > 0 ? '+' : '') + pct + '%' }

  // 服务未启动时：用浏览器原生语音按技能音色名称匹配，保证页面始终可朗读/试听
  const browserSpeak = async (text, snippet) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('当前浏览器不支持语音朗读')
    }
    const voices = await loadBrowserVoices(window.speechSynthesis)
    if (!voices.length) throw new Error('浏览器未找到可用语音包')
    const v = matchBrowserVoice(voiceSel.value, voices)
    const SSU = window.SpeechSynthesisUtterance || SpeechSynthesisUtterance
    const u = new SSU(snippet ? text.slice(0, 200) : text)
    u.voice = v
    u.lang = 'zh-CN'
    u.rate = +rate.value
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    status.className = 'alert ok'
    status.textContent = '🔊 浏览器朗读中（' + (v ? v.name : voiceName()) + '，' + (+rate.value).toFixed(2) + '×）' + (snippet ? '：试听前几句' : '')
  }

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
  downloadBtn.onclick = async () => {
    if (!currentBlobUrl) {
      if (!serverOk) { toast('请先在终端运行 python run-workbench.py 启动本机语音服务', 'err'); return }
      await gen(false)
      return
    }
    const fname = (fileNameInput.value.trim() || ('tts-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'))) + '.mp3'
    const a = el('a', { href: currentBlobUrl, download: fname }); document.body.append(a); a.click(); a.remove()
  }

  let currentBlobUrl = null
  let serverOk = false

  // 未连服务时的极简启用提示（一行命令）
  const makeCmd = () => 'python run-workbench.py'
  const copyBtn = el('button', { class: 'btn', style: 'padding:4px 10px' }, ['复制'])
  copyBtn.onclick = () => { try { navigator.clipboard.writeText(makeCmd()); toast('已复制命令') } catch (e) { toast('复制失败，请手动复制', 'err') } }
  const hint = el('div', { class: 'alert', style: 'margin-top:10px' }, [
    el('span', {}, ['💡 朗读/试听当前可直接使用；如需下载微软 Edge 真实 MP3，请在本机终端运行：']),
    el('code', { style: 'display:inline-block;background:var(--panel-2);padding:6px 10px;border-radius:8px;margin:0 8px;font-size:13px' }, [makeCmd()]),
    copyBtn
  ])

  const setServerUI = () => {
    const ok = serverOk
    // 朗读/试听始终可用（服务未启动时自动降级为浏览器原生语音）
    playBtn.disabled = false
    previewBtn.disabled = false
    downloadBtn.disabled = !ok && !currentBlobUrl
    hint.style.display = ok ? 'none' : ''
    if (ok) {
      if (status.textContent.indexOf('合成') < 0 && status.textContent.indexOf('完成') < 0 && status.textContent.indexOf('朗读中') < 0 && status.textContent.indexOf('失败') < 0) {
        status.className = 'alert ok'; status.textContent = '✓ 已连接本机 Edge TTS 服务，可合成真实 MP3'
      }
    } else if (status.textContent.indexOf('合成') < 0 && status.textContent.indexOf('完成') < 0 && status.textContent.indexOf('朗读中') < 0 && status.textContent.indexOf('失败') < 0) {
      status.className = 'alert'; status.textContent = '· 未连接本机服务：朗读/试听仍可用；下载 MP3 请运行下方命令启动服务'
    }
  }

  const checkServer = async () => {
    try {
      const resp = await fetch(TTS_BASE + '/', { method: 'GET', mode: 'cors', targetAddressSpace: 'local' })
      serverOk = resp.ok
    } catch (e) { serverOk = false }
    setServerUI()
    return serverOk
  }

  // —— edge-tts 真实合成（需要本机服务）——
  const genEdgeTTS = async (full, snippet) => {
    const text = snippet ? full.slice(0, 200) : full
    const name = voiceName()
    status.className = 'alert'; status.textContent = '⏳ 正在用微软 Edge 语音合成（' + name + '，' + (+rate.value).toFixed(2) + '×）…'
    try {
      const blob = await localTTS(text, voiceSel.value, computeRatePct())
      if (currentBlobUrl) { try { URL.revokeObjectURL(currentBlobUrl) } catch (e) {} }
      currentBlobUrl = URL.createObjectURL(blob)
      audioEl.src = currentBlobUrl
      downloadBtn.disabled = false
      status.className = 'alert ok'; status.textContent = '✓ 合成完成：' + (blob.size / 1024).toFixed(1) + ' KB' + (snippet ? '（试听前几句）' : '')
      const pp = audioEl.play(); if (pp && typeof pp.catch === 'function') pp.catch(() => {})
      saveHistory({ name: (full.slice(0, 12) || '未命名') + '…', kind: 'tts', rate: (+rate.value).toFixed(2), time: Date.now() }); renderHistory()
    } catch (e) {
      status.className = 'alert err'; status.textContent = '✗ ' + e.message
    }
  }

  // —— 朗读/试听：优先 edge-tts 真实合成，服务未启动时降级为浏览器原生语音 ——
  const gen = async (snippet) => {
    const full = cleanMarkdown(textArea.value)
    if (!full.trim()) { toast('没有可转换的文本', 'err'); return }
    // 若服务尚未确认，先快速检测一次
    if (!serverOk) await checkServer()
    if (serverOk) {
      await genEdgeTTS(full, snippet)
    } else {
      try {
        await browserSpeak(full, snippet)
      } catch (e) {
        status.className = 'alert err'; status.textContent = '✗ ' + e.message
      }
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
    el('p', { class: 'sub' }, ['调用微软 Edge 免费 TTS 真实合成语音（与 md-to-mp3 技能一致）：5 个微软音色、默认 0.9×、自动清理 Markdown、长文按句分块。朗读/试听无需安装；下载真实 MP3 时在本机启动一行命令服务即可。']),
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

// —— 标签③：网络收音机 ——
function renderRadio(panel) {
  // 默认示例电台：直连音频流（HTTPS Icecast，支持 <audio> 原生播放，全球可用）
  const DEFAULTS = [
    { cat: '🎵 音乐 · 放松', items: [
      { name: 'Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3', note: '舒缓氛围电子' },
      { name: 'Drone Zone', url: 'https://ice1.somafm.com/dronezone-128-mp3', note: '极简 / 氛围' },
      { name: 'Lush', url: 'https://ice1.somafm.com/lush-128-mp3', note: '人声流行' },
      { name: 'Fluid', url: 'https://ice1.somafm.com/fluid-128-mp3', note: '液态爵士' }
    ]},
    { cat: '🎸 独立 / 流行', items: [
      { name: 'Indie Pop Rocks', url: 'https://ice1.somafm.com/indiepop-128-mp3', note: '独立流行' },
      { name: 'Beat Blender', url: 'https://ice1.somafm.com/beatblender-128-mp3', note: '深度浩室' },
      { name: 'Secret Agent', url: 'https://ice1.somafm.com/secretagent-128-mp3', note: '爵士 / 摇摆' }
    ]},
    { cat: '🎹 爵士 / 古典', items: [
      { name: 'Sonic Universe', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3', note: '现代爵士' },
      { name: 'Bohemian', url: 'https://ice1.somafm.com/bohemian-128-mp3', note: '古典室内乐' },
      { name: 'Space Station', url: 'https://ice1.somafm.com/spacestation-128-mp3', note: '太空合成器' }
    ]}
  ]

  const LSr = (k, d) => { try { const v = localStorage.getItem('opwb:radio:' + k); return v == null ? d : v } catch (e) { return d } }
  const LSrSet = (k, v) => { try { localStorage.setItem('opwb:radio:' + k, v) } catch (e) {} }

  let favSet = new Set(); try { favSet = new Set(JSON.parse(LSr('fav', '[]')) || []) } catch (e) {}
  let custom = []; try { custom = JSON.parse(LSr('custom', '[]')) || [] } catch (e) {}
  let vol = parseFloat(LSr('vol', '1')) || 1

  const audio = el('audio', { controls: true, style: 'width:100%;margin-top:10px' })
  audio.volume = vol

  let current = null  // { name, url, note }
  const nowName = el('span', { style: 'font-weight:700' }, ['—'])
  const nowState = el('span', { class: 'muted', style: 'margin-left:8px' }, ['未播放'])
  const favBtn = el('button', { class: 'btn' }, ['☆ 收藏当前'])
  const stopBtn = el('button', { class: 'btn' }, ['⏹ 停止'])
  const volRange = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(vol) })
  const volVal = el('span', { class: 'muted' }, [Math.round(vol * 100) + '%'])
  const listBox = el('div', {})

  const allStations = () => {
    const def = []
    for (const g of DEFAULTS) for (const s of g.items) def.push(s)
    return def.concat(custom)
  }

  const playStation = (st) => {
    try {
      audio.src = st.url
      const p = audio.play()
      if (p && typeof p.catch === 'function') p.catch(() => { nowState.textContent = '⚠ 浏览器拦截，请再点一次'; toast('播放被拦截，请再次点击该电台', 'err') })
      current = st
      nowName.textContent = st.name
      nowState.textContent = '缓冲中…'
      renderList()
      updateFavBtn()
    } catch (e) {
      toast('无法播放：' + st.name, 'err')
    }
  }

  audio.onplaying = () => { nowState.textContent = '● 正在播放' }
  audio.onpause = () => { if (current) nowState.textContent = '⏸ 已暂停' }
  audio.onerror = () => { nowState.textContent = '✗ 流不可用'; toast('该电台流暂时不可用，可尝试其他或检查网络', 'err') }

  const stopPlay = () => {
    audio.pause(); try { audio.removeAttribute('src'); audio.load() } catch (e) {}
    current = null; nowName.textContent = '—'; nowState.textContent = '未播放'; renderList(); updateFavBtn()
  }

  const toggleFav = (st) => {
    if (favSet.has(st.name)) favSet.delete(st.name); else favSet.add(st.name)
    LSrSet('fav', JSON.stringify([...favSet]))
    renderList(); updateFavBtn()
  }
  const updateFavBtn = () => {
    const on = current && favSet.has(current.name)
    favBtn.textContent = on ? '★ 已收藏' : '☆ 收藏当前'
  }

  const removeCustom = (st) => {
    custom = custom.filter(s => s.url !== st.url && s.name !== st.name)
    LSrSet('custom', JSON.stringify(custom))
    if (current && current.url === st.url) stopPlay()
    renderList(); toast('已移除：' + st.name)
  }

  const rowStyle = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid var(--border);margin-bottom:8px;background:var(--bg);transition:.15s'
  const stationRow = (st, isCustom) => {
    const active = current && current.url === st.url
    const fav = favSet.has(st.name)
    return el('div', {
      class: 'radio-row',
      style: rowStyle + (active ? ';border-color:var(--primary);background:var(--panel-2)' : ''),
      onclick: () => playStation(st)
    }, [
      el('span', { style: 'font-size:18px' }, [active ? '🔊' : '📻']),
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, [st.name + (active ? ' · 播放中' : '')]),
        st.note ? el('div', { class: 'muted', style: 'font-size:12px' }, [st.note]) : null
      ].filter(Boolean)),
      el('button', { class: 'btn', style: 'padding:4px 10px', onclick: (e) => { e.stopPropagation(); toggleFav(st) } }, [fav ? '★' : '☆']),
      isCustom ? el('button', { class: 'btn', style: 'padding:4px 10px', onclick: (e) => { e.stopPropagation(); removeCustom(st) } }, ['✕']) : null
    ].filter(Boolean))
  }

  const groupHeader = (txt) => el('div', { style: 'font-weight:700;margin:14px 0 8px;color:var(--text)' }, [txt])

  const renderList = () => {
    clear(listBox)
    const defs = allStations()
    const favStations = defs.filter(s => favSet.has(s.name))
    if (favStations.length) { listBox.append(groupHeader('⭐ 我的收藏')); favStations.forEach(s => listBox.append(stationRow(s, custom.some(c => c.url === s.url)))) }
    for (const g of DEFAULTS) { listBox.append(groupHeader(g.cat)); g.items.forEach(s => listBox.append(stationRow(s, false))) }
    if (custom.length) { listBox.append(groupHeader('📻 我的电台')); custom.forEach(s => listBox.append(stationRow(s, true))) }
  }

  // —— 添加电台 ——
  const nameInput = el('input', { type: 'text', placeholder: '电台名称，如：XXX音乐广播', style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const urlInput = el('input', { type: 'text', placeholder: '直连流地址 .mp3 / .aac / .ogg 等', style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const addBtn = el('button', { class: 'btn primary' }, ['＋ 添加电台'])
  addBtn.onclick = () => {
    const name = nameInput.value.trim(); const url = urlInput.value.trim()
    if (!name || !url) { toast('请填写名称和流地址', 'err'); return }
    if (!/^https?:\/\//i.test(url)) { toast('流地址需以 http(s):// 开头', 'err'); return }
    if (custom.some(s => s.url === url)) { toast('该电台已存在', 'err'); return }
    custom.push({ name, url }); LSrSet('custom', JSON.stringify(custom))
    nameInput.value = ''; urlInput.value = ''
    renderList(); toast('已添加：' + name); playStation({ name, url })
  }

  favBtn.onclick = () => { if (current) toggleFav(current); else toast('请先播放一个电台', 'err') }
  stopBtn.onclick = stopPlay
  volRange.oninput = () => { vol = parseFloat(volRange.value); audio.volume = vol; volVal.textContent = Math.round(vol * 100) + '%'; LSrSet('vol', String(vol)) }

  panel.append(
    el('p', { class: 'sub' }, ['网络收音机：点击任意电台即可收听，支持自定义直连流地址与收藏。默认收录国际免费电台（HTTPS 直连，全球可用）；国内电台多为 m3u8/HLS 或需直链，可用「添加电台」粘贴 .mp3/.aac 等直连地址。']),
    el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'align-items:center;gap:10px;flex-wrap:wrap' }, [
        el('div', { style: 'flex:1;min-width:180px' }, [el('div', { class: 'muted' }, ['正在播放']), el('div', { style: 'font-size:15px' }, [nowName, nowState])]),
        favBtn, stopBtn
      ]),
      audio,
      el('div', { class: 'row', style: 'align-items:center;gap:8px;margin-top:8px' }, [el('span', { class: 'muted' }, ['音量']), volRange, volVal])
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'field' }, [el('label', {}, ['添加电台（直连流地址）']),
        el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, [nameInput, urlInput, addBtn])
      ])
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [listBox])
  )

  renderList(); updateFavBtn()
}

// —— 标签④：网络电视（站内直接播放全球 IPTV；HLS 由 hls.js 解码）——
let iptvCleanup = null

function renderIPTV(panel) {
  let hls = null
  let current = null
  let favSet = new Set(); try { favSet = new Set(JSON.parse(iptvLS('fav', '[]')) || []) } catch (e) {}
  let vol = parseFloat(iptvLS('vol', '1')) || 1

  const video = el('video', { controls: true, playsinline: '', style: 'width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;display:block' })
  video.volume = vol

  const nowName = el('span', { style: 'font-weight:700' }, ['—'])
  const nowState = el('span', { class: 'muted', style: 'margin-left:8px' }, ['未播放'])
  const status = el('div', { class: 'alert' }, ['选择频道开始播放；首次播放请点击视频上的播放键（浏览器限制自动播放）。'])
  const stopBtn = el('button', { class: 'btn' }, ['⏹ 停止'])
  const favBtn = el('button', { class: 'btn' }, ['☆ 收藏当前'])
  const volRange = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(vol) })
  const volVal = el('span', { class: 'muted' }, [Math.round(vol * 100) + '%'])

  const searchInput = el('input', { type: 'text', placeholder: '搜索频道名称…', style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const groupSel = el('select', { style: 'padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })

  const urlInput = el('input', { type: 'text', placeholder: '播放列表 m3u 地址（如 iptv-org 国家/分类 m3u）', style: 'flex:1;min-width:160px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const importBtn = el('button', { class: 'btn primary' }, ['导入播放列表'])
  const pasteArea = el('textarea', { placeholder: '或在此粘贴 m3u 文本（从其他来源复制，避开跨域限制）…', style: 'width:100%;min-height:70px;resize:vertical;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px' })
  const parseBtn = el('button', { class: 'btn' }, ['解析文本'])

  const nameInput = el('input', { type: 'text', placeholder: '频道名称', style: 'flex:1;min-width:120px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const chUrlInput = el('input', { type: 'text', placeholder: '频道流地址 .m3u8 / .mp4 等', style: 'flex:1;min-width:160px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const addBtn = el('button', { class: 'btn primary' }, ['＋ 添加频道'])

  const listBox = el('div', { style: 'max-height:380px;overflow:auto' })

  const allChannels = () => {
    let custom = []; try { custom = JSON.parse(iptvLS('custom', '[]')) || [] } catch (e) {}
    let imported = []; try { imported = JSON.parse(iptvLS('imported', '[]')) || [] } catch (e) {}
    return IPTV_DEMO.map(c => ({ ...c, src: 'demo' }))
      .concat(IPTV_MOVIES.map(c => ({ ...c, src: 'movie' })))
      .concat(custom, imported)
  }

  function stopPlayback() {
    if (hls) { try { hls.destroy() } catch (e) {} hls = null }
    try { video.pause(); video.removeAttribute('src'); video.load() } catch (e) {}
    current = null
    nowName.textContent = '—'; nowState.textContent = '未播放'
    renderList(); updateFavBtn()
  }

  function playChannel(ch) {
    stopPlayback()
    current = ch
    nowName.textContent = ch.name
    nowState.textContent = '连接中…'
    status.className = 'alert'; status.textContent = '⏳ 连接中：' + ch.name + ' …'
    const isHls = /m3u8/i.test(ch.url)
    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl')
    if (isHls && !nativeHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(ch.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => { const p = video.play(); if (p && p.catch) p.catch(() => { nowState.textContent = '▶ 已就绪，请点播放' }) })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { status.className = 'alert err'; status.textContent = '✗ 网络错误：该流可能受网络限制或不可用'; try { hls.startLoad() } catch (e) {} }
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { status.className = 'alert err'; status.textContent = '✗ 媒体解码错误'; try { hls.recoverMediaError() } catch (e) {} }
        else { status.className = 'alert err'; status.textContent = '✗ 无法播放该频道（流不可用 / 网络限制）'; stopPlayback() }
      })
    } else {
      video.src = ch.url
      const p = video.play(); if (p && p.catch) p.catch(() => { nowState.textContent = '▶ 已就绪，请点播放' })
    }
    video.onplaying = () => { nowState.textContent = '● 播放中'; status.className = 'alert ok'; status.textContent = '● 正在播放：' + ch.name }
    video.onerror = () => { nowState.textContent = '✗ 失败'; status.className = 'alert err'; status.textContent = '✗ 该频道流不可用（可能受网络限制或已失效），换一个或添加可用源' }
    renderList(); updateFavBtn()
  }

  function toggleFav(ch) {
    if (favSet.has(ch.name)) favSet.delete(ch.name); else favSet.add(ch.name)
    iptvLSset('fav', JSON.stringify([...favSet]))
    renderList(); updateFavBtn()
  }
  function updateFavBtn() {
    const on = current && favSet.has(current.name)
    favBtn.textContent = on ? '★ 已收藏' : '☆ 收藏当前'
  }

  function removeChannel(ch, kind) {
    if (kind === 'custom') { let a = []; try { a = JSON.parse(iptvLS('custom', '[]')) || [] } catch (e) {}; a = a.filter(x => x.url !== ch.url && x.name !== ch.name); iptvLSset('custom', JSON.stringify(a)) }
    if (kind === 'imported') { let a = []; try { a = JSON.parse(iptvLS('imported', '[]')) || [] } catch (e) {}; a = a.filter(x => x.url !== ch.url && x.name !== ch.name); iptvLSset('imported', JSON.stringify(a)) }
    if (current && current.url === ch.url) stopPlayback()
    renderList(); toast('已移除：' + ch.name)
  }

  function buildGroupOptions() {
    const groups = new Set()
    for (const c of allChannels()) groups.add(c.group)
    const cur = groupSel.value
    clear(groupSel)
    groupSel.append(el('option', { value: 'all' }, ['全部频道']))
    groupSel.append(el('option', { value: 'fav' }, ['★ 我的收藏']))
    for (const g of [...groups].sort()) groupSel.append(el('option', { value: g }, [g]))
    if ([...groupSel.options].some(o => o.value === cur)) groupSel.value = cur
  }

  function appendGroup(title, arr) {
    if (!arr.length) return
    listBox.append(el('div', { style: 'font-weight:700;margin:12px 0 8px;color:var(--text)' }, [title]))
    for (const c of arr) {
      const kind = c.src === 'demo' ? null : (c.src === 'custom' ? 'custom' : 'imported')
      const active = current && current.url === c.url
      const fav = favSet.has(c.name)
      listBox.append(el('div', {
        class: 'radio-row',
        style: 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid var(--border);margin-bottom:8px;background:var(--bg);transition:.15s' + (active ? ';border-color:var(--primary);background:var(--panel-2)' : ''),
        onclick: () => playChannel(c)
      }, [
        el('span', { style: 'font-size:18px' }, [active ? '🔊' : '📡']),
        el('div', { style: 'flex:1;min-width:0' }, [
          el('div', { style: 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, [c.name + (active ? ' · 播放中' : '')]),
          el('div', { class: 'muted', style: 'font-size:12px' }, [(c.group || '') + (c.note ? ' · ' + c.note : '')])
        ]),
        el('button', { class: 'btn', style: 'padding:4px 10px', onclick: (e) => { e.stopPropagation(); toggleFav(c) } }, [fav ? '★' : '☆']),
        kind ? el('button', { class: 'btn', style: 'padding:4px 10px', onclick: (e) => { e.stopPropagation(); removeChannel(c, kind) } }, ['✕']) : null
      ].filter(Boolean)))
    }
  }

  function renderList() {
    clear(listBox)
    const list = allChannels()
    const q = (searchInput.value || '').trim().toLowerCase()
    const gf = groupSel.value
    const favs = list.filter(c => favSet.has(c.name))
    if (gf !== 'fav' && favs.length) appendGroup('⭐ 我的收藏', favs)
    const map = {}
    for (const c of list) {
      if (favSet.has(c.name) && gf === 'all') continue
      if (q && !c.name.toLowerCase().includes(q)) continue
      if (gf !== 'all' && gf !== 'fav' && c.group !== gf) continue
      ;(map[c.group] ||= []).push(c)
    }
    const keys = Object.keys(map).sort()
    for (const k of keys) appendGroup(k, map[k])
    if (!listBox.children.length) listBox.append(el('p', { class: 'muted' }, ['暂无频道，使用上方「导入播放列表 / 添加频道」加载全球电视源。']))
  }

  async function doImport(url) {
    if (!/^https?:\/\//i.test(url)) { toast('请输入有效的 http(s) 播放列表地址', 'err'); return }
    importBtn.disabled = true; status.className = 'alert'; status.textContent = '⏳ 正在获取播放列表…'
    try {
      const resp = await fetch(url, { mode: 'cors' })
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const text = await resp.text()
      const chs = parseM3U(text)
      if (!chs.length) throw new Error('未解析到频道')
      iptvLSset('imported', JSON.stringify(chs))
      buildGroupOptions(); renderList()
      status.className = 'alert ok'; status.textContent = '✓ 已导入 ' + chs.length + ' 个频道'
      toast('已导入 ' + chs.length + ' 个频道')
    } catch (e) {
      status.className = 'alert err'; status.textContent = '✗ 导入失败：' + e.message + '（可能跨域受限；请改用「粘贴 m3u 文本」或手动添加）'
      toast('导入失败，可粘贴文本或手动添加', 'err')
    } finally { importBtn.disabled = false }
  }

  stopBtn.onclick = stopPlayback
  favBtn.onclick = () => { if (current) toggleFav(current); else toast('请先播放一个频道', 'err') }
  volRange.oninput = () => { vol = parseFloat(volRange.value); video.volume = vol; volVal.textContent = Math.round(vol * 100) + '%'; iptvLSset('vol', String(vol)) }
  searchInput.oninput = renderList
  groupSel.onchange = renderList
  importBtn.onclick = () => { if (urlInput.value.trim()) doImport(urlInput.value.trim()) }
  parseBtn.onclick = () => {
    const chs = parseM3U(pasteArea.value)
    if (!chs.length) { toast('未解析到频道', 'err'); return }
    iptvLSset('imported', JSON.stringify(chs))
    buildGroupOptions(); renderList()
    status.className = 'alert ok'; status.textContent = '✓ 已从文本解析 ' + chs.length + ' 个频道'
    toast('已解析 ' + chs.length + ' 个频道')
  }
  addBtn.onclick = () => {
    const name = nameInput.value.trim(); const url = chUrlInput.value.trim()
    if (!name || !url) { toast('请填写名称和流地址', 'err'); return }
    if (!/^https?:\/\//i.test(url)) { toast('流地址需以 http(s):// 开头', 'err'); return }
    let custom = []; try { custom = JSON.parse(iptvLS('custom', '[]')) || [] } catch (e) {}
    custom.push({ name, url, group: '我的频道', src: 'custom' })
    iptvLSset('custom', JSON.stringify(custom))
    nameInput.value = ''; chUrlInput.value = ''
    buildGroupOptions(); renderList(); toast('已添加：' + name); playChannel({ name, url, group: '我的频道' })
  }

  const presetRow = el('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px;margin-top:10px' },
    IPTV_PRESETS.map(p => el('button', { class: 'btn', style: 'padding:6px 12px', onclick: () => doImport(p.url) }, ['⚡ ' + p.name]))
  )

  panel.append(
    el('p', { class: 'sub' }, ['网络电视：在站内直接播放全球 IPTV 频道。HLS(.m3u8) 由 hls.js 解码，主流浏览器均可播放。已内置「🎬 精选影片」（均为公开、长期稳定的合法免费 HLS 源，已逐一实测可达）；点击下方「⚡ 预设 / 导入播放列表」可一键加载 iptv-org 全球频道（含中国、新闻、体育、电影、娱乐等分类，实时获取）。',
      el('br', {}),
      '说明：免费公开流里没有 HBO 等付费台的合法直链；想看 HBO / 带中文字幕的好莱坞影片，请用你自己的订阅源（运营商 / IPTV 提供商的 m3u），通过「添加频道 / 粘贴 m3u」播放。频道可用性取决于你的网络；跨域失败可粘贴 m3u 文本或手动添加。']),
    el('div', { class: 'card' }, [
      video,
      el('div', { class: 'row', style: 'align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px' }, [
        el('div', { style: 'flex:1;min-width:180px' }, [el('div', { class: 'muted' }, ['正在播放']), el('div', { style: 'font-size:15px' }, [nowName, nowState])]),
        favBtn, stopBtn
      ]),
      el('div', { class: 'row', style: 'align-items:center;gap:8px;margin-top:8px' }, [el('span', { class: 'muted' }, ['音量']), volRange, volVal]),
      status
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, [searchInput, groupSel]),
      el('div', { class: 'field', style: 'margin-top:12px' }, [el('label', {}, ['导入播放列表（m3u 地址）']),
        el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, [urlInput, importBtn])
      ]),
      el('details', { style: 'margin-top:8px' }, [
        el('summary', { style: 'cursor:pointer;color:var(--text-2);font-size:13px' }, ['或粘贴 m3u 文本（避开跨域限制）']),
        el('div', { style: 'margin-top:8px' }, [pasteArea, el('div', { class: 'row', style: 'margin-top:8px' }, [parseBtn])])
      ]),
      el('div', { class: 'field', style: 'margin-top:12px' }, [el('label', {}, ['添加单个频道']),
        el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, [nameInput, chUrlInput, addBtn])
      ]),
      el('div', { class: 'muted', style: 'margin-top:10px' }, ['⚡ 一键载入预设全球频道（iptv-org，可能受网络 / 跨域影响）：']),
      presetRow
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [listBox])
  )

  buildGroupOptions(); renderList(); updateFavBtn()
  iptvCleanup = stopPlayback
}

export const videoEntertainmentPlugin = {
  id: 'video-entertainment',
  name: '视频娱乐',
  icon: '📺',
  group: '休闲娱乐',
  mount(root) {
    const tabsDef = [
      { label: '📺 私人电影院', render: renderTv },
      { label: '🔊 文字转音频', render: renderTextToAudio },
      { label: '📻 网络收音机', render: renderRadio },
      { label: '📡 网络电视', render: renderIPTV }
    ]
    const seg = el('div', { class: 'seg' })
    const buttons = tabsDef.map((t, i) => {
      const b = el('button', { class: 'seg-btn' + (i === 0 ? ' on' : ''), onclick: () => setTab(i) }, [t.label])
      seg.append(b)
      return b
    })
    const panel = el('div', {})
    const setTab = (i) => {
      if (typeof iptvCleanup === 'function') { try { iptvCleanup() } catch (e) {} iptvCleanup = null }
      buttons.forEach((b, idx) => b.classList.toggle('on', idx === i))
      clear(panel)
      tabsDef[i].render(panel)
    }
    setTab(0)
    const page = el('div', { class: 'page' }, [el('h1', {}, ['视频娱乐']), seg, panel])
    root.append(page)
  }
}

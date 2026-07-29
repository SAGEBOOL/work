// 视频娱乐：①外部视频站点入口（原功能）②文字转音频（复刻 md-to-mp3 技能流程：清理 Markdown → 本机 edge-tts → 真实 MP3）
import { el, clear, toast } from '../../core/ui.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'
// TTS 服务地址：若工作台本身就跑在 127.0.0.1/localhost（一键启动器模式），则同源直连；
// 否则（线上站点）连接本机 127.0.0.1:8765 的本地服务。
const isLocalHost = (typeof location !== 'undefined') && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
const TTS_BASE = isLocalHost ? location.origin : 'http://127.0.0.1:8765'

// —— 本地持久化（与全站 opwb:* 约定一致）——
const LS = (k, d) => { try { const v = localStorage.getItem('opwb:tts:' + k); return v == null ? d : v } catch (e) { return d } }
const LSset = (k, v) => { try { localStorage.setItem('opwb:tts:' + k, v) } catch (e) {} }

// md-to-mp3 技能内置音色（默认男声云希）
const VOICES = [
  { id: 'zh-CN-YunxiNeural', name: '男声·云希（默认·小说朗读）' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '女声·晓晓（温和）' },
  { id: 'zh-CN-YunyangNeural', name: '男声·云扬（新闻播报）' },
  { id: 'zh-CN-XiaoyiNeural', name: '女声·晓伊（活泼）' },
  { id: 'zh-CN-YunyeNeural', name: '男声·云野（温和）' }
]

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
  t = t.replace(/\*([^*]+)\*/g, '$1')                               //     斜体
  t = t.replace(/_{2}([^_]+)_{2}/g, '$1')
  t = t.replace(/_([^_]+)_/g, '$1')
  t = t.replace(/^\s*[-*+]\s+/gm, '')                               // 12. 列表
  t = t.replace(/^\s*\d+\.\s+/gm, '')
  t = t.replace(/^\s*>\s?/gm, '')                                   // 13. 引用
  t = t.replace(/^\|?\s*:?-+:?\s*\|?\s*$/gm, '')                    // 14. 表格分隔
  t = t.replace(/\|\s*/g, ' ')                                       //     表格列
  t = t.replace(/\n{3,}/g, '\n\n')                                  // 15. 空白压缩
  t = t.replace(/[ \t]{2,}/g, ' ')
  return t.trim()
}

// 按句分块（≤5000 字，复刻 edge-tts 单请求上限）
function splitChunks(text, max = 5000) {
  const sentences = text.split(/(?<=[。！？!?\n])/)
  const chunks = []
  let cur = ''
  for (const s of sentences) {
    if (!s.trim()) continue
    if ((cur + s).length <= max) cur += s
    else {
      if (cur) chunks.push(cur.trim())
      if (s.length > max) { for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max).trim()); cur = '' }
      else cur = s
    }
  }
  if (cur) chunks.push(cur.trim())
  return chunks.filter(c => c.trim())
}

// —— 调用本机 edge-tts 服务生成单段 MP3 ——
async function localTTSChunk(text, voice, ratePct) {
  const resp = await fetch(TTS_BASE + '/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate: ratePct }),
    targetAddressSpace: 'local' // 声明目标为本地网络，避免 Chrome 138+ 本地网络访问权限拦截
  })
  if (!resp.ok) {
    const msg = await resp.text().catch(() => 'unknown')
    throw new Error('本地服务错误（HTTP ' + resp.status + '）：' + msg)
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

// —— 标签②：文字转音频（真实 MP3 生成，复刻 md-to-mp3 技能流程）——
function renderTextToAudio(panel) {
  const fileInput = el('input', { type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain', style: 'display:none' })
  const loadBtn = el('button', { class: 'btn' }, ['📂 载入 .md/.txt'])
  const textArea = el('textarea', {
    placeholder: '在此粘贴或输入文字 / Markdown；或点击「载入 .md/.txt」导入并自动清理为纯净正文。',
    style: 'width:100%;min-height:200px;resize:vertical;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;box-sizing:border-box'
  })
  const charCount = el('span', { class: 'muted' }, ['0 字'])
  const voiceSel = el('select', {})
  for (const v of VOICES) voiceSel.append(el('option', { value: v.id }, [v.name]))
  const savedVoice = LS('voice', 'zh-CN-YunxiNeural')
  if (VOICES.some(v => v.id === savedVoice)) voiceSel.value = savedVoice
  const rate = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: LS('rate', '0.9') })
  const rateVal = el('span', { class: 'muted' }, [(+rate.value).toFixed(2) + '×'])
  const fileNameInput = el('input', { type: 'text', placeholder: '输出文件名（不含扩展名）', style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const genBtn = el('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 22px' }, ['⬇ 生成 MP3'])
  const previewBtn = el('button', { class: 'btn' }, ['🔊 试听（真实音色）'])
  const progress = el('div', { style: 'height:8px;background:var(--panel-2);border-radius:6px;overflow:hidden;margin-top:4px' })
  const fill = el('div', { style: 'height:100%;width:0%;background:var(--primary);transition:width .15s' })
  progress.append(fill)
  const progText = el('span', { class: 'muted' }, ['0 / 0 段'])
  const status = el('div', { class: 'alert' }, ['检测本地服务中…'])
  const recheckBtn = el('button', { class: 'btn' }, ['🔄 重新检测'])
  const audioEl = el('audio', { controls: true, style: 'width:100%;margin-top:10px;display:none' })
  const downloadLink = el('a', { class: 'btn primary', download: 'tts.mp3', style: 'display:none;margin-top:8px;text-decoration:none' }, ['⬇ 下载 MP3'])
  const historyBox = el('div', { style: 'margin-top:8px' })

  let serverOk = false

  const setStatus = (msg, type) => { status.className = 'alert' + (type ? ' ' + type : ''); status.textContent = msg }
  const updateProgress = (done, total) => { fill.style.width = (total ? Math.min(100, done / total * 100) : 0) + '%'; progText.textContent = `${done} / ${total} 段` }

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
    if (!list.length) { historyBox.append(el('p', { class: 'muted' }, ['暂无生成记录'])); return }
    historyBox.append(el('p', { class: 'muted' }, ['最近生成（' + list.length + '）：']))
    for (const it of list) {
      historyBox.append(el('div', { style: 'display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px' }, [
        el('span', {}, [it.name + ' · ' + it.voice + ' · ' + it.rate + '× · ' + it.chunks + '段']),
        el('span', { class: 'muted' }, [((it.size || 0) / 1024).toFixed(1) + ' KB · ' + new Date(it.time).toLocaleString()])
      ]))
    }
  }

  const checkServer = async () => {
    try {
      const resp = await fetch(TTS_BASE + '/', { method: 'GET', mode: 'cors', targetAddressSpace: 'local' })
      serverOk = resp.ok
      if (serverOk) setStatus('✓ 已连接本机 Edge TTS 服务（' + TTS_BASE + '）', 'ok')
      else setStatus('✗ 本机服务响应异常', 'err')
    } catch (e) {
      serverOk = false
      setStatus('✗ 未检测到本机 Edge TTS 服务，请按下方说明启动', 'err')
    }
    genBtn.disabled = !serverOk
    previewBtn.disabled = !serverOk
  }

  const generate = async () => {
    if (!serverOk) { await checkServer(); if (!serverOk) { toast('请先启动本机 Edge TTS 服务', 'err'); return } }
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可转换的文本', 'err'); return }
    const voice = voiceSel.value
    const rateNum = +rate.value
    const pct = Math.round((rateNum - 1) * 100)
    const ratePct = (pct > 0 ? '+' : '') + pct + '%'
    const chunks = splitChunks(text)
    genBtn.disabled = true; previewBtn.disabled = true; downloadLink.style.display = 'none'; audioEl.style.display = 'none'
    const blobs = []
    try {
      for (let i = 0; i < chunks.length; i++) {
        setStatus('⏳ 正在生成第 ' + (i + 1) + '/' + chunks.length + ' 段（本机 edge-tts 合成）…', '')
        updateProgress(i, chunks.length)
        const blob = await localTTSChunk(chunks[i], voice, ratePct)
        blobs.push(blob)
      }
      updateProgress(chunks.length, chunks.length)
      const finalBlob = new Blob(blobs, { type: 'audio/mpeg' })
      const url = URL.createObjectURL(finalBlob)
      audioEl.src = url; audioEl.style.display = ''
      const fname = (fileNameInput.value.trim() || ('tts-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'))) + '.mp3'
      downloadLink.href = url; downloadLink.download = fname; downloadLink.style.display = ''
      setStatus('✓ 生成完成：' + fname + '（' + (finalBlob.size / 1024).toFixed(1) + ' KB，' + chunks.length + ' 段合并）', 'ok')
      saveHistory({ name: fname, voice, rate: rateNum.toFixed(2), size: finalBlob.size, time: Date.now(), chunks: chunks.length })
      renderHistory()
    } catch (e) {
      setStatus('✗ 生成失败：' + e.message, 'err')
    } finally {
      genBtn.disabled = false; previewBtn.disabled = false
    }
  }

  const preview = async () => {
    if (!serverOk) { await checkServer(); if (!serverOk) { toast('请先启动本机 Edge TTS 服务', 'err'); return } }
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可试听文本', 'err'); return }
    const voice = voiceSel.value
    const rateNum = +rate.value
    const pct = Math.round((rateNum - 1) * 100)
    const ratePct = (pct > 0 ? '+' : '') + pct + '%'
    const snippet = text.slice(0, 200)
    previewBtn.disabled = true; genBtn.disabled = true
    setStatus('🔊 正在用真实音色试听（本机 edge-tts 合成片段）…')
    try {
      const blob = await localTTSChunk(snippet, voice, ratePct)
      const url = URL.createObjectURL(blob)
      audioEl.src = url; audioEl.style.display = ''
      audioEl.currentTime = 0
      try { await audioEl.play() } catch (e) {}
      setStatus('🔊 试听中（真实 ' + voice + ' 音色，' + snippet.length + ' 字片段）', 'ok')
    } catch (e) {
      setStatus('✗ 试听失败：' + e.message, 'err')
    } finally {
      previewBtn.disabled = false; genBtn.disabled = false
    }
  }

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
    charCount.textContent = n + ' 字（生成前自动清理 Markdown）'
    clearTimeout(saveTimer); saveTimer = setTimeout(() => LSset('text', textArea.value), 400)
  }
  textArea.oninput = onText
  voiceSel.onchange = () => LSset('voice', voiceSel.value)
  rate.oninput = () => { rateVal.textContent = (+rate.value).toFixed(2) + '×'; LSset('rate', rate.value) }
  genBtn.onclick = generate
  previewBtn.onclick = preview
  recheckBtn.onclick = checkServer

  if (LS('text', '')) textArea.value = LS('text', '')
  onText()
  renderHistory()
  checkServer()
  // 加载后短时自动重试探测：用户稍后启动服务即可自动连上，无需手动点「重新检测」
  let pollCount = 0
  const pollTimer = setInterval(async () => {
    if (serverOk || ++pollCount > 10) { clearInterval(pollTimer); return }
    await checkServer()
  }, 2500)

  panel.append(
    el('p', { class: 'sub' }, ['复刻 md-to-mp3 技能流程：清理 Markdown → 本机 edge-tts（与技能同一后端）→ 真实可下载 MP3。默认男声云希、语速 0.9×。']),
    el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [loadBtn, charCount]),
      fileInput, textArea,
      el('p', { class: 'hint', style: 'margin-top:6px' }, ['Markdown（# 标题、**加粗**、链接、代码块、表格、脚注、章末统计等）会在生成前自动清理为纯净正文。文本自动保存在本机。'])
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'field' }, [el('label', {}, ['音色（微软 Edge）']), voiceSel]),
        el('div', { class: 'field' }, [el('label', {}, ['语速（默认 0.9×）']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [rate, rateVal])])
      ]),
      el('div', { class: 'field', style: 'margin-top:6px' }, [el('label', {}, ['输出文件名']), fileNameInput]),
      el('div', { class: 'row', style: 'margin-top:10px' }, [genBtn, previewBtn]),
      progress, progText,
      el('div', { class: 'row', style: 'gap:10px;align-items:center;margin-top:6px' }, [status, recheckBtn]),
      audioEl, downloadLink
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { style: 'font-weight:600;margin-bottom:6px' }, ['一步启动（推荐）']),
      el('p', { class: 'hint', style: 'margin:0 0 6px' }, ['在项目目录执行下面这一条命令，会自动装好依赖、启动服务并打开本页面（同源直连，无需任何配置）：']),
      el('div', {}, [el('code', { style: 'display:inline-block;background:var(--panel-2);padding:8px 12px;border-radius:8px;font-size:13px' }, ['python run-workbench.py'])]),
      el('p', { class: 'hint', style: 'margin:8px 0 0' }, ['若你用的是线上站点，加参数即可：', el('code', {}, ['python run-workbench.py --online']), '（仅启动语音服务并打开线上页面）。']),
      el('p', { class: 'hint', style: 'margin:8px 0 0' }, ['服务启动后保持窗口运行即可。本页面会自动连上并启用「生成 MP3 / 试听」。'])
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

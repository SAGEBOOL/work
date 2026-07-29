// 视频娱乐：①外部视频站点入口（原功能）②文字转音频
// 设计原则：核心「听声音」用浏览器自带语音合成，零后端、零服务器、任何人打开即用（一步到位）；
// 真正的 MP3 文件导出作为「可选」能力，仅在用户本机运行过服务时可用，绝不阻塞主功能。
import { el, clear, toast } from '../../core/ui.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'
// 本机 edge-tts 服务（仅用于「可选」的 MP3 导出）。同源（一键启动器）或 127.0.0.1:8765。
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

// 按句分块（≤5000 字，与 TTS 单请求上限一致）
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

// —— 调用本机 edge-tts 服务生成单段 MP3（仅用于「可选」的 MP3 导出）——
async function localTTSChunk(text, voice, ratePct) {
  const resp = await fetch(TTS_BASE + '/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate: ratePct }),
    targetAddressSpace: 'local'
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

// —— 标签②：文字转音频（浏览器原生语音合成，零后端；MP3 导出为可选）——
function renderTextToAudio(panel) {
  const synth = window.speechSynthesis
  const hasSynth = !!synth

  // —— 输入区 ——
  const fileInput = el('input', { type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain', style: 'display:none' })
  const loadBtn = el('button', { class: 'btn' }, ['📂 载入 .md/.txt'])
  const textArea = el('textarea', {
    placeholder: '在此粘贴或输入文字 / Markdown；或点击「载入 .md/.txt」导入并自动清理为纯净正文。',
    style: 'width:100%;min-height:200px;resize:vertical;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;box-sizing:border-box'
  })
  const charCount = el('span', { class: 'muted' }, ['0 字'])

  // —— 音色：严格采用 md-to-mp3 技能定义的 5 个微软 Edge Neural 音色（与技能一致）——
  const VOICES = [
    { id: 'zh-CN-YunxiNeural', name: '男声·云希（默认·小说朗读）', kw: 'Yunxi' },
    { id: 'zh-CN-XiaoxiaoNeural', name: '女声·晓晓（温和）', kw: 'Xiaoxiao' },
    { id: 'zh-CN-YunyangNeural', name: '男声·云扬（新闻播报）', kw: 'Yunyang' },
    { id: 'zh-CN-XiaoyiNeural', name: '女声·晓伊（活泼）', kw: 'Xiaoyi' },
    { id: 'zh-CN-YunyeNeural', name: '男声·云野（温和）', kw: 'Yunye' }
  ]
  const voiceSel = el('select', {})
  for (const v of VOICES) voiceSel.append(el('option', { value: v.id }, [v.name]))
  const savedVoice = LS('voiceId', 'zh-CN-YunxiNeural')
  if (VOICES.some(v => v.id === savedVoice)) voiceSel.value = savedVoice

  // 浏览器真实可用音色（用于实际发声）：按技能音色做最佳匹配
  let browserVoices = []
  const loadVoices = () => new Promise(resolve => {
    if (!hasSynth) { resolve([]); return }
    let resolved = false
    let timer = null
    const cleanup = () => { if (timer) clearInterval(timer); synth.removeEventListener('voiceschanged', tryResolve) }
    const tryResolve = () => {
      if (resolved) return
      const list = synth.getVoices() || []
      if (list.length) { resolved = true; cleanup(); browserVoices = list; resolve(list) }
    }
    tryResolve()
    timer = setInterval(tryResolve, 80)
    synth.addEventListener('voiceschanged', tryResolve)
    // 保险：最长等 5 秒
    setTimeout(() => { if (!resolved) { resolved = true; cleanup(); resolve(synth.getVoices() || []) } }, 5000)
  })
  if (hasSynth) loadVoices() // 预加载，不阻塞

  const getVoice = () => {
    if (!hasSynth) return null
    const skill = VOICES.find(v => v.id === voiceSel.value) || VOICES[0]
    if (!browserVoices.length) return null
    // 1) 关键词精确匹配（Windows 多为 Microsoft Yunxi / Xiaoxiao 等）
    let m = browserVoices.find(v => skill.kw && v.name && v.name.indexOf(skill.kw) >= 0)
    // 2) 忽略大小写再试一次（部分浏览器名字大小写不同）
    if (!m) m = browserVoices.find(v => skill.kw && v.name && v.name.toLowerCase().indexOf(skill.kw.toLowerCase()) >= 0)
    // 3) 按 lang 字段匹配 zh-CN
    if (!m) m = browserVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh-cn'))
    // 4) 任一中文语音
    if (!m) m = browserVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
    // 5) 兜底第一个可用语音
    return m || browserVoices[0] || null
  }

  // 语速：默认 0.9×（md-to-mp3 技能默认 rate=-10%，即 0.9×）
  const rate = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: LS('rate', '0.9') })
  const rateVal = el('span', { class: 'muted' }, [(+rate.value).toFixed(2) + '×'])

  // —— 播放控制（浏览器原生，核心功能）——
  const playBtn = el('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 22px' }, ['🔊 朗读'])
  const pauseBtn = el('button', { class: 'btn' }, ['⏸ 暂停'])
  const stopBtn = el('button', { class: 'btn' }, ['⏹ 停止'])
  const previewBtn = el('button', { class: 'btn' }, ['🔊 试听前几句'])
  const progress = el('div', { style: 'height:8px;background:var(--panel-2);border-radius:6px;overflow:hidden;margin-top:4px' })
  const fill = el('div', { style: 'height:100%;width:0%;background:var(--primary);transition:width .15s' })
  progress.append(fill)
  const progText = el('span', { class: 'muted' }, ['0 / 0 段'])
  const status = el('div', { class: 'alert' }, [hasSynth ? '就绪：选择音色后点「朗读」即可收听' : '⚠ 当前浏览器不支持语音合成，无法朗读'])

  // 播放状态机
  let playing = false
  let paused = false
  let chunks = []
  let curIdx = 0
  const updateProgress = (done, total) => { fill.style.width = (total ? Math.min(100, done / total * 100) : 0) + '%'; progText.textContent = `${done} / ${total} 段` }

  let keepAliveTimer = null
  const clearKeepAlive = () => { if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null } }
  const startKeepAlive = () => {
    clearKeepAlive()
    // Chrome 长文本会自动 pause，需定时 resume 防止报 interrupted
    keepAliveTimer = setInterval(() => {
      if (playing && !paused && synth.paused) { try { synth.resume() } catch (e) {} }
    }, 3000)
  }
  const stopPlay = () => {
    clearKeepAlive()
    try { if (synth) synth.cancel() } catch (e) {}
    playing = false; paused = false; pauseBtn.textContent = '⏸ 暂停'
  }

  const speakChunk = (i) => {
    if (!playing || i >= chunks.length) {
      if (i >= chunks.length) { updateProgress(chunks.length, chunks.length); status.className = 'alert ok'; status.textContent = '✓ 朗读完成'; playing = false; pauseBtn.textContent = '⏸ 暂停'; clearKeepAlive() }
      return
    }
    const u = new SpeechSynthesisUtterance(chunks[i])
    const v = getVoice()
    if (v) { u.voice = v; u.lang = v.lang || 'zh-CN' }
    else { u.lang = 'zh-CN' }
    u.rate = Math.max(0.1, Math.min(2, +rate.value))
    u.onend = () => { if (!playing) return; curIdx = i + 1; updateProgress(curIdx, chunks.length); speakChunk(curIdx) }
    u.onerror = (e) => {
      if (e && (e.error === 'canceled' || e.error === 'interrupted')) return
      status.className = 'alert err'; status.textContent = '✗ 朗读出错：' + (e && e.error || 'unknown'); playing = false; clearKeepAlive()
    }
    try { synth.speak(u) } catch (e) { status.className = 'alert err'; status.textContent = '✗ 朗读失败：' + e.message; clearKeepAlive() }
  }

  const startPlay = async (targetChunks) => {
    if (!hasSynth) { toast('当前浏览器不支持语音合成', 'err'); return }
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可转换的文本', 'err'); return }
    status.className = 'alert'; status.textContent = '⏳ 正在准备音色…'
    const voices = await loadVoices()
    if (!voices.length) { status.className = 'alert err'; status.textContent = '✗ 当前浏览器没有可用语音，请换 Chrome/Edge/Safari 试试'; return }
    // 先停止旧播放，并给 Chrome 一小段时间完成 cancel，避免 interrupted
    stopPlay()
    await new Promise(r => setTimeout(r, 60))
    chunks = targetChunks || splitChunks(text)
    if (!chunks.length) { toast('没有可转换的文本', 'err'); return }
    curIdx = 0; playing = true; paused = false
    pauseBtn.textContent = '⏸ 暂停'
    const v = getVoice()
    status.className = 'alert'; status.textContent = '🔊 正在朗读（' + (v ? v.name : '默认音色') + '）…'
    startKeepAlive()
    speakChunk(0)
  }

  playBtn.onclick = () => startPlay()
  previewBtn.onclick = () => {
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可试听文本', 'err'); return }
    const snippet = text.slice(0, 200)
    startPlay([snippet])
  }
  pauseBtn.onclick = () => {
    if (!playing) return
    if (!paused) { try { synth.pause() } catch (e) {} paused = true; pauseBtn.textContent = '▶ 继续'; status.className = 'alert'; status.textContent = '⏸ 已暂停' }
    else { try { synth.resume() } catch (e) {} paused = false; pauseBtn.textContent = '⏸ 暂停'; status.className = 'alert'; status.textContent = '🔊 继续朗读…' }
  }
  stopBtn.onclick = () => { stopPlay(); status.className = 'alert'; status.textContent = '⏹ 已停止'; updateProgress(0, chunks.length) }

  // —— 可选：MP3 文件导出（需本机服务，非阻塞）——
  const fileNameInput = el('input', { type: 'text', placeholder: '输出文件名（不含扩展名）', style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)' })
  const genBtn = el('button', { class: 'btn primary' }, ['⬇ 生成并下载 MP3'])
  const mp3Status = el('div', { class: 'alert' }, ['检测本机服务中…'])
  const recheckBtn = el('button', { class: 'btn' }, ['🔄 重新检测'])
  const audioEl = el('audio', { controls: true, style: 'width:100%;margin-top:10px;display:none' })
  const downloadLink = el('a', { class: 'btn primary', download: 'tts.mp3', style: 'display:none;margin-top:8px;text-decoration:none' }, ['⬇ 下载 MP3'])
  let serverOk = false
  const setMp3Status = (msg, type) => { mp3Status.className = 'alert' + (type ? ' ' + type : ''); mp3Status.textContent = msg }
  const checkServer = async () => {
    if (!hasSynth) { /* 仍然可检测 */ }
    try {
      const resp = await fetch(TTS_BASE + '/', { method: 'GET', mode: 'cors', targetAddressSpace: 'local' })
      serverOk = resp.ok
      if (serverOk) setMp3Status('✓ 已连接本机 Edge TTS 服务（' + TTS_BASE + '）', 'ok')
      else setMp3Status('· 未连接本机服务：MP3 导出暂不可用（朗读功能不受影响）', '')
    } catch (e) {
      serverOk = false
      setMp3Status('· 未连接本机服务：MP3 导出暂不可用（朗读功能不受影响）', '')
    }
    genBtn.disabled = !serverOk
  }
  const generate = async () => {
    if (!serverOk) { await checkServer(); if (!serverOk) { toast('MP3 导出需先启动本机服务（见下方说明）', 'err'); return } }
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可转换的文本', 'err'); return }
    const voice = voiceSel.value
    const rateNum = +rate.value
    const pct = Math.round((rateNum - 1) * 100)
    const ratePct = (pct > 0 ? '+' : '') + pct + '%'
    const ck = splitChunks(text)
    genBtn.disabled = true; downloadLink.style.display = 'none'; audioEl.style.display = 'none'
    const blobs = []
    try {
      for (let i = 0; i < ck.length; i++) {
        setMp3Status('⏳ 正在生成第 ' + (i + 1) + '/' + ck.length + ' 段（本机 edge-tts 合成）…', '')
        updateMp3Progress(i, ck.length)
        const blob = await localTTSChunk(ck[i], voice, ratePct)
        blobs.push(blob)
      }
      updateMp3Progress(ck.length, ck.length)
      const finalBlob = new Blob(blobs, { type: 'audio/mpeg' })
      const url = URL.createObjectURL(finalBlob)
      audioEl.src = url; audioEl.style.display = ''
      const fname = (fileNameInput.value.trim() || ('tts-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'))) + '.mp3'
      downloadLink.href = url; downloadLink.download = fname; downloadLink.style.display = ''
      setMp3Status('✓ 生成完成：' + fname + '（' + (finalBlob.size / 1024).toFixed(1) + ' KB，' + ck.length + ' 段合并）', 'ok')
    } catch (e) {
      setMp3Status('✗ 生成失败：' + e.message, 'err')
    } finally {
      genBtn.disabled = false
    }
  }
  const mp3Fill = el('div', { style: 'height:8px;background:var(--panel-2);border-radius:6px;overflow:hidden;margin-top:4px' })
  const mp3Bar = el('div', { style: 'height:100%;width:0%;background:var(--primary);transition:width .15s' }); mp3Fill.append(mp3Bar)
  const updateMp3Progress = (done, total) => { mp3Bar.style.width = (total ? Math.min(100, done / total * 100) : 0) + '%' }

  // —— 历史（记录朗读/导出）——
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
        el('span', {}, [it.name + ' · ' + (it.kind === 'mp3' ? 'MP3导出' : '朗读') + ' · ' + it.rate + '×']),
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
    charCount.textContent = n + ' 字（朗读/生成前自动清理 Markdown）'
    clearTimeout(saveTimer); saveTimer = setTimeout(() => LSset('text', textArea.value), 400)
  }
  textArea.oninput = onText
  voiceSel.onchange = () => { LSset('voiceId', voiceSel.value) }
  rate.oninput = () => { rateVal.textContent = (+rate.value).toFixed(2) + '×'; LSset('rate', rate.value) }
  genBtn.onclick = generate
  recheckBtn.onclick = checkServer

  if (LS('text', '')) textArea.value = LS('text', '')
  onText()
  renderHistory()
  // 记录朗读历史（点击朗读/停止时写入）
  const recordListen = () => { if (chunks.length) { saveHistory({ name: (textArea.value.slice(0, 12) || '未命名') + '…', kind: 'listen', rate: (+rate.value).toFixed(2), time: Date.now() }); renderHistory() } }
  playBtn.addEventListener('click', () => setTimeout(recordListen, 800))
  stopBtn.addEventListener('click', recordListen)

  // 检测 MP3 服务（非阻塞）
  checkServer()
  let pollCount = 0
  const pollTimer = setInterval(async () => {
    if (serverOk || ++pollCount > 6) { clearInterval(pollTimer); return }
    await checkServer()
  }, 3000)

  panel.append(
    el('p', { class: 'sub' }, ['直接用浏览器自带语音朗读，零后端、打开即用。音色与语速严格遵循 md-to-mp3 技能规范（5 个微软 Edge 音色、默认 0.9×）；可选导出真实 MP3 文件（需本机服务）。']),
    el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:10px' }, [loadBtn, charCount]),
      fileInput, textArea,
      el('p', { class: 'hint', style: 'margin-top:6px' }, ['Markdown（# 标题、**加粗**、链接、代码块、表格、脚注、章末统计等）会在朗读/生成前自动清理为纯净正文。文本自动保存在本机。'])
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'field' }, [el('label', {}, ['音色（微软 Edge，与 md-to-mp3 技能一致）']), voiceSel]),
        el('div', { class: 'field' }, [el('label', {}, ['语速（默认 0.9×）']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [rate, rateVal])])
      ]),
      el('div', { class: 'row', style: 'margin-top:12px;flex-wrap:wrap;gap:10px' }, [playBtn, pauseBtn, stopBtn, previewBtn]),
      progress, progText, status
    ]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { style: 'font-weight:600;margin-bottom:6px' }, ['💾 导出 MP3 文件（可选）']),
      el('p', { class: 'hint', style: 'margin:0 0 8px' }, ['此功能把文字真正合成为 .mp3 文件，需要本机运行 Edge TTS 服务（与 md-to-mp3 技能同一后端）。未运行也不影响上方「朗读」功能。']),
      el('div', { class: 'field' }, [el('label', {}, ['输出文件名']), fileNameInput]),
      el('div', { class: 'row', style: 'margin-top:10px' }, [genBtn, recheckBtn]),
      mp3Fill,
      el('div', { class: 'row', style: 'gap:10px;align-items:center;margin-top:6px' }, [mp3Status]),
      audioEl, downloadLink,
      el('details', { style: 'margin-top:10px' }, [
        el('summary', { style: 'cursor:pointer;color:var(--primary)' }, ['如何启用 MP3 导出？（一步命令，可选）']),
        el('p', { class: 'hint', style: 'margin:8px 0' }, ['在项目目录执行下面这一条命令，会自动装好依赖并启动本机服务（同源直连，无需任何配置）：']),
        el('div', {}, [el('code', { style: 'display:inline-block;background:var(--panel-2);padding:8px 12px;border-radius:8px;font-size:13px' }, ['python run-workbench.py'])]),
        el('p', { class: 'hint', style: 'margin:8px 0 0' }, ['若你用的是线上站点，加参数：', el('code', {}, ['python run-workbench.py --online']), '（仅启动语音服务并打开线上页面）。服务启动后保持窗口运行即可。'])
      ])
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

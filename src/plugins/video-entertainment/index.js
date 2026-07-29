// 视频娱乐：①外部视频站点入口（原功能）②文字转音频（复刻 md-to-mp3 技能流程：清理 Markdown → 微软 Edge 免费 TTS → 真实 MP3）
import { el, clear, toast } from '../../core/ui.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'

// —— 本地持久化（与全站 opwb:* 约定一致）——
const LS = (k, d) => { try { const v = localStorage.getItem('opwb:tts:' + k); return v == null ? d : v } catch (e) { return d } }
const LSset = (k, v) => { try { localStorage.setItem('opwb:tts:' + k, v) } catch (e) {} }

// 微软 Edge 免费 TTS 端点（与 edge-tts / md-to-mp3 技能同一后端、无需 Key）
const TTS_WS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A7A6B8C8B4D4A8E9F3B2A1C5D6E7F8'
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
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

// —— 底层：单块文本经微软 Edge TTS 返回 MP3 Blob（复刻 edge_tts.Communicate.save）——
function edgeTTSChunk(text, voice, ratePct, proxyUrl) {
  return new Promise((resolve, reject) => {
    const wsUrl = (proxyUrl || TTS_WS).trim()
    let ws
    try { ws = new WebSocket(wsUrl) }
    catch (e) { reject(new Error('无法创建 WebSocket 连接：' + e.message)); return }
    ws.binaryType = 'arraybuffer'
    const audioChunks = []
    let turnEnded = false, settled = false
    const finish = (ok, dataOrErr) => {
      if (settled) return
      settled = true
      try { ws.close() } catch (e) {}
      if (ok) resolve(dataOrErr); else reject(dataOrErr)
    }
    const timeout = setTimeout(() => finish(false, new Error('连接超时（微软服务无响应，可能是网络被拦截）')), 60000)

    ws.onopen = () => {
      try {
        const config = { context: { synthesis: { audio: {
          metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
          outputFormat: OUTPUT_FORMAT } } } }
        ws.send(buildMsg({ 'Content-Type': 'application/json; charset=utf-8', 'Path': 'speech.config', 'X-Timestamp': nowGMT() }, JSON.stringify(config)))
        const locale = (voice.split('-').slice(0, 2).join('-')) || 'zh-CN'
        const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='" + locale + "'>" +
          "<voice name='" + voice + "'><prosody rate='" + ratePct + "'>" + escapeXml(text) + '</prosody></voice></speak>'
        ws.send(buildMsg({ 'Content-Type': 'application/ssml+xml', 'Path': 'ssml', 'X-RequestId': uuid(), 'X-Timestamp': nowGMT() }, ssml))
      } catch (e) { finish(false, new Error('发送请求失败：' + e.message)) }
    }
    ws.onmessage = (ev) => {
      try {
        const bytes = new Uint8Array(ev.data)
        const sep = findSep(bytes)
        if (sep === -1) { if (bytes.length) audioChunks.push(bytes); return }
        const headerText = new TextDecoder().decode(bytes.subarray(0, sep))
        const audio = bytes.subarray(sep + 4)
        if (/Path:\s*audio/i.test(headerText)) { if (audio.length) audioChunks.push(audio) }
        else if (/Path:\s*turn\.end/i.test(headerText)) { turnEnded = true }
      } catch (e) { finish(false, new Error('解析响应出错：' + e.message)) }
    }
    ws.onerror = () => { clearTimeout(timeout); finish(false, new Error('WebSocket 错误（连接被拒绝/网络不通，请检查网络或代理）')) }
    ws.onclose = () => {
      clearTimeout(timeout)
      if (settled) return
      if (audioChunks.length) finish(true, new Blob(audioChunks, { type: 'audio/mpeg' }))
      else if (turnEnded) finish(true, new Blob([], { type: 'audio/mpeg' }))
      else finish(false, new Error('连接已关闭但未收到音频（网络拦截或服务不可用）'))
    }
  })
}
function buildMsg(headers, body) {
  let h = ''
  for (const k in headers) h += k + ': ' + headers[k] + '\r\n'
  h += '\r\n'
  const enc = new TextEncoder()
  const hb = enc.encode(h), bb = enc.encode(body)
  const out = new Uint8Array(hb.length + bb.length)
  out.set(hb, 0); out.set(bb, hb.length)
  return out.buffer
}
function findSep(b) { for (let i = 0; i < b.length - 3; i++) if (b[i] === 0x0d && b[i + 1] === 0x0a && b[i + 2] === 0x0d && b[i + 3] === 0x0a) return i; return -1 }
function escapeXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function nowGMT() { return new Date().toUTCString() }
function uuid() {
  const b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0'))
  return [h.slice(0, 4), h.slice(4, 6), h.slice(6, 8), h.slice(8, 10), h.slice(10, 16)].map(a => a.join('')).join('-')
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
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const proxy = LS('proxy', '')

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
  const genBtn = el('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 22px' }, ['⬇ 生成 MP3（微软 Edge TTS）'])
  const previewBtn = el('button', { class: 'btn' }, ['🔊 浏览器试听'])
  if (!supported) previewBtn.disabled = true
  const progress = el('div', { style: 'height:8px;background:var(--panel-2);border-radius:6px;overflow:hidden;margin-top:4px' })
  const fill = el('div', { style: 'height:100%;width:0%;background:var(--primary);transition:width .15s' })
  progress.append(fill)
  const progText = el('span', { class: 'muted' }, ['0 / 0 段'])
  const status = el('div', { class: 'alert' }, ['就绪'])
  const audioEl = el('audio', { controls: true, style: 'width:100%;margin-top:10px;display:none' })
  const downloadLink = el('a', { class: 'btn primary', download: 'tts.mp3', style: 'display:none;margin-top:8px;text-decoration:none' }, ['⬇ 下载 MP3'])
  const historyBox = el('div', { style: 'margin-top:8px' })

  // —— 网络设置（代理）——
  const proxyInput = el('input', {
    type: 'text',
    value: proxy,
    placeholder: 'wss://your-worker.your-subdomain.workers.dev/（留空则直连微软服务）',
    style: 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)'
  })
  const proxyStatus = el('span', { class: 'hint' }, ['当前：' + (proxy ? '使用代理 ' + proxy : '直连微软服务')])
  const testProxyBtn = el('button', { class: 'btn' }, ['🔗 测试连接'])
  const saveProxyBtn = el('button', { class: 'btn primary' }, ['💾 保存设置'])
  const proxyBody = el('div', { style: 'display:none;margin-top:10px' }, [
    el('p', { class: 'hint' }, ['北京等网络环境可能无法直接连接微软服务。可部署 Cloudflare Worker 代理后，把 wss:// 地址填到下方。代理仅做透传，不存储文本与音频。']),
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      proxyInput,
      saveProxyBtn,
      testProxyBtn
    ]),
    proxyStatus,
    el('div', { style: 'margin-top:8px;padding:10px;background:var(--panel-2);border-radius:8px;font-size:13px' }, [
      el('div', { style: 'font-weight:600;margin-bottom:4px' }, ['没有代理？']),
      el('div', { class: 'muted' }, ['可下载并部署这个 Cloudflare Worker 脚本：']),
      el('a', {
        href: './edge-tts-proxy.js',
        download: 'edge-tts-proxy.js',
        class: 'btn',
        style: 'margin-top:6px;display:inline-block;text-decoration:none'
      }, ['📥 下载 edge-tts-proxy.js']),
      el('div', { class: 'muted', style: 'margin-top:6px' }, ['部署步骤：1) 登录 Cloudflare → Workers & Pages → 创建 Worker；2) 粘贴脚本；3) 保存并复制 Worker 的 wss:// 地址到上方。'])
    ])
  ])
  const proxyToggle = el('button', { class: 'btn', style: 'font-size:13px' }, ['⚙️ 网络设置'])
  proxyToggle.onclick = () => {
    const open = proxyBody.style.display === 'none'
    proxyBody.style.display = open ? '' : 'none'
    proxyToggle.textContent = open ? '⚙️ 收起网络设置' : '⚙️ 网络设置'
  }

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

  saveProxyBtn.onclick = () => {
    const v = proxyInput.value.trim()
    LSset('proxy', v)
    proxyStatus.textContent = '当前：' + (v ? '使用代理 ' + v : '直连微软服务')
    toast(v ? '已保存代理设置' : '已清空代理，将直连微软服务')
  }
  testProxyBtn.onclick = () => {
    const v = proxyInput.value.trim() || TTS_WS
    setStatus('🔗 正在测试 ' + (proxyInput.value.trim() ? '代理' : '微软服务直连') + '…')
    const ws = new WebSocket(v)
    const t = setTimeout(() => { try { ws.close() } catch (e) {} setStatus('⏱ 测试超时（网络不通或被拦截）', 'err') }, 10000)
    ws.onopen = () => {
      clearTimeout(t); try { ws.close() } catch (e) {}
      setStatus('✓ 连接测试通过：' + v, 'ok')
    }
    ws.onerror = () => { clearTimeout(t); setStatus('✗ 连接测试失败：' + v, 'err') }
    ws.onclose = () => { clearTimeout(t) }
  }

  const generate = async () => {
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可转换的文本', 'err'); return }
    const voice = voiceSel.value
    const rateNum = +rate.value
    const pct = Math.round((rateNum - 1) * 100)
    const ratePct = (pct >= 0 ? '+' : '') + pct + '%'
    const chunks = splitChunks(text)
    const proxyUrl = LS('proxy', '').trim()
    genBtn.disabled = true; previewBtn.disabled = true; downloadLink.style.display = 'none'; audioEl.style.display = 'none'
    const blobs = []
    try {
      for (let i = 0; i < chunks.length; i++) {
        setStatus('⏳ 正在生成第 ' + (i + 1) + '/' + chunks.length + ' 段（经' + (proxyUrl ? '代理 → ' : '') + '微软 Edge TTS 合成）…', '')
        updateProgress(i, chunks.length)
        const blob = await edgeTTSChunk(chunks[i], voice, ratePct, proxyUrl)
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
      const tip = proxyUrl
        ? '（代理连接失败，请检查代理地址是否可访问）'
        : '（当前直连微软服务失败；北京等网络环境建议在「网络设置」配置代理后重试，或改用「浏览器试听」）'
      setStatus('✗ 生成失败：' + e.message + tip, 'err')
    } finally {
      genBtn.disabled = false; if (supported) previewBtn.disabled = false
    }
  }

  const preview = () => {
    const text = cleanMarkdown(textArea.value)
    if (!text.trim()) { toast('没有可朗读文本', 'err'); return }
    if (!supported) { toast('浏览器不支持语音合成', 'err'); return }
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'; u.rate = +rate.value
    speechSynthesis.speak(u)
    setStatus('🔊 浏览器试听中（此模式为设备/浏览器语音，不产出文件；要导出 MP3 请点「生成 MP3」）')
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

  if (LS('text', '')) textArea.value = LS('text', '')
  onText()
  renderHistory()

  panel.append(
    el('p', { class: 'sub' }, ['复刻 md-to-mp3 技能流程：清理 Markdown → 微软 Edge 免费 TTS（无需 Key）→ 真实可下载 MP3。默认男声云希、语速 0.9×（与技能一致）。']),
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
      el('div', { style: 'margin-top:10px' }, [proxyToggle, proxyBody]),
      progress, progText, status, audioEl, downloadLink
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

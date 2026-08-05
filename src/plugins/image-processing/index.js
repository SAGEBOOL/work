// 图片处理：统一「图片去水印」「图片高清修复（新增）」「视频去水印」三个功能到一个板块。
// 去水印两项直接复用既有插件逻辑（保持功能不变、纯前端），高清修复为本机画布增强。
import { el, clear, toast } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { callImageGen, configuredProviders, getProvider } from '../../core/aiGateway.js'
import { imageWatermarkPlugin } from '../image-watermark/index.js'
import { videoWatermarkPlugin } from '../video-watermark/index.js'

// 3×3 锐化卷积（简化 unsharp）
function convolve(imgData, w, h) {
  const src = imgData.data
  const out = new Uint8ClampedArray(src.length)
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r = 0, g = 0, b = 0, ki = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) { ki++; continue }
          const j = (ny * w + nx) * 4
          r += src[j] * k[ki]; g += src[j + 1] * k[ki]; b += src[j + 2] * k[ki]; ki++
        }
      }
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = src[i + 3]
    }
  }
  imgData.data.set(out)
}

// —— 图片高清修复：本机画布放大 + 亮度/对比度/锐化 ——
function renderEnhance(panel) {
  let img = null
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' })
  const drop = el('div', { class: 'dropzone' }, ['拖入图片，或点击选择（JPG/PNG/WebP）'])
  const previewCanvas = el('canvas', { class: 'view' })
  const pctx = previewCanvas.getContext('2d')

  const scaleSel = el('select', {}, [
    el('option', { value: '1' }, ['不放大 (1×)']),
    el('option', { value: '2', selected: 'selected' }, ['2× 高清放大']),
    el('option', { value: '3' }, ['3×']),
    el('option', { value: '4' }, ['4×'])
  ])
  const bright = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: '1' })
  const brightVal = el('span', { class: 'muted' }, ['1.00'])
  const contrast = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: '1' })
  const contrastVal = el('span', { class: 'muted' }, ['1.00'])
  const sharpenChk = el('input', { type: 'checkbox' })
  const runBtn = el('button', { class: 'btn' }, ['开始修复'])
  const dlBtn = el('button', { class: 'btn ghost', disabled: 'true' }, ['下载结果'])
  const alert = el('div', {})
  const hint = el('p', { class: 'hint' }, ['本机画布增强：按所选倍数放大（双线性插值），并应用亮度/对比度调整与可选锐化。适合轻度模糊、压缩画质受损的老照片/截图复原。纯前端处理，不上传服务器。'])

  const loadFile = (f) => {
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => { img = im; draw(); URL.revokeObjectURL(url); alert.className = ''; alert.textContent = ''; dlBtn.disabled = true }
    im.onerror = () => { alert.className = 'alert err'; alert.textContent = '✗ 图片解析失败'; URL.revokeObjectURL(url) }
    im.src = url
  }
  const draw = () => {
    if (!img) return
    const sc = +scaleSel.value
    const w = Math.round(img.width * sc), h = Math.round(img.height * sc)
    previewCanvas.width = w; previewCanvas.height = h
    previewCanvas.style.width = '100%'; previewCanvas.style.maxWidth = w + 'px'
    pctx.clearRect(0, 0, w, h)
    pctx.imageSmoothingEnabled = true
    pctx.filter = 'none'
    pctx.drawImage(img, 0, 0, w, h)
  }
  const redraw = () => { if (img) draw() }

  drop.onclick = () => fileInput.click()
  fileInput.onchange = () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = '' }
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over') }
  drop.ondragleave = () => drop.classList.remove('over')
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]) }

  bright.oninput = () => { brightVal.textContent = (+bright.value).toFixed(2); redraw() }
  contrast.oninput = () => { contrastVal.textContent = (+contrast.value).toFixed(2); redraw() }
  scaleSel.onchange = redraw

  runBtn.onclick = () => {
    if (!img) { alert.className = 'alert err'; alert.textContent = '请先上传图片'; return }
    const sc = +scaleSel.value
    const w = Math.round(img.width * sc), h = Math.round(img.height * sc)
    previewCanvas.width = w; previewCanvas.height = h
    previewCanvas.style.width = '100%'; previewCanvas.style.maxWidth = w + 'px'
    pctx.imageSmoothingEnabled = true
    pctx.filter = `brightness(${bright.value}) contrast(${contrast.value})`
    pctx.drawImage(img, 0, 0, w, h)
    pctx.filter = 'none'
    if (sharpenChk.checked) {
      const data = pctx.getImageData(0, 0, w, h)
      convolve(data, w, h)
      pctx.putImageData(data, 0, 0)
    }
    alert.className = 'alert ok'
    alert.textContent = `✓ 已修复（本机增强：${sc}× 放大 + 亮度/对比度${sharpenChk.checked ? ' + 锐化' : ''}）`
    dlBtn.disabled = false
  }
  dlBtn.onclick = () => {
    if (!previewCanvas.width) return
    previewCanvas.toBlob((b) => {
      const u = URL.createObjectURL(b)
      const a = el('a', { href: u, download: 'enhanced.png' }); document.body.append(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(u), 1500)
    }, 'image/png')
  }

  panel.append(
    el('div', { class: 'card' }, [drop, hint, previewCanvas]),
    el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('div', { class: 'grid cols-2' }, [
        el('div', { class: 'field' }, [el('label', {}, ['放大倍数']), scaleSel]),
        el('div', { class: 'field' }, [el('label', {}, [el('input', { type: 'checkbox', style: 'vertical-align:middle;margin-right:6px', onchange: (e) => { sharpenChk.checked = e.target.checked; if (img) runBtn.onclick() } }), '锐化增强'])]),
        el('div', { class: 'field' }, [el('label', {}, ['亮度']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [bright, brightVal])]),
        el('div', { class: 'field' }, [el('label', {}, ['对比度']), el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [contrast, contrastVal])])
      ]),
      el('div', { class: 'row', style: 'margin-top:12px' }, [runBtn, dlBtn]),
      alert,
      el('p', { class: 'hint', style: 'margin-top:10px' }, ['说明：本工具为纯前端画布增强，非云端 AI 超分模型；对真实模糊/低分辨率的"无中生有"有限，主要改善轻度压缩与放大后的观感。'])
    ])
  )
}

// —— AI 生图：文生图（OpenAI 兼容 /images/generations 端点）——
function renderAiGen(panel) {
  const provs = configuredProviders()
  const providerSel = el('select', {}, provs.length
    ? provs.map((p) => el('option', { value: p.id }, [p.name]))
    : [el('option', { value: '' }, ['（未配置供应商）'])])

  const modelInput = el('input', { type: 'text', placeholder: '如 cogview-3 / 自定义模型名', style: 'width:100%' })
  const sizeInput = el('input', { type: 'text', value: '1024x1024', style: 'width:100%' })
  const countSel = el('select', {}, [1, 2, 3, 4].map((n) =>
    el('option', { value: String(n), ...(n === 1 ? { selected: 'selected' } : {}) }, [String(n) + ' 张'])))
  const promptArea = el('textarea', {
    rows: '4',
    placeholder: '描述你想生成的画面，越具体越好。例如：国潮风格的水墨插画，黑色背景上金色祥云与牡丹，非遗主题海报。',
    style: 'width:100%;resize:vertical;font:inherit'
  })
  const genBtn = el('button', { class: 'btn' }, ['生成图片'])
  const alert = el('div', {})
  const results = el('div', {
    style: 'margin-top:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px'
  })

  // 切换供应商时自动填入默认图像模型
  const fillModel = () => {
    const p = getProvider(providerSel.value)
    if (!p) { modelInput.value = ''; return }
    if (p.imageModels && p.imageModels.length) modelInput.value = p.imageModels[0]
    else if (p.isCustom && p.model) modelInput.value = p.model
  }
  if (provs.length) fillModel()
  providerSel.onchange = fillModel

  if (!provs.length) {
    alert.className = 'alert err'
    alert.textContent = '未检测到任何已配置的供应商。请先到「设置」填写至少一个支持图像生成的 API Key（推荐智谱 GLM，模型 cogview-3；或添加 SiliconFlow 等自定义模型）。'
  }

  const downloadImage = (item, idx) => {
    const a = el('a', { download: 'ai-image-' + (idx + 1) + '.png' })
    if (item.b64) {
      a.href = 'data:image/png;base64,' + item.b64
      document.body.append(a); a.click(); a.remove()
    } else if (item.url) {
      fetch(item.url).then((r) => r.blob()).then((b) => {
        const u = URL.createObjectURL(b)
        a.href = u; document.body.append(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(u), 1500)
      }).catch(() => { window.open(item.url, '_blank') })
    }
  }

  genBtn.onclick = async () => {
    const prompt = promptArea.value.trim()
    const prov = providerSel.value
    if (!prompt) { alert.className = 'alert err'; alert.textContent = '请输入提示词'; return }
    if (!prov) { alert.className = 'alert err'; alert.textContent = '请先到「设置」配置供应商'; return }
    const p = getProvider(prov)
    const key = p.isCustom ? p.apiKey : getSettings().apiKeys[prov]
    if (!key) { alert.className = 'alert err'; alert.textContent = '「' + p.name + '」未配置 API Key，请到「设置」填写'; return }
    const model = modelInput.value.trim()
    if (!model) { alert.className = 'alert err'; alert.textContent = '请填写图像生成模型名'; return }

    genBtn.disabled = true
    genBtn.textContent = '生成中…'
    alert.className = ''; alert.textContent = ''
    clear(results)
    results.append(el('div', { class: 'muted' }, ['⏳ 正在生成，文生图通常需要 5–30 秒，请稍候…']))
    try {
      const imgs = await callImageGen({ prompt, provider: prov, model, size: sizeInput.value.trim() || '1024x1024', n: +countSel.value })
      clear(results)
      imgs.forEach((it, i) => {
        const src = it.url || ('data:image/png;base64,' + it.b64)
        results.append(el('div', { class: 'card', style: 'padding:10px' }, [
          el('img', { src, alt: 'AI 生成 ' + (i + 1), loading: 'lazy', style: 'width:100%;border-radius:8px;display:block;background:var(--bg-2)' }),
          el('div', { class: 'row', style: 'margin-top:10px;justify-content:flex-end' }, [
            el('button', { class: 'btn ghost', onclick: () => downloadImage(it, i) }, ['下载'])
          ])
        ]))
      })
      alert.className = 'alert ok'
      alert.textContent = '✓ 已生成 ' + imgs.length + ' 张图片（来自 ' + p.name + ' · ' + model + '）'
    } catch (e) {
      clear(results)
      alert.className = 'alert err'
      alert.textContent = e.message || String(e)
    } finally {
      genBtn.disabled = false
      genBtn.textContent = '生成图片'
    }
  }

  panel.append(
    el('div', { class: 'card' }, [
      el('div', { class: 'field' }, [el('label', {}, ['提示词（Prompt）']), promptArea]),
      el('div', { class: 'grid cols-2', style: 'margin-top:12px' }, [
        el('div', { class: 'field' }, [el('label', {}, ['供应商']), providerSel]),
        el('div', { class: 'field' }, [el('label', {}, ['模型名']), modelInput]),
        el('div', { class: 'field' }, [el('label', {}, ['尺寸 (宽x高)']), sizeInput]),
        el('div', { class: 'field' }, [el('label', {}, ['数量']), countSel])
      ]),
      el('div', { class: 'row', style: 'margin-top:14px' }, [genBtn]),
      alert,
      el('p', { class: 'hint', style: 'margin-top:10px' }, ['内置支持图像生成的厂商：智谱 GLM（cogview-3）。DeepSeek / Kimi / 通义等内置模型无图像生成能力；可在「设置」添加自定义 OpenAI 兼容服务（如 SiliconFlow / 硅基流动）来扩展。各厂商支持的尺寸与模型名不同，若报错请按提示调整。图像由所选厂商生成，提示词会发往该厂商。'])
    ]),
    results
  )
}

export const imageProcessingPlugin = {
  id: 'image-processing',
  name: '图片处理',
  icon: '🖼️',
  group: '基础办公',
  mount(root) {
    const tabsDef = [
      { label: '🪄 图片去水印', plug: imageWatermarkPlugin },
      { label: '✨ 图片高清修复', render: renderEnhance },
      { label: '🎬 视频去水印', plug: videoWatermarkPlugin },
      { label: '🎨 AI 生图', render: renderAiGen }
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
      const t = tabsDef[i]
      if (t.plug) t.plug.mount(panel, { navigate() {} })
      else if (t.render) t.render(panel)
    }
    setTab(0)

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['图片处理']),
      el('p', { class: 'sub' }, ['图片去水印 · 图片高清修复 · 视频去水印 · AI 生图，纯前端处理，数据不出本机。']),
      seg, panel
    ])
    root.append(page)
  }
}

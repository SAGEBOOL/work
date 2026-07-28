// 图片处理：统一「图片去水印」「图片高清修复（新增）」「视频去水印」三个功能到一个板块。
// 去水印两项直接复用既有插件逻辑（保持功能不变、纯前端），高清修复为本机画布增强。
import { el, clear, toast } from '../../core/ui.js'
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

export const imageProcessingPlugin = {
  id: 'image-processing',
  name: '图片处理',
  icon: '🖼️',
  group: '基础办公',
  mount(root) {
    const tabsDef = [
      { label: '🪄 图片去水印', plug: imageWatermarkPlugin },
      { label: '✨ 图片高清修复', render: renderEnhance },
      { label: '🎬 视频去水印', plug: videoWatermarkPlugin }
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
      else renderEnhance(panel)
    }
    setTab(0)

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['图片处理']),
      el('p', { class: 'sub' }, ['图片去水印 · 图片高清修复 · 视频去水印，纯前端处理，数据不出本机。']),
      seg, panel
    ])
    root.append(page)
  }
}

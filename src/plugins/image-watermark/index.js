// 图片去水印：上传图 → 画笔遮盖水印区域 → 内容感知修复(Fast Marching) 或 快速模糊 → 下载。
// 纯前端实现，无需下载任何外部引擎（OpenCV.js 10MB 在北京到 GitHub Pages 网络下不可达），全程本机处理。
import { el, clear } from '../../core/ui.js'

export const imageWatermarkPlugin = {
  id: 'image-watermark',
  name: '图片去水印',
  icon: '🪄',
  group: '基础办公',
  mount(root) {
    let original = null      // 原始 Image

    const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' })
    const drop = el('div', { class: 'dropzone' }, ['拖入图片，或点击选择（JPG/PNG/WebP）'])
    const stage = el('div', { class: 'stage' })
    const view = el('canvas', { class: 'view' })        // 显示原图/结果
    const mask = el('canvas', { class: 'mask' })        // 覆盖层：画笔遮罩
    stage.append(view, mask)
    const brush = el('input', { type: 'range', min: '8', max: '80', value: '28', style: 'width:160px' })
    const brushVal = el('span', { class: 'muted' }, ['28px'])
    const clearMaskBtn = el('button', { class: 'btn ghost' }, ['清空遮罩'])
    const resetBtn = el('button', { class: 'btn ghost' }, ['重置图片'])
    const blurBtn = el('button', { class: 'btn ghost' }, ['快速模糊'])
    const runBtn = el('button', { class: 'btn' }, ['去除水印'])
    const dlBtn = el('button', { class: 'btn ghost' }, ['下载结果'])
    const alert = el('div', {})
    const modeHint = el('p', { class: 'hint' }, ['「去除水印」：内容感知填充（从边缘向内扩散，效果自然）；「快速模糊」：直接高斯模糊水印区，适合角标/小字。两者均本机处理，无需下载引擎。'])

    const vctx = view.getContext('2d')
    const mctx = mask.getContext('2d')

    const fitCanvas = (img) => {
      const max = 1400
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      for (const c of [view, mask]) { c.width = w; c.height = h; c.style.width = w + 'px'; c.style.height = h + 'px' }
      vctx.drawImage(img, 0, 0, w, h)
      mctx.clearRect(0, 0, w, h)
    }

    const loadFile = (f) => {
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.onload = () => { original = img; fitCanvas(img); URL.revokeObjectURL(url); alert.textContent = '' }
      img.onerror = () => { alert.className = 'alert err'; alert.textContent = '✗ 图片解析失败'; URL.revokeObjectURL(url) }
      img.src = url
    }

    drop.onclick = () => fileInput.click()
    fileInput.onchange = () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = '' }
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over') }
    drop.ondragleave = () => drop.classList.remove('over')
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]) }

    brush.oninput = () => { brushVal.textContent = brush.value + 'px'; mctx.lineWidth = +brush.value }
    clearMaskBtn.onclick = () => mctx.clearRect(0, 0, mask.width, mask.height)
    resetBtn.onclick = () => { if (original) { fitCanvas(original); alert.textContent = '' } }
    dlBtn.onclick = () => {
      if (!view.width) return
      view.toBlob((b) => {
        const u = URL.createObjectURL(b)
        const a = el('a', { href: u, download: 'watermark-removed.png' }); document.body.append(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(u), 1500)
      }, 'image/png')
    }

    // 画笔
    let drawing = false
    const pos = (e) => {
      const r = mask.getBoundingClientRect()
      return { x: (e.clientX - r.left) * (mask.width / r.width), y: (e.clientY - r.top) * (mask.height / r.height) }
    }
    const start = (e) => { drawing = true; mask.setPointerCapture(e.pointerId); const p = pos(e); mctx.beginPath(); mctx.moveTo(p.x, p.y); mctx.strokeStyle = 'rgba(255,60,60,.55)'; mctx.lineWidth = +brush.value; mctx.lineCap = 'round'; mctx.lineJoin = 'round' }
    const move = (e) => { if (!drawing) return; const p = pos(e); mctx.lineTo(p.x, p.y); mctx.stroke() }
    const end = () => { drawing = false }
    mask.addEventListener('pointerdown', start)
    mask.addEventListener('pointermove', move)
    mask.addEventListener('pointerup', end)
    mask.addEventListener('pointerleave', end)

    const checkHasMask = () => {
      const d = mctx.getImageData(0, 0, mask.width, mask.height).data
      for (let i = 3; i < d.length; i += 4) if (d[i] > 10) return true
      return false
    }

    // 快速模糊：不依赖任何引擎，按 mask 区域把原图对应像素替换为高斯模糊后的像素
    blurBtn.onclick = () => {
      if (!view.width) { alert.className = 'alert err'; alert.textContent = '请先上传图片'; return }
      if (!checkHasMask()) { alert.className = 'alert err'; alert.textContent = '请先用画笔在水印上涂抹'; return }
      try {
        const tmp = document.createElement('canvas')
        tmp.width = view.width; tmp.height = view.height
        const tctx = tmp.getContext('2d')
        tctx.filter = 'blur(14px)'
        tctx.drawImage(view, 0, 0)
        const mData = mctx.getImageData(0, 0, mask.width, mask.height).data
        const vData = vctx.getImageData(0, 0, view.width, view.height)
        const tData = tctx.getImageData(0, 0, tmp.width, tmp.height)
        for (let i = 3; i < mData.length; i += 4) {
          if (mData[i] > 10) {
            const px = (i - 3) >> 2
            vData.data[px * 4] = tData.data[px * 4]
            vData.data[px * 4 + 1] = tData.data[px * 4 + 1]
            vData.data[px * 4 + 2] = tData.data[px * 4 + 2]
            vData.data[px * 4 + 3] = 255
          }
        }
        vctx.putImageData(vData, 0, 0)
        mctx.clearRect(0, 0, mask.width, mask.height)
        alert.className = 'alert ok'; alert.textContent = '✓ 已模糊处理，可继续涂抹叠加或下载'
      } catch (err) {
        alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
      }
    }

    // 内容感知修复：快速行进(Fast Marching)近似——从水印边界向内逐层用已知邻域均值填充。
    // 纯 JS，零下载，复杂度 O(水印像素)，处理秒级。适合文字/logo 等常见水印。
    const runInpaint = () => {
      if (!view.width) { alert.className = 'alert err'; alert.textContent = '请先上传图片'; return }
      if (!checkHasMask()) { alert.className = 'alert err'; alert.textContent = '请先用画笔在水印上涂抹'; return }
      runBtn.disabled = true; blurBtn.disabled = true; alert.className = ''; alert.textContent = '修复中…'
      // 让「修复中…」先渲染，再同步计算
      setTimeout(() => {
        try {
          const vw = view.width, vh = view.height
          const vImg = vctx.getImageData(0, 0, vw, vh)
          const mImg = mctx.getImageData(0, 0, vw, vh)
          const data = vImg.data
          const N = vw * vh
          const known = new Uint8Array(N)
          const knownCount = new Int32Array(N)
          for (let i = 0; i < N; i++) known[i] = (mImg.data[i * 4 + 3] > 10) ? 0 : 1
          const buf = new Float32Array(N * 3)
          for (let i = 0; i < N; i++) { buf[i * 3] = data[i * 4]; buf[i * 3 + 1] = data[i * 4 + 1]; buf[i * 3 + 2] = data[i * 4 + 2] }
          const NB = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
          const queue = []
          for (let y = 0; y < vh; y++) {
            for (let x = 0; x < vw; x++) {
              const i = y * vw + x
              if (known[i]) continue
              let cnt = 0
              for (const [dx, dy] of NB) {
                const nx = x + dx, ny = y + dy
                if (nx < 0 || ny < 0 || nx >= vw || ny >= vh) continue
                if (known[ny * vw + nx]) cnt++
              }
              knownCount[i] = cnt
              if (cnt > 0) queue.push(i)
            }
          }
          let head = 0
          while (head < queue.length) {
            const i = queue[head++]
            if (known[i]) continue
            const x = i % vw, y = (i / vw) | 0
            let cnt = 0, sr = 0, sg = 0, sb = 0
            for (const [dx, dy] of NB) {
              const nx = x + dx, ny = y + dy
              if (nx < 0 || ny < 0 || nx >= vw || ny >= vh) continue
              const ni = ny * vw + nx
              if (known[ni]) { const v = ni * 3; sr += buf[v]; sg += buf[v + 1]; sb += buf[v + 2]; cnt++ }
            }
            if (cnt > 0) { const v = i * 3; buf[v] = sr / cnt; buf[v + 1] = sg / cnt; buf[v + 2] = sb / cnt }
            known[i] = 1
            for (const [dx, dy] of NB) {
              const nx = x + dx, ny = y + dy
              if (nx < 0 || ny < 0 || nx >= vw || ny >= vh) continue
              const ni = ny * vw + nx
              if (!known[ni]) { knownCount[ni]++; if (knownCount[ni] === 1) queue.push(ni) }
            }
          }
          for (let i = 0; i < N; i++) { const v = i * 3; data[i * 4] = buf[v]; data[i * 4 + 1] = buf[v + 1]; data[i * 4 + 2] = buf[v + 2]; data[i * 4 + 3] = 255 }
          vctx.putImageData(vImg, 0, 0)
          mctx.clearRect(0, 0, mask.width, mask.height)
          alert.className = 'alert ok'; alert.textContent = '✓ 已修复，可继续涂抹叠加处理或下载'
        } catch (err) {
          alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
        } finally {
          runBtn.disabled = false; blurBtn.disabled = false
        }
      }, 10)
    }
    runBtn.onclick = runInpaint

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['图片去水印']),
      el('p', { class: 'sub' }, ['画笔涂抹水印区域，内容识别算法自动填充 · 纯本机处理']),
      el('div', { class: 'card' }, [drop, modeHint, stage]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('div', { class: 'row' }, [
          el('label', { class: 'muted' }, ['笔刷']), brush, brushVal,
          el('span', { style: 'flex:1' }),
          clearMaskBtn, resetBtn, blurBtn, runBtn, dlBtn
        ]),
        alert
      ])
    ])
    root.append(page)
  }
}

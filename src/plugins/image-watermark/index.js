// 图片去水印：上传图 → 画笔遮盖水印区域 → OpenCV 内容识别修复(inpaint) → 下载。
// OpenCV.js 随站点一起部署（约 10MB），懒加载 + 进度条，进入页面即后台预加载，不阻塞首屏。全程本机，不上传。
import { el, clear } from '../../core/ui.js'

export const imageWatermarkPlugin = {
  id: 'image-watermark',
  name: '图片去水印',
  icon: '🪄',
  group: '基础办公',
  mount(root) {
    let original = null      // 原始 Image
    let cvReady = false

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
    const runBtn = el('button', { class: 'btn' }, ['去除水印'])
    const dlBtn = el('button', { class: 'btn ghost' }, ['下载结果'])
    const alert = el('div', {})

    // 引擎加载进度条
    const cvFill = el('div', { class: 'cv-fill' })
    const cvBar = el('div', { class: 'cv-bar' }, [ cvFill ])
    const cvPct = el('div', { class: 'cv-pct muted' }, ['修复引擎准备中…'])
    const cvProgress = el('div', { class: 'cv-progress' }, [ cvBar, cvPct ])

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

    // 懒加载 OpenCV 引擎：fetch 流式下载 + 进度条；进入页面即后台预加载，不阻塞交互
    let cvPromise = null
    const ensureOpenCV = () => {
      if (window.cv && window.cv.getVersion) return Promise.resolve(window.cv)
      if (cvPromise) return cvPromise
      cvPromise = new Promise((resolve, reject) => {
        fetch('./opencv.js').then((resp) => {
          if (!resp.ok) throw new Error('引擎下载失败（HTTP ' + resp.status + '）')
          const total = +resp.headers.get('content-length') || 0
          if (!total) { cvFill.classList.add('indeterminate'); cvPct.textContent = '引擎加载中…' }
          const reader = resp.body.getReader()
          const chunks = []
          let received = 0
          const pump = () => reader.read().then(({ done, value }) => {
            if (done) {
              const blob = new Blob(chunks, { type: 'application/javascript' })
              const url = URL.createObjectURL(blob)
              const s = document.createElement('script')
              s.src = url
              s.onload = () => {
                let tries = 0
                const wait = () => {
                  if (window.cv && window.cv.getVersion) {
                    URL.revokeObjectURL(url)
                    cvFill.style.width = '100%'
                    cvPct.textContent = '✓ 修复引擎已就绪'
                    cvProgress.classList.add('ready')
                    cvReady = true
                    return resolve(window.cv)
                  }
                  if (++tries > 200) return reject(new Error('OpenCV 初始化超时，请刷新页面重试'))
                  setTimeout(wait, 100)
                }
                wait()
              }
              s.onerror = () => reject(new Error('引擎执行失败，请刷新页面重试'))
              document.head.append(s)
              return
            }
            chunks.push(value)
            received += value.length
            if (total) {
              const pct = Math.round((received / total) * 100)
              cvFill.style.width = pct + '%'
              cvPct.textContent = '引擎加载中 ' + pct + '%'
            }
            pump()
          })
          pump()
        }).catch(reject)
      }).catch((err) => { cvPromise = null; throw err })  // 失败可重试：重置后下次重新加载
      return cvPromise
    }
    // 进入页面即后台预加载（不阻塞），提前拿到引擎
    ensureOpenCV().catch(() => { cvPct.textContent = '引擎加载失败，点击「去除水印」时自动重试'; cvProgress.classList.add('err') })

    runBtn.onclick = async () => {
      if (!view.width) { alert.className = 'alert err'; alert.textContent = '请先上传图片'; return }
      const hasMask = (() => { const d = mctx.getImageData(0, 0, mask.width, mask.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) return true; return false })()
      if (!hasMask) { alert.className = 'alert err'; alert.textContent = '请先用画笔在水印上涂抹'; return }
      runBtn.disabled = true; alert.className = ''; alert.textContent = '正在准备修复引擎…'
      try {
        const cv = await ensureOpenCV()
        alert.textContent = '修复中…'
        const src = cv.imread(view)
        const rgba = cv.imread(mask)
        const chans = new cv.MatVector(); cv.split(rgba, chans)
        const a = chans.get(3)
        cv.threshold(a, a, 10, 255, cv.THRESH_BINARY)
        const dst = new cv.Mat()
        cv.inpaint(src, a, dst, 3, cv.INPAINT_TELEA)
        cv.imshow(view, dst)
        mctx.clearRect(0, 0, mask.width, mask.height)
        src.delete(); rgba.delete(); chans.delete(); a.delete(); dst.delete()
        alert.className = 'alert ok'; alert.textContent = '✓ 已修复，可继续涂抹叠加处理或下载'
      } catch (err) {
        alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
      } finally {
        runBtn.disabled = false
      }
    }

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['图片去水印']),
      el('p', { class: 'sub' }, ['画笔涂抹水印区域，内容识别算法自动填充 · 纯本机处理']),
      el('div', { class: 'card' }, [drop, cvProgress, stage]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('div', { class: 'row' }, [
          el('label', { class: 'muted' }, ['笔刷']), brush, brushVal,
          el('span', { style: 'flex:1' }),
          clearMaskBtn, resetBtn, runBtn, dlBtn
        ]),
        alert
      ])
    ])
    root.append(page)
  }
}
